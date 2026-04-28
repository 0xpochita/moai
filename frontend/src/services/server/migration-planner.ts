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
  encodeV4BurnCalldata,
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
const LIFI_DIAMOND = getAddress("0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const USDC_BASE = getAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
const BASE_CHAIN_ID = 8453;

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDBC", "PYUSD"]);

function pickStableSide(): "USDC" {
  return "USDC";
}

type RiskProfile = "conservative" | "balanced" | "aggressive";

const SAFE_PROTOCOLS = new Set(["morpho-v1", "aave-v3", "compound-v3", "lido"]);

async function pickBestVault(
  asset: string,
  riskProfile: RiskProfile,
  signal?: AbortSignal,
): Promise<DestinationVault | null> {
  const tvlFloor = riskProfile === "aggressive" ? 100_000 : 500_000;
  const vaults = await fetchVaults(
    {
      chainId: 8453,
      asset,
      sortBy: riskProfile === "conservative" ? "tvl" : "apy",
      limit: 24,
      trustedOnly: true,
      minTvlUsd: tvlFloor,
    },
    signal,
  ).catch(() => [] as DestinationVault[]);

  if (riskProfile === "conservative") {
    const safe = vaults.filter((v) => SAFE_PROTOCOLS.has(v.protocolName));
    const sorted = safe.length > 0 ? safe : vaults;
    return [...sorted].sort((a, b) => b.tvlUsd - a.tvlUsd)[0] ?? null;
  }

  if (riskProfile === "aggressive") {
    return [...vaults].sort((a, b) => b.apyTotal - a.apyTotal)[0] ?? null;
  }

  return vaults[0] ?? null;
}

function isStableSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
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
  if (valueUsd <= 0) return 10n ** BigInt(decimals);
  const scaled = Math.floor(valueUsd * 10 ** Math.min(decimals, 6));
  if (decimals <= 6) return BigInt(scaled);
  return BigInt(scaled) * 10n ** BigInt(decimals - 6);
}

interface UniswapSwapLegsResult {
  legs: MigrationLeg[];
  minAmountOut: bigint;
}

async function buildUniswapSwapLegs(args: {
  owner: Address;
  tokenIn: Address;
  tokenInSymbol: string;
  amountIn: bigint;
  signal?: AbortSignal;
}): Promise<UniswapSwapLegsResult> {
  const { owner, tokenIn, tokenInSymbol, amountIn, signal } = args;

  const approval = await checkUniswapApproval(
    {
      walletAddress: owner,
      token: tokenIn,
      amount: amountIn.toString(),
      chainId: BASE_CHAIN_ID,
    },
    signal,
  );

  const quote = await fetchUniswapQuote(
    {
      swapper: owner,
      tokenIn,
      tokenOut: USDC_BASE,
      tokenInChainId: BASE_CHAIN_ID,
      tokenOutChainId: BASE_CHAIN_ID,
      amount: amountIn.toString(),
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
      target: `${tokenInSymbol} (Permit2 approve)`,
      targetAddress: getAddress(approval.approval.to),
      description: `Approve Permit2 to pull ${tokenInSymbol} for the Uniswap swap.`,
      calldata: approval.approval.data,
      value: approval.approval.value ?? "0",
    });
  }

  legs.push({
    kind: "swap",
    target: "Uniswap Universal Router",
    targetAddress: getAddress(swapTx.swap.to),
    description: `Swap ${tokenInSymbol} → USDC via Uniswap Trading API (CLASSIC route).`,
    calldata: swapTx.swap.data,
    value: swapTx.swap.value ?? "0",
  });

  const outAmount = BigInt(quote.quote.output.amount);
  const slippageBps = BigInt(Math.floor((quote.quote.slippage ?? 0.5) * 100));
  const minAmountOut = (outAmount * (10000n - slippageBps)) / 10000n;

  return { legs, minAmountOut };
}

function pickPostBurnInputToken(
  position: Position,
  desiredStable: string,
): { address: Address; symbol: string; isNative: boolean } {
  const sym0 = position.token0.symbol.toUpperCase();
  const sym1 = position.token1.symbol.toUpperCase();
  if (sym0 === desiredStable) {
    return {
      address: getAddress(position.token0.address),
      symbol: sym0,
      isNative: false,
    };
  }
  if (sym1 === desiredStable) {
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
  return {
    address: getAddress(position.token0.address),
    symbol: sym0,
    isNative: false,
  };
}

export async function buildMigrationPlan(
  ownerAddress: string,
  positionTokenId: string,
  signal?: AbortSignal,
  options?: { riskProfile?: RiskProfile },
): Promise<MigrationPlan> {
  const owner = getAddress(ownerAddress);
  const positions = await fetchPositionsOnChain(owner, signal);
  const position = positions.find((p) => p.tokenId === positionTokenId);
  if (!position) {
    throw new Error("Position not found for owner");
  }

  const desiredStable = pickStableSide();
  const riskProfile = options?.riskProfile ?? "balanced";
  const destination = await pickBestVault(desiredStable, riskProfile, signal);
  if (!destination) {
    throw new Error("No trusted vault available for migration");
  }

  const valueUsd = position.valueUsd > 0 ? position.valueUsd : 0;
  const apyPercent = destination.apyTotal;
  const perYearUsd = valueUsd * (apyPercent / 100);
  const perMonthUsd = perYearUsd / 12;
  const perDayUsd = perYearUsd / 365;

  const pairLabel = `${position.token0.symbol} / ${position.token1.symbol}`;
  const deadlineSec = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

  const burnCalldata = encodeV4BurnCalldata({
    tokenId: BigInt(position.tokenId),
    currency0: getAddress(position.token0.address),
    currency1: getAddress(position.token1.address),
    recipient: owner,
    deadlineSec,
  });

  const inputToken = pickPostBurnInputToken(position, desiredStable);
  const inputDecimals = symbolDecimals(position, inputToken.symbol);
  const vaultAddress = getAddress(destination.address);
  const inputAmount = humanUsdToAtomic(valueUsd, inputDecimals);
  const isInputUsdc = !inputToken.isNative && inputToken.symbol === "USDC";

  const swapLegs: MigrationLeg[] = [];
  let depositFromAmount = inputAmount;
  let depositFromToken: Address = inputToken.address;
  let depositFromSymbol = inputToken.symbol;

  if (!isInputUsdc && !inputToken.isNative) {
    try {
      const tradingApiLegs = await buildUniswapSwapLegs({
        owner,
        tokenIn: inputToken.address,
        tokenInSymbol: inputToken.symbol,
        amountIn: inputAmount,
        signal,
      });
      swapLegs.push(...tradingApiLegs.legs);
      depositFromAmount = tradingApiLegs.minAmountOut;
      depositFromToken = USDC_BASE;
      depositFromSymbol = "USDC";
    } catch (err) {
      console.warn(
        "[migration-planner] uniswap trading api failed; falling back to composer-only path:",
        err,
      );
    }
  }

  const approveCalldata = inputToken.isNative
    ? null
    : encodeApproveCalldata(LIFI_DIAMOND, APPROVE_MAX);

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
    console.warn("[migration-planner] composer quote failed:", err);
  }

  return {
    intent: "migrate",
    positionTokenId: position.tokenId,
    positionId: position.id,
    source: {
      protocol: position.protocol,
      pair: pairLabel,
      chain: position.network,
      valueUsd,
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
        kind: "burn",
        target: "Uniswap PositionManager",
        targetAddress: POSITION_MANAGER_V4,
        description: `Burn LP position #${position.tokenId} to collect ${pairLabel}.`,
        calldata: burnCalldata,
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
              calldata: encodeApproveCalldata(LIFI_DIAMOND, APPROVE_MAX),
              value: "0",
            },
          ]
        : []),
      {
        kind: "deposit",
        target: "Li.Fi Composer",
        targetAddress: composerTo,
        description: composerCalldata
          ? `Deposit ${depositFromSymbol} into ${destination.protocolName} ${destination.name} (${apyPercent.toFixed(2)}% APY) via Li.Fi Composer.`
          : `Deposit ${depositFromSymbol} into ${destination.protocolName} ${destination.name} (composer call will be re-fetched at execute time).`,
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
