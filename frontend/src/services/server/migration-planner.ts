import type { DestinationVault, MigrationPlan, Position } from "@/types";
import { fetchVaults } from "./lifi-earn";
import { fetchPositionsOnChain } from "./positions-onchain";

const POSITION_MANAGER_V4 = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
const UNIVERSAL_ROUTER = "0x6ff5693b99212da76ad316178a184ab56d299b43";
const LIFI_DIAMOND = "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae";

const STABLECOIN_SYMBOLS = new Set(["USDC", "USDT", "DAI", "USDBC", "PYUSD"]);

function pickStableSide(position: Position): "USDC" {
  const sym0 = position.token0.symbol.toUpperCase();
  const sym1 = position.token1.symbol.toUpperCase();
  if (sym0 === "USDC" || sym1 === "USDC") return "USDC";
  if (STABLECOIN_SYMBOLS.has(sym0)) return "USDC";
  if (STABLECOIN_SYMBOLS.has(sym1)) return "USDC";
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

export async function buildMigrationPlan(
  ownerAddress: string,
  positionTokenId: string,
  signal?: AbortSignal,
): Promise<MigrationPlan> {
  const positions = await fetchPositionsOnChain(ownerAddress, signal);
  const position = positions.find((p) => p.tokenId === positionTokenId);
  if (!position) {
    throw new Error("Position not found for owner");
  }

  const asset = pickStableSide(position);
  const destination = await pickBestVault(asset, signal);
  if (!destination) {
    throw new Error("No trusted vault available for migration");
  }

  const valueUsd = position.valueUsd > 0 ? position.valueUsd : 0;
  const apyPercent = destination.apyTotal;
  const perYearUsd = valueUsd * (apyPercent / 100);
  const perMonthUsd = perYearUsd / 12;
  const perDayUsd = perYearUsd / 365;

  const pairLabel = `${position.token0.symbol} / ${position.token1.symbol}`;

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
      },
      {
        kind: "swap",
        target: "UniversalRouter",
        targetAddress: UNIVERSAL_ROUTER,
        description: `Swap collected ${position.token0.symbol === asset ? position.token1.symbol : position.token0.symbol} into ${asset} via Permit2.`,
      },
      {
        kind: "deposit",
        target: "Li.Fi Composer",
        targetAddress: LIFI_DIAMOND,
        description: `Deposit ${asset} into ${destination.protocolName} ${destination.name} (${apyPercent.toFixed(2)}% APY).`,
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
