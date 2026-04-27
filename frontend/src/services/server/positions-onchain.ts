import {
  type Address,
  encodeAbiParameters,
  getAddress,
  type Hex,
  keccak256,
  parseAbiItem,
  zeroAddress,
} from "viem";
import { getLocalTokenLogo } from "@/lib/token-logos";
import {
  getAmountsForLiquidity,
  priceFromSqrtPriceX96,
  rawAmountToFloat,
} from "@/lib/v3-math";
import type { Position, PositionStatus, PositionToken } from "@/types";
import { fetchV4PoolStats } from "./uniswap-v4-stats";
import { baseClient } from "./viem-client";

const STABLECOINS: Record<string, true> = {
  USDC: true,
  USDT: true,
  DAI: true,
  USDBC: true,
  PYUSD: true,
};

function isStable(symbol: string): boolean {
  return Boolean(STABLECOINS[symbol.toUpperCase()]);
}

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const POSITION_MANAGER_V3: Address = getAddress(
  "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
);
const FACTORY_V3: Address = getAddress(
  "0x33128a8fc17869897dce68ed026d694621f6fdfd",
);

const POSITION_MANAGER_V4: Address = getAddress(
  "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
);
const STATE_VIEW_V4: Address = getAddress(
  process.env.BASE_V4_STATEVIEW_ADDRESS ??
    "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
);

const ERC721_ENUMERABLE_ABI = [
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
] as const;

const POSITION_MANAGER_V3_ABI = [
  ...ERC721_ENUMERABLE_ABI,
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

const POSITION_MANAGER_V4_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "getPoolAndPositionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { type: "uint256" },
    ],
  },
  {
    name: "getPositionLiquidity",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

const FACTORY_V3_ABI = [
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

const POOL_V3_ABI = [
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

const STATE_VIEW_V4_ABI = [
  {
    name: "getSlot0",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
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

const ETH_TOKEN: PositionToken = {
  address: zeroAddress,
  symbol: "ETH",
  decimals: 18,
  logoUrl:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
};

function dexscreenerLogo(address: Address): string {
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

function unpackTickFromInfo(info: bigint, shiftBits: number): number {
  const raw = Number((info >> BigInt(shiftBits)) & 0xffffffn);
  return raw & 0x800000 ? raw - 0x1000000 : raw;
}

function computePoolId(poolKey: {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}): Hex {
  const encoded = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "uint24" },
      { type: "int24" },
      { type: "address" },
    ],
    [
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
    ],
  );
  return keccak256(encoded);
}

async function fetchTokenMeta(token: Address): Promise<{
  symbol: string;
  decimals: number;
}> {
  if (token.toLowerCase() === zeroAddress) {
    return { symbol: "ETH", decimals: 18 };
  }
  const normalized = getAddress(token);
  const [symbol, decimals] = await Promise.all([
    baseClient
      .readContract({
        address: normalized,
        abi: ERC20_ABI,
        functionName: "symbol",
      })
      .catch((err) => {
        console.warn(`[token] symbol(${normalized}) failed:`, err);
        return "?";
      }),
    baseClient
      .readContract({
        address: normalized,
        abi: ERC20_ABI,
        functionName: "decimals",
      })
      .catch((err) => {
        console.warn(`[token] decimals(${normalized}) failed:`, err);
        return 18;
      }),
  ]);
  return { symbol, decimals: Number(decimals) };
}

function buildToken(
  address: Address,
  symbol: string,
  decimals: number,
): PositionToken {
  if (address.toLowerCase() === zeroAddress) return ETH_TOKEN;
  const normalized = getAddress(address);
  const local = getLocalTokenLogo(normalized);
  return {
    address: normalized,
    symbol,
    decimals,
    logoUrl: local ?? dexscreenerLogo(normalized),
  };
}

interface RawV3Position {
  tokenId: bigint;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}

async function fetchV3Positions(
  owner: Address,
  signal?: AbortSignal,
): Promise<Position[]> {
  const balance = await baseClient.readContract({
    address: POSITION_MANAGER_V3,
    abi: POSITION_MANAGER_V3_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
  const count = Number(balance);
  if (count === 0) return [];
  if (signal?.aborted) throw new Error("aborted");

  const tokenIds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      baseClient.readContract({
        address: POSITION_MANAGER_V3,
        abi: POSITION_MANAGER_V3_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [owner, BigInt(i)],
      }),
    ),
  );

  const raw: RawV3Position[] = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const result = await baseClient.readContract({
        address: POSITION_MANAGER_V3,
        abi: POSITION_MANAGER_V3_ABI,
        functionName: "positions",
        args: [tokenId],
      });
      return {
        tokenId,
        token0: result[2],
        token1: result[3],
        fee: result[4],
        tickLower: result[5],
        tickUpper: result[6],
        liquidity: result[7],
      };
    }),
  );

  return Promise.all(raw.map((p) => enrichV3Position(p, owner)));
}

async function enrichV3Position(
  raw: RawV3Position,
  owner: Address,
): Promise<Position> {
  const poolAddress = await baseClient.readContract({
    address: FACTORY_V3,
    abi: FACTORY_V3_ABI,
    functionName: "getPool",
    args: [raw.token0, raw.token1, raw.fee],
  });

  const [slot0, token0Meta, token1Meta] = await Promise.all([
    baseClient.readContract({
      address: poolAddress,
      abi: POOL_V3_ABI,
      functionName: "slot0",
    }),
    fetchTokenMeta(raw.token0),
    fetchTokenMeta(raw.token1),
  ]);

  const currentTick = slot0[1];
  const feeTierPercent = raw.fee / 10_000;
  const tokenIdStr = raw.tokenId.toString();

  return {
    id: `base#v3#${tokenIdStr}`,
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

interface RawV4Position {
  tokenId: bigint;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
}

async function fetchV4OwnedTokenIds(
  owner: Address,
  signal?: AbortSignal,
): Promise<bigint[]> {
  const balance = await baseClient
    .readContract({
      address: POSITION_MANAGER_V4,
      abi: POSITION_MANAGER_V4_ABI,
      functionName: "balanceOf",
      args: [owner],
    })
    .catch((err) => {
      console.warn("[v4] balanceOf failed:", err);
      return 0n;
    });
  if (balance === 0n) return [];

  const lookback = BigInt(process.env.BASE_V4_LOG_LOOKBACK_BLOCKS ?? "300000");
  const chunkSize = BigInt(process.env.BASE_V4_LOG_CHUNK ?? "9999");
  const concurrency = Number(process.env.BASE_V4_LOG_CONCURRENCY ?? "4");

  const latest = await baseClient.getBlockNumber();
  const fromBlock = latest > lookback ? latest - lookback : 0n;

  const ranges: Array<[bigint, bigint]> = [];
  let end = latest;
  while (end > fromBlock) {
    const start = end >= chunkSize ? end - chunkSize + 1n : 0n;
    const startCapped = start > fromBlock ? start : fromBlock;
    ranges.push([startCapped, end]);
    if (startCapped === fromBlock) break;
    end = startCapped - 1n;
  }

  const candidates = new Set<bigint>();
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(([start, last]) =>
        baseClient
          .getLogs({
            address: POSITION_MANAGER_V4,
            event: TRANSFER_EVENT,
            args: { to: owner },
            fromBlock: start,
            toBlock: last,
          })
          .catch(() => []),
      ),
    );
    for (const logs of results) {
      for (const log of logs) {
        const tokenId = log.args?.tokenId;
        if (typeof tokenId === "bigint") candidates.add(tokenId);
      }
    }
    if (BigInt(candidates.size) >= balance) break;
  }

  if (candidates.size === 0) return [];

  const verified: bigint[] = [];
  await Promise.all(
    Array.from(candidates).map(async (tokenId) => {
      const owner_ = await baseClient
        .readContract({
          address: POSITION_MANAGER_V4,
          abi: POSITION_MANAGER_V4_ABI,
          functionName: "ownerOf",
          args: [tokenId],
        })
        .catch(() => null);
      if (owner_ && owner_.toLowerCase() === owner.toLowerCase()) {
        verified.push(tokenId);
      }
    }),
  );

  return verified;
}

async function fetchV4Positions(
  owner: Address,
  signal?: AbortSignal,
): Promise<Position[]> {
  const tokenIds = await fetchV4OwnedTokenIds(owner, signal);
  if (tokenIds.length === 0) return [];
  if (signal?.aborted) throw new Error("aborted");

  const raw: RawV4Position[] = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const [pool, info] = await baseClient.readContract({
        address: POSITION_MANAGER_V4,
        abi: POSITION_MANAGER_V4_ABI,
        functionName: "getPoolAndPositionInfo",
        args: [tokenId],
      });
      const liquidity = await baseClient.readContract({
        address: POSITION_MANAGER_V4,
        abi: POSITION_MANAGER_V4_ABI,
        functionName: "getPositionLiquidity",
        args: [tokenId],
      });
      return {
        tokenId,
        currency0: pool.currency0,
        currency1: pool.currency1,
        fee: pool.fee,
        tickSpacing: pool.tickSpacing,
        hooks: pool.hooks,
        tickLower: unpackTickFromInfo(info, 8),
        tickUpper: unpackTickFromInfo(info, 32),
        liquidity,
      };
    }),
  );

  return Promise.all(raw.map((p) => enrichV4Position(p, owner)));
}

async function enrichV4Position(
  raw: RawV4Position,
  owner: Address,
): Promise<Position> {
  const poolId = computePoolId({
    currency0: raw.currency0,
    currency1: raw.currency1,
    fee: raw.fee,
    tickSpacing: raw.tickSpacing,
    hooks: raw.hooks,
  });

  const [slot0Result, token0Meta, token1Meta, poolStats] = await Promise.all([
    baseClient
      .readContract({
        address: STATE_VIEW_V4,
        abi: STATE_VIEW_V4_ABI,
        functionName: "getSlot0",
        args: [poolId],
      })
      .catch(() => null),
    fetchTokenMeta(raw.currency0),
    fetchTokenMeta(raw.currency1),
    fetchV4PoolStats(poolId).catch(() => null),
  ]);

  const sqrtPriceX96 = slot0Result ? slot0Result[0] : null;
  const currentTick = slot0Result ? slot0Result[1] : raw.tickLower;
  const feeTierPercent = raw.fee / 10_000;
  const tokenIdStr = raw.tokenId.toString();

  let valueUsd = 0;
  if (sqrtPriceX96 !== null && raw.liquidity > 0n) {
    const { amount0, amount1 } = getAmountsForLiquidity(
      sqrtPriceX96,
      raw.tickLower,
      raw.tickUpper,
      raw.liquidity,
    );
    const token0Sym = token0Meta.symbol.toUpperCase();
    const token1Sym = token1Meta.symbol.toUpperCase();
    const isToken0Stable = isStable(token0Sym);
    const isToken1Stable = isStable(token1Sym);

    const amount0Float = rawAmountToFloat(amount0, token0Meta.decimals);
    const amount1Float = rawAmountToFloat(amount1, token1Meta.decimals);

    if (isToken0Stable && isToken1Stable) {
      valueUsd = amount0Float + amount1Float;
    } else if (isToken1Stable) {
      const priceToken1InToken0 = priceFromSqrtPriceX96(
        sqrtPriceX96,
        token0Meta.decimals,
        token1Meta.decimals,
      );
      const token0PriceUsd = priceToken1InToken0;
      valueUsd = amount0Float * token0PriceUsd + amount1Float;
    } else if (isToken0Stable) {
      const priceToken1InToken0 = priceFromSqrtPriceX96(
        sqrtPriceX96,
        token0Meta.decimals,
        token1Meta.decimals,
      );
      const token1PriceUsd =
        priceToken1InToken0 > 0 ? 1 / priceToken1InToken0 : 0;
      valueUsd = amount0Float + amount1Float * token1PriceUsd;
    }
  }

  let aprMin = 0;
  let aprMax = 0;
  if (poolStats && poolStats.tvlUsd > 0 && poolStats.volume24hUsd > 0) {
    const dailyFees = poolStats.volume24hUsd * (feeTierPercent / 100);
    const apr = (dailyFees / poolStats.tvlUsd) * 365 * 100;
    aprMin = apr;
    aprMax = apr;
  }

  return {
    id: `base#v4#${tokenIdStr}`,
    tokenId: tokenIdStr,
    owner: owner.toLowerCase(),
    network: "base",
    protocol: "v4",
    feeTier: feeTierPercent,
    status: classifyStatus(
      currentTick,
      raw.tickLower,
      raw.tickUpper,
      raw.liquidity,
    ),
    delegated: false,
    valueUsd,
    poolTvlUsd: poolStats?.tvlUsd ?? 0,
    uncollectedFeesUsd: 0,
    yieldDayUsd: 0,
    token0: buildToken(raw.currency0, token0Meta.symbol, token0Meta.decimals),
    token1: buildToken(raw.currency1, token1Meta.symbol, token1Meta.decimals),
    tokenLongName0: token0Meta.symbol,
    tokenLongName1: token1Meta.symbol,
    tickLower: raw.tickLower,
    tickUpper: raw.tickUpper,
    currentTick,
    sparkline: generateSparkline(tokenIdStr),
    poolAddress: poolId,
    createdAtSec: Math.floor(Date.now() / 1000),
    volume24hUsd: poolStats?.volume24hUsd ?? 0,
    aprMin,
    aprMax,
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

  const [v3, v4] = await Promise.all([
    fetchV3Positions(owner, signal).catch((err) => {
      console.warn("[positions-onchain] v3 read failed:", err);
      return [] as Position[];
    }),
    fetchV4Positions(owner, signal).catch((err) => {
      console.warn("[positions-onchain] v4 read failed:", err);
      return [] as Position[];
    }),
  ]);

  if (signal?.aborted) throw new Error("aborted");

  return [...v3, ...v4].filter((p) => p.status !== "closed");
}
