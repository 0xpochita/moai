import type { Pool, PoolToken, RiskTier, UniswapVersion } from "@/types";

const ENDPOINT = "https://api.uniswap.org/v1/graphql";

type UniswapChain =
  | "ETHEREUM"
  | "OPTIMISM"
  | "ARBITRUM"
  | "POLYGON"
  | "BASE"
  | "BNB"
  | "BLAST"
  | "AVALANCHE"
  | "CELO"
  | "UNICHAIN"
  | "WORLDCHAIN";

const CHAIN_DISPLAY: Record<UniswapChain, string> = {
  ETHEREUM: "Ethereum",
  OPTIMISM: "Optimism",
  ARBITRUM: "Arbitrum",
  POLYGON: "Polygon",
  BASE: "Base",
  BNB: "BSC",
  BLAST: "Blast",
  AVALANCHE: "Avalanche",
  CELO: "Celo",
  UNICHAIN: "Unichain",
  WORLDCHAIN: "Worldchain",
};

const DEFAULT_CHAINS: UniswapChain[] = [
  "ETHEREUM",
  "ARBITRUM",
  "BASE",
  "OPTIMISM",
  "POLYGON",
  "UNICHAIN",
  "BNB",
  "AVALANCHE",
];

const QUERY = `
  query TopV3Pools($chain: Chain!, $first: Int!) {
    topV3Pools(first: $first, chain: $chain) {
      id
      address
      protocolVersion
      feeTier
      txCount
      totalLiquidity { value }
      historicalVolume(duration: DAY) { value timestamp }
      token0 {
        id
        address
        symbol
        name
        decimals
        project { logo { url } }
      }
      token1 {
        id
        address
        symbol
        name
        decimals
        project { logo { url } }
      }
    }
  }
`;

interface UToken {
  id: string;
  address: string | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  project?: { logo?: { url?: string | null } | null } | null;
}

interface HistoricalEntry {
  value: number | null;
  timestamp: number;
}

interface UV3Pool {
  id: string;
  address: string | null;
  protocolVersion: string;
  feeTier: number;
  txCount?: number | null;
  totalLiquidity: { value: number | null } | null;
  historicalVolume: HistoricalEntry[] | null;
  token0: UToken;
  token1: UToken;
}

interface UResponse {
  data?: { topV3Pools: UV3Pool[] };
  errors?: { message: string }[];
}

function parseProtocol(v: string): UniswapVersion {
  const upper = v.toUpperCase();
  if (upper === "V2") return "v2";
  if (upper === "V4") return "v4";
  return "v3";
}

function classifyRisk(tvlUsd: number, apy: number): RiskTier {
  if (apy >= 25 || tvlUsd < 2_000_000) return "high";
  if (apy <= 4 && tvlUsd >= 40_000_000) return "low";
  return "medium";
}

function logoFor(token: UToken): string {
  const fromProject = token.project?.logo?.url;
  if (fromProject?.startsWith("https://")) return fromProject;
  const lower = (token.address ?? "").toLowerCase();
  return `https://tokens.1inch.io/${lower}.png`;
}

function toPoolToken(raw: UToken): PoolToken {
  return {
    address: raw.address ?? "",
    symbol: raw.symbol ?? "?",
    name: raw.name ?? raw.symbol ?? "?",
    decimals: raw.decimals ?? 18,
    logoUrl: logoFor(raw),
  };
}

function sumVolume(entries: HistoricalEntry[] | null): number {
  if (!entries) return 0;
  let sum = 0;
  for (const e of entries) {
    if (typeof e.value === "number" && Number.isFinite(e.value)) {
      sum += e.value;
    }
  }
  return sum;
}

function toPool(raw: UV3Pool, chainDisplay: string): Pool {
  const tvl = raw.totalLiquidity?.value ?? 0;
  const volume24h = sumVolume(raw.historicalVolume);
  const feeTierPercent = raw.feeTier / 10_000;
  const fees24h = volume24h * (feeTierPercent / 100);
  const apy = tvl > 0 && fees24h > 0 ? (fees24h / tvl) * 365 * 100 : 0;
  const id = (raw.address ?? raw.id).toLowerCase();

  return {
    id,
    symbol: `${raw.token0.symbol ?? "?"} / ${raw.token1.symbol ?? "?"}`,
    protocol: parseProtocol(raw.protocolVersion),
    chain: chainDisplay,
    tvlUsd: tvl,
    apy,
    apyMean30d: apy,
    risk: classifyRisk(tvl, apy),
    feeTier: feeTierPercent,
    volumeUsd1d: volume24h || undefined,
    fees24hUsd: fees24h || undefined,
    token0: toPoolToken(raw.token0),
    token1: toPoolToken(raw.token1),
    source: "uniswap-explore",
  };
}

async function queryChain(
  chain: UniswapChain,
  first: number,
  signal?: AbortSignal,
): Promise<Pool[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      origin: "https://app.uniswap.org",
      referer: "https://app.uniswap.org/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "x-request-source": "uniswap-web",
    },
    body: JSON.stringify({ query: QUERY, variables: { chain, first } }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`uniswap-explore ${chain} failed (${res.status})`);
  }

  const json = (await res.json()) as UResponse;
  if (json.errors?.length) {
    throw new Error(`uniswap-explore ${chain}: ${json.errors[0].message}`);
  }

  const pools = json.data?.topV3Pools ?? [];
  const display = CHAIN_DISPLAY[chain];
  return pools.map((p) => toPool(p, display));
}

export async function fetchUniswapExplorePools(
  chains: UniswapChain[] = DEFAULT_CHAINS,
  perChain = 25,
  signal?: AbortSignal,
): Promise<Pool[]> {
  const results = await Promise.allSettled(
    chains.map((c) => queryChain(c, perChain, signal)),
  );

  const merged: Pool[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      console.warn("[uniswap-explore] chain failed:", result.reason);
    }
  }

  return merged;
}
