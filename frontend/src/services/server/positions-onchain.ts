import type { Address } from "viem";
import type { Position, PositionStatus, PositionToken } from "@/types";
import { baseClient } from "./viem-client";

const POSITION_MANAGER_V3: Address =
  "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const FACTORY_V3: Address = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";

const POSITION_MANAGER_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

const FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const POOL_ABI = [
  {
    name: "slot0",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

interface RawPosition {
  tokenId: bigint;
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

function tokenLogoUrl(address: Address): string {
  return `https://dd.dexscreener.com/ds-data/tokens/base/${address.toLowerCase()}.png`;
}

function classifyStatus(
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): PositionStatus {
  if (liquidity <= 0n) return "closed";
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

async function fetchTokenIds(
  owner: Address,
  signal?: AbortSignal,
): Promise<bigint[]> {
  const balance = await baseClient.readContract({
    address: POSITION_MANAGER_V3,
    abi: POSITION_MANAGER_ABI,
    functionName: "balanceOf",
    args: [owner],
  });

  const count = Number(balance);
  if (count === 0) return [];
  if (signal?.aborted) throw new Error("aborted");

  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      baseClient.readContract({
        address: POSITION_MANAGER_V3,
        abi: POSITION_MANAGER_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, BigInt(i)],
      }),
    ),
  );
}

async function fetchRawPosition(tokenId: bigint): Promise<RawPosition> {
  const result = await baseClient.readContract({
    address: POSITION_MANAGER_V3,
    abi: POSITION_MANAGER_ABI,
    functionName: "positions",
    args: [tokenId],
  });

  return {
    tokenId,
    nonce: result[0],
    operator: result[1],
    token0: result[2],
    token1: result[3],
    fee: result[4],
    tickLower: result[5],
    tickUpper: result[6],
    liquidity: result[7],
    tokensOwed0: result[10],
    tokensOwed1: result[11],
  };
}

async function fetchPoolAddress(
  token0: Address,
  token1: Address,
  fee: number,
): Promise<Address> {
  return baseClient.readContract({
    address: FACTORY_V3,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [token0, token1, fee],
  });
}

async function fetchPoolTick(pool: Address): Promise<number> {
  const slot0 = await baseClient.readContract({
    address: pool,
    abi: POOL_ABI,
    functionName: "slot0",
  });
  return slot0[1];
}

async function fetchTokenMeta(token: Address): Promise<{
  symbol: string;
  decimals: number;
}> {
  const [symbol, decimals] = await Promise.all([
    baseClient
      .readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "symbol",
      })
      .catch(() => "?"),
    baseClient
      .readContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "decimals",
      })
      .catch(() => 18),
  ]);
  return { symbol, decimals: Number(decimals) };
}

function buildToken(
  address: Address,
  symbol: string,
  decimals: number,
): PositionToken {
  return {
    address,
    symbol,
    decimals,
    logoUrl: tokenLogoUrl(address),
  };
}

async function enrichPosition(
  raw: RawPosition,
  owner: Address,
): Promise<Position> {
  const poolAddress = await fetchPoolAddress(raw.token0, raw.token1, raw.fee);
  const [currentTick, token0Meta, token1Meta] = await Promise.all([
    fetchPoolTick(poolAddress),
    fetchTokenMeta(raw.token0),
    fetchTokenMeta(raw.token1),
  ]);

  const feeTierPercent = raw.fee / 10_000;
  const tokenIdStr = raw.tokenId.toString();

  return {
    id: `base#${tokenIdStr}`,
    tokenId: tokenIdStr,
    owner: owner.toLowerCase(),
    network: "base",
    protocol: "v3",
    feeTier: feeTierPercent,
    status: classifyStatus(
      currentTick,
      raw.tickLower,
      raw.tickUpper,
      raw.liquidity,
    ),
    delegated: false,
    valueUsd: 0,
    poolTvlUsd: 0,
    uncollectedFeesUsd: 0,
    yieldDayUsd: 0,
    token0: buildToken(raw.token0, token0Meta.symbol, token0Meta.decimals),
    token1: buildToken(raw.token1, token1Meta.symbol, token1Meta.decimals),
    tokenLongName0: token0Meta.symbol,
    tokenLongName1: token1Meta.symbol,
    tickLower: raw.tickLower,
    tickUpper: raw.tickUpper,
    currentTick,
    sparkline: generateSparkline(tokenIdStr),
    poolAddress,
    createdAtSec: Math.floor(Date.now() / 1000),
    volume24hUsd: 0,
    aprMin: 0,
    aprMax: 0,
  };
}

export async function fetchPositionsOnChain(
  ownerAddress: string,
  signal?: AbortSignal,
): Promise<Position[]> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
    throw new Error("Invalid owner address");
  }
  const owner = ownerAddress as Address;

  const tokenIds = await fetchTokenIds(owner, signal);
  if (tokenIds.length === 0) return [];

  const rawPositions = await Promise.all(tokenIds.map(fetchRawPosition));
  if (signal?.aborted) throw new Error("aborted");

  const enriched = await Promise.all(
    rawPositions.map((raw) => enrichPosition(raw, owner)),
  );
  return enriched.filter((p) => p.status !== "closed");
}
