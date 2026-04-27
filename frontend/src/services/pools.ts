import type { Pool, RiskTier, UniswapVersion } from "@/types";

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

interface RawPool {
  pool: string;
  symbol: string;
  project: string;
  chain: string;
  tvlUsd: number;
  apy: number | null;
  apyMean30d: number | null;
}

interface DefiLlamaResponse {
  status: string;
  data: RawPool[];
}

const PROTOCOL_PATTERN = /^uniswap-(v2|v3|v4)$/;

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

function toPool(raw: RawPool, protocol: UniswapVersion): Pool {
  const apy = raw.apy ?? 0;
  return {
    id: raw.pool,
    symbol: raw.symbol,
    protocol,
    chain: raw.chain,
    tvlUsd: raw.tvlUsd,
    apy,
    apyMean30d: raw.apyMean30d ?? apy,
    risk: classifyRisk(raw.tvlUsd, apy),
  };
}

export async function fetchUniswapMainnetPools(
  signal?: AbortSignal,
): Promise<Pool[]> {
  const res = await fetch(DEFILLAMA_YIELDS_URL, {
    signal,
    headers: { accept: "application/json" },
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
    if (raw.chain !== "Ethereum") continue;
    const protocol = classifyProtocol(raw.project);
    if (!protocol) continue;
    if (raw.tvlUsd < 250_000) continue;
    result.push(toPool(raw, protocol));
  }

  return result.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 30);
}
