import type { Position, PositionStatus, PositionToken } from "@/types";

const DEFAULT_BASE_SUBGRAPH_ID = "HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1";

function endpoint(): string | null {
  const apiKey = process.env.THEGRAPH_API_KEY;
  if (!apiKey) return null;
  const subgraphId =
    process.env.UNISWAP_V3_BASE_SUBGRAPH_ID ?? DEFAULT_BASE_SUBGRAPH_ID;
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
}

const QUERY = `
  query UserPositions($owner: String!, $first: Int!) {
    positions(
      where: { owner: $owner, liquidity_gt: "0" }
      first: $first
      orderBy: liquidity
      orderDirection: desc
    ) {
      id
      owner
      liquidity
      depositedToken0
      depositedToken1
      collectedFeesToken0
      collectedFeesToken1
      tickLower { tickIdx }
      tickUpper { tickIdx }
      pool {
        id
        feeTier
        tick
        token0Price
        token1Price
        totalValueLockedUSD
        token0 { id symbol decimals }
        token1 { id symbol decimals }
      }
      transaction { timestamp }
    }
  }
`;

interface SubgraphToken {
  id: string;
  symbol: string;
  decimals: string;
}

interface SubgraphTick {
  tickIdx: string;
}

interface SubgraphPool {
  id: string;
  feeTier: string;
  tick: string | null;
  token0Price: string;
  token1Price: string;
  totalValueLockedUSD: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
}

interface SubgraphPosition {
  id: string;
  owner: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  tickLower: SubgraphTick;
  tickUpper: SubgraphTick;
  pool: SubgraphPool;
  transaction: { timestamp: string };
}

interface SubgraphResponse {
  data?: { positions: SubgraphPosition[] };
  errors?: { message: string }[];
}

function tokenLogoUrl(address: string): string {
  return `https://dd.dexscreener.com/ds-data/tokens/base/${address.toLowerCase()}.png`;
}

function toPositionToken(raw: SubgraphToken): PositionToken {
  return {
    address: raw.id,
    symbol: raw.symbol,
    decimals: Number(raw.decimals),
    logoUrl: tokenLogoUrl(raw.id),
  };
}

function classifyStatus(
  currentTick: number | null,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): PositionStatus {
  if (liquidity <= 0n) return "closed";
  if (currentTick === null) return "in-range";
  if (currentTick >= tickLower && currentTick < tickUpper) return "in-range";
  return "out-of-range";
}

function generateSparkline(seed: string): number[] {
  const points: number[] = [];
  let value = 50;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < 32; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const delta = ((h % 1000) / 1000 - 0.5) * 8;
    value = Math.max(10, Math.min(90, value + delta));
    points.push(value);
  }
  return points;
}

function toPosition(raw: SubgraphPosition): Position {
  const liquidity = BigInt(raw.liquidity);
  const tickLower = Number(raw.tickLower.tickIdx);
  const tickUpper = Number(raw.tickUpper.tickIdx);
  const currentTick = raw.pool.tick !== null ? Number(raw.pool.tick) : null;

  const valueUsd =
    Number(raw.pool.totalValueLockedUSD) > 0
      ? (Number(raw.depositedToken0) - Number(raw.collectedFeesToken0)) *
          Number(raw.pool.token0Price) +
        (Number(raw.depositedToken1) - Number(raw.collectedFeesToken1)) *
          Number(raw.pool.token1Price)
      : 0;

  const uncollectedFeesUsd =
    Number(raw.collectedFeesToken0) * Number(raw.pool.token0Price) +
    Number(raw.collectedFeesToken1) * Number(raw.pool.token1Price);

  return {
    id: raw.id,
    tokenId: raw.id.split("#").pop() ?? raw.id,
    owner: raw.owner,
    network: "base",
    protocol: "v3",
    feeTier: Number(raw.pool.feeTier) / 10_000,
    status: classifyStatus(currentTick, tickLower, tickUpper, liquidity),
    delegated: false,
    valueUsd: Math.max(0, valueUsd),
    uncollectedFeesUsd: Math.max(0, uncollectedFeesUsd),
    yieldDayUsd: 0,
    token0: toPositionToken(raw.pool.token0),
    token1: toPositionToken(raw.pool.token1),
    tickLower,
    tickUpper,
    currentTick: currentTick ?? tickLower,
    sparkline: generateSparkline(raw.id),
    poolAddress: raw.pool.id,
    createdAtSec: Number(raw.transaction.timestamp),
    poolTvlUsd: Number(raw.pool.totalValueLockedUSD),
    volume24hUsd: 0,
    aprMin: 0,
    aprMax: 0,
  };
}

export async function fetchPositionsForOwner(
  ownerAddress: string,
  signal?: AbortSignal,
  first = 24,
): Promise<Position[]> {
  const url = endpoint();
  if (!url) {
    throw new Error("THEGRAPH_API_KEY is not set");
  }

  const owner = ownerAddress.toLowerCase();
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { owner, first } }),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`positions subgraph failed (${res.status})`);
  }

  const json = (await res.json()) as SubgraphResponse;
  if (json.errors?.length) {
    throw new Error(`positions subgraph error: ${json.errors[0].message}`);
  }
  if (!json.data?.positions) {
    return [];
  }

  return json.data.positions.map(toPosition);
}
