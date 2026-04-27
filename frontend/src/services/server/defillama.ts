import type { Pool, PoolToken, RiskTier, UniswapVersion } from "@/types";

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

const SUPPORTED_CHAINS = new Set([
  "Ethereum",
  "Arbitrum",
  "Base",
  "Polygon",
  "Optimism",
  "Unichain",
  "BSC",
  "Avalanche",
  "Celo",
  "Blast",
]);

const CHAIN_TO_DEXSCREENER: Record<string, string> = {
  Ethereum: "ethereum",
  Arbitrum: "arbitrum",
  Base: "base",
  Polygon: "polygon",
  Optimism: "optimism",
  Unichain: "unichain",
  BSC: "bsc",
  Avalanche: "avalanche",
  Celo: "celo",
  Blast: "blast",
};

interface RawPool {
  pool: string;
  symbol: string;
  project: string;
  chain: string;
  tvlUsd: number;
  apy: number | null;
  apyMean30d: number | null;
  poolMeta?: string | null;
  volumeUsd1d?: number | null;
  underlyingTokens?: string[] | null;
}

interface DefiLlamaResponse {
  status: string;
  data: RawPool[];
}

const PROTOCOL_PATTERN = /^uniswap-(v2|v3|v4)$/;
const FEE_TIER_PATTERN = /(\d+(?:\.\d+)?)\s*%/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function classifyProtocol(project: string): UniswapVersion | null {
  const match = project.match(PROTOCOL_PATTERN);
  if (!match) return null;
  return match[1] as UniswapVersion;
}

function classifyRisk(tvlUsd: number, apy: number): RiskTier {
  if (apy >= 25 || tvlUsd < 2_000_000) return "high";
  if (apy <= 4 && tvlUsd >= 40_000_000) return "low";
  return "medium";
}

function parseFeeTier(poolMeta: string | null | undefined): number | undefined {
  if (!poolMeta) return undefined;
  const match = poolMeta.match(FEE_TIER_PATTERN);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function splitSymbol(raw: string): string[] {
  return raw
    .split(/[-/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenLogoUrl(address: string, chain: string): string {
  const ds = CHAIN_TO_DEXSCREENER[chain] ?? "ethereum";
  return `https://dd.dexscreener.com/ds-data/tokens/${ds}/${address.toLowerCase()}.png`;
}

function buildToken(address: string, symbol: string, chain: string): PoolToken {
  return {
    address,
    symbol,
    name: symbol,
    decimals: 18,
    logoUrl: tokenLogoUrl(address, chain),
  };
}

function buildTokens(
  symbol: string,
  underlying: string[] | null | undefined,
  chain: string,
): { token0?: PoolToken; token1?: PoolToken } {
  if (!underlying || underlying.length < 2) return {};
  const symbols = splitSymbol(symbol);
  if (symbols.length < 2) return {};

  const addr0 = underlying[0];
  const addr1 = underlying[1];
  if (!ADDRESS_PATTERN.test(addr0) || !ADDRESS_PATTERN.test(addr1)) return {};

  return {
    token0: buildToken(addr0, symbols[0], chain),
    token1: buildToken(addr1, symbols[1], chain),
  };
}

function defaultFeeTier(protocol: UniswapVersion): number | undefined {
  if (protocol === "v2") return 0.3;
  return undefined;
}

function computeFees24h(
  volumeUsd1d: number | null | undefined,
  feeTier: number | undefined,
): number | undefined {
  if (!volumeUsd1d || !feeTier) return undefined;
  return volumeUsd1d * (feeTier / 100);
}

function toDefiLlamaPool(raw: RawPool, protocol: UniswapVersion): Pool {
  const apy = raw.apy ?? 0;
  const symbols = splitSymbol(raw.symbol);
  const displaySymbol =
    symbols.length >= 2 ? symbols.slice(0, 2).join(" / ") : raw.symbol;
  const { token0, token1 } = buildTokens(
    raw.symbol,
    raw.underlyingTokens,
    raw.chain,
  );
  const feeTier = parseFeeTier(raw.poolMeta) ?? defaultFeeTier(protocol);

  return {
    id: raw.pool,
    symbol: displaySymbol,
    protocol,
    chain: raw.chain,
    tvlUsd: raw.tvlUsd,
    apy,
    apyMean30d: raw.apyMean30d ?? apy,
    risk: classifyRisk(raw.tvlUsd, apy),
    feeTier,
    volumeUsd1d: raw.volumeUsd1d ?? undefined,
    fees24hUsd: computeFees24h(raw.volumeUsd1d, feeTier),
    token0,
    token1,
    source: "defillama",
  };
}

interface FetchOptions {
  excludeChains?: string[];
  minTvl?: number;
  limit?: number;
}

export async function fetchDefiLlamaPools(
  signal?: AbortSignal,
  options: FetchOptions = {},
): Promise<Pool[]> {
  const { excludeChains = [], minTvl = 250_000, limit = 100 } = options;
  const exclude = new Set(excludeChains);

  const res = await fetch(DEFILLAMA_YIELDS_URL, {
    signal,
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`pool feed unavailable (${res.status})`);
  }

  const json = (await res.json()) as DefiLlamaResponse;
  if (json.status !== "success" || !Array.isArray(json.data)) {
    throw new Error("pool feed returned an unexpected shape");
  }

  const result: Pool[] = [];
  for (const raw of json.data) {
    if (!SUPPORTED_CHAINS.has(raw.chain)) continue;
    if (exclude.has(raw.chain)) continue;
    const protocol = classifyProtocol(raw.project);
    if (!protocol) continue;
    if (raw.tvlUsd < minTvl) continue;
    result.push(toDefiLlamaPool(raw, protocol));
  }

  return result.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, limit);
}
