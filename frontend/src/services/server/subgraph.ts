import type { Pool, PoolToken, RiskTier, UniswapVersion } from "@/types";

const SUBGRAPH_IDS: Record<UniswapVersion, string> = {
  v2: "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum",
  v3: "5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV",
  v4: "DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G",
};

const V3_V4_QUERY = `
  query TopPools($first: Int!) {
    pools(
      first: $first
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: { totalValueLockedUSD_gt: "100000" }
    ) {
      id
      feeTier
      totalValueLockedUSD
      volumeUSD
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
      }
    }
  }
`;

const V2_QUERY = `
  query TopPairs($first: Int!) {
    pairs(
      first: $first
      orderBy: reserveUSD
      orderDirection: desc
      where: { reserveUSD_gt: "100000" }
    ) {
      id
      reserveUSD
      volumeUSD
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      pairDayData(first: 7, orderBy: date, orderDirection: desc) {
        date
        dailyVolumeUSD
        reserveUSD
      }
    }
  }
`;

interface SubgraphToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
}

interface V3Pool {
  id: string;
  feeTier: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  poolDayData: { date: number; volumeUSD: string; feesUSD: string }[];
}

interface V2Pair {
  id: string;
  reserveUSD: string;
  volumeUSD: string;
  token0: SubgraphToken;
  token1: SubgraphToken;
  pairDayData: { date: number; dailyVolumeUSD: string; reserveUSD: string }[];
}

interface SubgraphResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

const V2_FEE_TIER_PERCENT = 0.3;

const UNISWAP_TOKEN_LIST_URL = "https://tokens.uniswap.org";

interface UniswapTokenListEntry {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface UniswapTokenList {
  tokens: UniswapTokenListEntry[];
}

async function getUniswapTokenLogos(
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  try {
    const res = await fetch(UNISWAP_TOKEN_LIST_URL, {
      signal,
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Map();
    const data = (await res.json()) as UniswapTokenList;
    const map = new Map<string, string>();
    for (const token of data.tokens) {
      if (
        token.chainId === 1 &&
        token.logoURI &&
        token.logoURI.startsWith("https://")
      ) {
        map.set(token.address.toLowerCase(), token.logoURI);
      }
    }
    return map;
  } catch (err) {
    console.warn("[subgraph] uniswap token list fetch failed:", err);
    return new Map();
  }
}

function tokenLogoUrl(
  address: string,
  uniswapLogos: Map<string, string>,
): string {
  const lower = address.toLowerCase();
  const fromList = uniswapLogos.get(lower);
  if (fromList) return fromList;
  return `https://tokens.1inch.io/${lower}.png`;
}

function classifyRisk(tvlUsd: number, apy: number): RiskTier {
  if (apy >= 25 || tvlUsd < 2_000_000) return "high";
  if (apy <= 4 && tvlUsd >= 40_000_000) return "low";
  return "medium";
}

function toPoolToken(
  raw: SubgraphToken,
  logos: Map<string, string>,
): PoolToken {
  return {
    address: raw.id,
    symbol: raw.symbol,
    name: raw.name,
    decimals: Number(raw.decimals),
    logoUrl: tokenLogoUrl(raw.id, logos),
  };
}

function endpoint(version: UniswapVersion): string {
  const apiKey = process.env.THEGRAPH_API_KEY;
  if (!apiKey) {
    throw new Error("THEGRAPH_API_KEY is not set");
  }
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${SUBGRAPH_IDS[version]}`;
}

async function postSubgraph<T>(
  version: UniswapVersion,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(endpoint(version), {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`subgraph ${version} request failed (${res.status})`);
  }

  const json = (await res.json()) as SubgraphResponse<T>;
  if (json.errors?.length) {
    throw new Error(`subgraph ${version} error: ${json.errors[0].message}`);
  }
  if (!json.data) {
    throw new Error(`subgraph ${version} returned no data`);
  }

  return json.data;
}

function v3PoolToPool(
  raw: V3Pool,
  version: "v3" | "v4",
  logos: Map<string, string>,
): Pool {
  const tvlUsd = Number(raw.totalValueLockedUSD);
  const day = raw.poolDayData[0];

  const apy =
    day && tvlUsd > 0 ? (Number(day.feesUSD) / tvlUsd) * 365 * 100 : 0;

  const window = raw.poolDayData.slice(0, 7);
  const apyMean =
    window.length > 0 && tvlUsd > 0
      ? (window.reduce((sum, d) => sum + Number(d.feesUSD), 0) /
          window.length /
          tvlUsd) *
        365 *
        100
      : apy;

  return {
    id: raw.id,
    symbol: `${raw.token0.symbol} / ${raw.token1.symbol}`,
    protocol: version,
    chain: "Ethereum",
    tvlUsd,
    apy,
    apyMean30d: apyMean,
    risk: classifyRisk(tvlUsd, apy),
    feeTier: Number(raw.feeTier) / 10_000,
    volumeUsd1d: day ? Number(day.volumeUSD) : undefined,
    token0: toPoolToken(raw.token0, logos),
    token1: toPoolToken(raw.token1, logos),
    source: "subgraph",
  };
}

function v2PairToPool(raw: V2Pair, logos: Map<string, string>): Pool {
  const tvlUsd = Number(raw.reserveUSD);
  const day = raw.pairDayData[0];
  const dayVolume = day ? Number(day.dailyVolumeUSD) : 0;

  const apy =
    tvlUsd > 0 && dayVolume > 0
      ? ((dayVolume * (V2_FEE_TIER_PERCENT / 100)) / tvlUsd) * 365 * 100
      : 0;

  const window = raw.pairDayData.slice(0, 7);
  const apyMean =
    window.length > 0 && tvlUsd > 0
      ? (window.reduce(
          (sum, d) =>
            sum + Number(d.dailyVolumeUSD) * (V2_FEE_TIER_PERCENT / 100),
          0,
        ) /
          window.length /
          tvlUsd) *
        365 *
        100
      : apy;

  return {
    id: raw.id,
    symbol: `${raw.token0.symbol} / ${raw.token1.symbol}`,
    protocol: "v2",
    chain: "Ethereum",
    tvlUsd,
    apy,
    apyMean30d: apyMean,
    risk: classifyRisk(tvlUsd, apy),
    feeTier: V2_FEE_TIER_PERCENT,
    volumeUsd1d: dayVolume || undefined,
    token0: toPoolToken(raw.token0, logos),
    token1: toPoolToken(raw.token1, logos),
    source: "subgraph",
  };
}

async function fetchV2(
  first: number,
  logos: Map<string, string>,
  signal?: AbortSignal,
): Promise<Pool[]> {
  const data = await postSubgraph<{ pairs: V2Pair[] }>(
    "v2",
    V2_QUERY,
    { first },
    signal,
  );
  return data.pairs.map((p) => v2PairToPool(p, logos));
}

async function fetchV3(
  first: number,
  logos: Map<string, string>,
  signal?: AbortSignal,
): Promise<Pool[]> {
  const data = await postSubgraph<{ pools: V3Pool[] }>(
    "v3",
    V3_V4_QUERY,
    { first },
    signal,
  );
  return data.pools.map((p) => v3PoolToPool(p, "v3", logos));
}

async function fetchV4(
  first: number,
  logos: Map<string, string>,
  signal?: AbortSignal,
): Promise<Pool[]> {
  const data = await postSubgraph<{ pools: V3Pool[] }>(
    "v4",
    V3_V4_QUERY,
    { first },
    signal,
  );
  return data.pools.map((p) => v3PoolToPool(p, "v4", logos));
}

export function isSubgraphConfigured(): boolean {
  return Boolean(process.env.THEGRAPH_API_KEY);
}

export async function fetchUniswapSubgraphPools(
  first = 50,
  signal?: AbortSignal,
): Promise<Pool[]> {
  if (!isSubgraphConfigured()) {
    throw new Error("THEGRAPH_API_KEY is not set");
  }

  const logos = await getUniswapTokenLogos(signal);

  const results = await Promise.allSettled([
    fetchV2(first, logos, signal),
    fetchV3(first, logos, signal),
    fetchV4(first, logos, signal),
  ]);

  const merged: Pool[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      console.warn("[subgraph] partial failure:", result.reason);
    }
  }

  if (merged.length === 0) {
    const firstError = results.find((r) => r.status === "rejected");
    throw firstError && firstError.status === "rejected"
      ? firstError.reason instanceof Error
        ? firstError.reason
        : new Error(String(firstError.reason))
      : new Error("All subgraph requests returned empty results");
  }

  return merged.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, first);
}
