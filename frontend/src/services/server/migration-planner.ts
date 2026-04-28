import { type Address, getAddress } from "viem";
import type { DestinationVault, MigrationPlan, Position } from "@/types";
import {
  APPROVE_MAX,
  encodeApproveCalldata,
  encodeV4BurnCalldata,
} from "./calldata-encoders";
import { fetchComposerQuote } from "./lifi-composer";
import { fetchVaults } from "./lifi-earn";
import { fetchPositionsOnChain } from "./positions-onchain";

const POSITION_MANAGER_V4 = getAddress(
  "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
);
const LIFI_DIAMOND = getAddress("0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDBC", "PYUSD"]);

function pickStableSide(): "USDC" {
  return "USDC";
}

async function pickBestVault(
  asset: string,
  signal?: AbortSignal,
): Promise<DestinationVault | null> {
  const vaults = await fetchVaults(
    {
      chainId: 8453,
      asset,
      sortBy: "apy",
      limit: 12,
      trustedOnly: true,
      minTvlUsd: 500_000,
    },
    signal,
  ).catch(() => [] as DestinationVault[]);
  return vaults[0] ?? null;
}

function isStableSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
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
): Promise<MigrationPlan> {
  const owner = getAddress(ownerAddress);
  const positions = await fetchPositionsOnChain(owner, signal);
  const position = positions.find((p) => p.tokenId === positionTokenId);
  if (!position) {
    throw new Error("Position not found for owner");
  }

  const desiredStable = pickStableSide();
  const destination = await pickBestVault(desiredStable, signal);
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
  const vaultAddress = getAddress(destination.address);
  const fromAmount =
    valueUsd > 0 ? BigInt(Math.floor(valueUsd * 10 ** 6)) : 1_000_000n;

  const approveCalldata = inputToken.isNative
    ? null
    : encodeApproveCalldata(LIFI_DIAMOND, APPROVE_MAX);

  let composerCalldata: string | null = null;
  let composerValue = "0";
  let composerTo: Address = LIFI_DIAMOND;
  try {
    const quote = await fetchComposerQuote(
      {
        fromChain: 8453,
        toChain: 8453,
        fromToken: inputToken.address,
        toToken: vaultAddress,
        fromAmount: fromAmount.toString(),
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
      ...(approveCalldata
        ? [
            {
              kind: "swap" as const,
              target: `${inputToken.symbol} (ERC20)`,
              targetAddress: inputToken.address,
              description: `Approve Li.Fi router to pull ${inputToken.symbol} from your wallet.`,
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
          ? `Deposit ${inputToken.symbol} into ${destination.protocolName} ${destination.name} (${apyPercent.toFixed(2)}% APY) via Li.Fi Composer.`
          : `Deposit ${inputToken.symbol} into ${destination.protocolName} ${destination.name} (composer call will be re-fetched at execute time).`,
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
