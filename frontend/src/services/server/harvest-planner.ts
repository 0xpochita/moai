import { type Address, getAddress } from "viem";
import type {
  DestinationVault,
  MigrationLeg,
  MigrationPlan,
  Position,
} from "@/types";
import {
  APPROVE_MAX,
  encodeApproveCalldata,
  encodeV3HarvestCalldata,
  encodeV4HarvestCalldata,
} from "./calldata-encoders";
import { fetchComposerQuote } from "./lifi-composer";
import { fetchVaults } from "./lifi-earn";
import { fetchPositionsOnChain } from "./positions-onchain";
import {
  checkUniswapApproval,
  fetchUniswapQuote,
  fetchUniswapSwap,
} from "./uniswap-trade";

const POSITION_MANAGER_V4 = getAddress(
  "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
);
const POSITION_MANAGER_V3 = getAddress(
  "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
);
const LIFI_DIAMOND = getAddress("0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const USDC_BASE = getAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
const BASE_CHAIN_ID = 8453;
const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDBC", "PYUSD"]);

// Lowered to 0 for hackathon demo — auto-harvest keeper still enforces a
// real floor via KEEPER_HARVEST_MIN_USD env (default $5).
const MIN_HARVEST_USD_DEFAULT = 0;

type RiskProfile = "conservative" | "balanced" | "aggressive";

const PROFILE_PROTOCOLS: Record<RiskProfile, string[]> = {
  conservative: ["aave-v3", "compound-v3", "lido"],
  balanced: ["morpho-v1", "aave-v3", "compound-v3"],
  aggressive: ["pendle", "ethena", "yearn-v3", "euler-v2", "etherfi"],
};

async function pickBestVault(
  asset: string,
  riskProfile: RiskProfile,
  signal?: AbortSignal,
): Promise<DestinationVault | null> {
  const tvlFloor = riskProfile === "aggressive" ? 100_000 : 500_000;
  const vaults = await fetchVaults(
    {
      chainId: BASE_CHAIN_ID,
      asset,
      sortBy: riskProfile === "conservative" ? "tvl" : "apy",
      limit: 50,
      trustedOnly: true,
      minTvlUsd: tvlFloor,
    },
    signal,
  ).catch(() => [] as DestinationVault[]);

  if (vaults.length === 0) return null;
  const allow = PROFILE_PROTOCOLS[riskProfile];
  const preferred = vaults.filter((v) => allow.includes(v.protocolName));
  const pool = preferred.length > 0 ? preferred : vaults;

  if (riskProfile === "conservative") {
    return [...pool].sort((a, b) => b.tvlUsd - a.tvlUsd)[0] ?? null;
  }
  return [...pool].sort((a, b) => b.apyTotal - a.apyTotal)[0] ?? null;
}

function isStableSymbol(s: string): boolean {
  return STABLECOIN_SYMBOLS.has(s.toUpperCase());
}

function symbolDecimals(position: Position, symbol: string): number {
  if (position.token0.symbol.toUpperCase() === symbol.toUpperCase()) {
    return position.token0.decimals;
  }
  if (position.token1.symbol.toUpperCase() === symbol.toUpperCase()) {
    return position.token1.decimals;
  }
  return 18;
}

function humanUsdToAtomic(valueUsd: number, decimals: number): bigint {
  if (valueUsd <= 0) return 0n;
  const scaled = Math.floor(valueUsd * 10 ** Math.min(decimals, 6));
  if (decimals <= 6) return BigInt(scaled);
  return BigInt(scaled) * 10n ** BigInt(decimals - 6);
}

interface HarvestInputResult {
  legs: MigrationLeg[];
  outAmount: bigint;
  outToken: Address;
  outSymbol: string;
}

/// Build the swap legs that route accrued fees to USDC. If the fee side
/// is already USDC, returns no legs.
async function buildFeeSwapLegs(args: {
  owner: Address;
  feeToken: Address;
  feeSymbol: string;
  feeAmount: bigint;
  signal?: AbortSignal;
}): Promise<HarvestInputResult> {
  const { owner, feeToken, feeSymbol, feeAmount, signal } = args;

  if (feeSymbol.toUpperCase() === "USDC" || feeAmount === 0n) {
    return {
      legs: [],
      outAmount: feeAmount,
      outToken: feeToken,
      outSymbol: feeSymbol,
    };
  }

  const approval = await checkUniswapApproval(
    {
      walletAddress: owner,
      token: feeToken,
      amount: feeAmount.toString(),
      chainId: BASE_CHAIN_ID,
    },
    signal,
  );

  const quote = await fetchUniswapQuote(
    {
      swapper: owner,
      tokenIn: feeToken,
      tokenOut: USDC_BASE,
      tokenInChainId: BASE_CHAIN_ID,
      tokenOutChainId: BASE_CHAIN_ID,
      amount: feeAmount.toString(),
      type: "EXACT_INPUT",
      slippageTolerance: 0.5,
      routingPreference: "CLASSIC",
      protocols: ["V3", "V4"],
    },
    signal,
  );

  const swapTx = await fetchUniswapSwap(quote, signal);

  const legs: MigrationLeg[] = [];

  if (approval.approval) {
    legs.push({
      kind: "swap",
      target: `${feeSymbol} (Permit2 approve)`,
      targetAddress: getAddress(approval.approval.to),
      description: `Approve Permit2 to pull ${feeSymbol} fees for the Uniswap swap.`,
      calldata: approval.approval.data,
      value: approval.approval.value ?? "0",
    });
  }

  legs.push({
    kind: "swap",
    target: "Uniswap Universal Router",
    targetAddress: getAddress(swapTx.swap.to),
    description: `Swap harvested ${feeSymbol} fees → USDC via Uniswap Trading API.`,
    calldata: swapTx.swap.data,
    value: swapTx.swap.value ?? "0",
  });

  const outAmount = BigInt(quote.quote.output.amount);
  const slippageBps = BigInt(Math.floor((quote.quote.slippage ?? 0.5) * 100));
  const minOut = (outAmount * (10000n - slippageBps)) / 10000n;

  return {
    legs,
    outAmount: minOut,
    outToken: USDC_BASE,
    outSymbol: "USDC",
  };
}

/// Picks which fee side to route into the vault. Prefers USDC, then any
/// stablecoin, then non-native side, else native ETH.
function pickFeeSide(
  position: Position,
): { address: Address; symbol: string; isNative: boolean } {
  const sym0 = position.token0.symbol.toUpperCase();
  const sym1 = position.token1.symbol.toUpperCase();
  if (sym0 === "USDC") {
    return {
      address: getAddress(position.token0.address),
      symbol: sym0,
      isNative: false,
    };
  }
  if (sym1 === "USDC") {
    return {
      address: getAddress(position.token1.address),
      symbol: sym1,
      isNative: false,
    };
  }
  if (isStableSymbol(sym0)) {
    return {
      address: getAddress(position.token0.address),
      symbol: sym0,
      isNative: false,
    };
  }
  if (isStableSymbol(sym1)) {
    return {
      address: getAddress(position.token1.address),
      symbol: sym1,
      isNative: false,
    };
  }
  if (position.token0.address === ZERO_ADDRESS) {
    return { address: ZERO_ADDRESS, symbol: "ETH", isNative: true };
  }
  if (position.token1.address === ZERO_ADDRESS) {
    return { address: ZERO_ADDRESS, symbol: "ETH", isNative: true };
  }
  return {
    address: getAddress(position.token0.address),
    symbol: sym0,
    isNative: false,
  };
}

export async function buildHarvestPlan(
  ownerAddress: string,
  positionTokenId: string,
  signal?: AbortSignal,
  options?: { riskProfile?: RiskProfile; minHarvestUsd?: number },
): Promise<MigrationPlan> {
  const owner = getAddress(ownerAddress);
  const positions = await fetchPositionsOnChain(owner, signal);
  const position = positions.find((p) => p.tokenId === positionTokenId);
  if (!position) {
    throw new Error("Position not found for owner");
  }
  if (position.status === "out-of-range") {
    throw new Error(
      "Position is out-of-range. Use migrate flow instead of harvest.",
    );
  }

  const feesUsd = position.uncollectedFeesUsd ?? 0;
  const minHarvestUsd = options?.minHarvestUsd ?? MIN_HARVEST_USD_DEFAULT;
  if (feesUsd < minHarvestUsd) {
    throw new Error(
      `Accrued fees ($${feesUsd.toFixed(2)}) below harvest threshold ($${minHarvestUsd}).`,
    );
  }

  const riskProfile = options?.riskProfile ?? "balanced";
  const destination = await pickBestVault("USDC", riskProfile, signal);
  if (!destination) {
    throw new Error("No trusted vault available for harvest deposit");
  }

  const pairLabel = `${position.token0.symbol} / ${position.token1.symbol}`;
  const deadlineSec = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

  const harvestCalldata =
    position.protocol === "v4"
      ? encodeV4HarvestCalldata({
          tokenId: BigInt(position.tokenId),
          currency0: getAddress(position.token0.address),
          currency1: getAddress(position.token1.address),
          recipient: owner,
          deadlineSec,
        })
      : encodeV3HarvestCalldata({
          tokenId: BigInt(position.tokenId),
          recipient: owner,
        });

  const harvestTo =
    position.protocol === "v4" ? POSITION_MANAGER_V4 : POSITION_MANAGER_V3;

  const feeSide = pickFeeSide(position);
  const feeDecimals = symbolDecimals(position, feeSide.symbol);
  // Approximate fee atomic amount from USD (planner is best-effort —
  // executor can refresh via second plan call). For a fee harvest we
  // route the entire fee USD value through Trading API.
  const feeAmountAtomic = humanUsdToAtomic(feesUsd, feeDecimals);

  const swapLegs: MigrationLeg[] = [];
  let depositFromAmount = feeAmountAtomic;
  let depositFromToken: Address = feeSide.address;
  let depositFromSymbol = feeSide.symbol;

  if (!feeSide.isNative && feeSide.symbol.toUpperCase() !== "USDC") {
    try {
      const swap = await buildFeeSwapLegs({
        owner,
        feeToken: feeSide.address,
        feeSymbol: feeSide.symbol,
        feeAmount: feeAmountAtomic,
        signal,
      });
      swapLegs.push(...swap.legs);
      depositFromAmount = swap.outAmount;
      depositFromToken = swap.outToken;
      depositFromSymbol = swap.outSymbol;
    } catch (err) {
      console.warn("[harvest-planner] uniswap trading api failed:", err);
    }
  }

  const approveCalldata = feeSide.isNative
    ? null
    : encodeApproveCalldata(LIFI_DIAMOND, APPROVE_MAX);

  const vaultAddress = getAddress(destination.address);
  let composerCalldata: string | null = null;
  let composerValue = "0";
  let composerTo: Address = LIFI_DIAMOND;
  try {
    const quote = await fetchComposerQuote(
      {
        fromChain: BASE_CHAIN_ID,
        toChain: BASE_CHAIN_ID,
        fromToken: depositFromToken,
        toToken: vaultAddress,
        fromAmount: depositFromAmount.toString(),
        fromAddress: owner,
        slippage: 0.005,
      },
      signal,
    );
    if (quote.transactionRequest) {
      composerCalldata = quote.transactionRequest.data;
      composerValue = quote.transactionRequest.value ?? "0";
      composerTo = getAddress(quote.transactionRequest.to);
    }
  } catch (err) {
    console.warn("[harvest-planner] composer quote failed:", err);
  }

  const apyPercent = destination.apyTotal;
  const perYearUsd = feesUsd * (apyPercent / 100);
  const perMonthUsd = perYearUsd / 12;
  const perDayUsd = perYearUsd / 365;

  return {
    intent: "harvest",
    positionTokenId: position.tokenId,
    positionId: position.id,
    source: {
      protocol: position.protocol,
      pair: pairLabel,
      chain: position.network,
      valueUsd: feesUsd,
      feeTier: position.feeTier,
      poolAddress: position.poolAddress,
      status: position.status,
      protocolLogoKey: "uniswap",
      token0: {
        symbol: position.token0.symbol,
        logoUrl: position.token0.logoUrl,
      },
      token1: {
        symbol: position.token1.symbol,
        logoUrl: position.token1.logoUrl,
      },
    },
    destination,
    legs: [
      {
        kind: "harvest",
        target: "Uniswap PositionManager",
        targetAddress: harvestTo,
        description: `Collect accrued fees on position #${position.tokenId} (${pairLabel}). LP stays live.`,
        calldata: harvestCalldata,
        value: "0",
      },
      ...swapLegs,
      ...(approveCalldata
        ? [
            {
              kind: "swap" as const,
              target: `${depositFromSymbol} (ERC20)`,
              targetAddress: depositFromToken,
              description: `Approve Li.Fi router to pull ${depositFromSymbol} from your wallet.`,
              calldata: approveCalldata,
              value: "0",
            },
          ]
        : []),
      {
        kind: "deposit",
        target: "Li.Fi Composer",
        targetAddress: composerTo,
        description: composerCalldata
          ? `Deposit harvested ${depositFromSymbol} into ${destination.protocolName} ${destination.name} (${apyPercent.toFixed(2)}% APY).`
          : `Deposit harvested ${depositFromSymbol} (composer call will be re-fetched at execute time).`,
        calldata: composerCalldata ?? undefined,
        value: composerValue,
      },
    ],
    yield: {
      perDayUsd,
      perMonthUsd,
      perYearUsd,
      apyPercent,
    },
    generatedAtSec: Math.floor(Date.now() / 1000),
  };
}
