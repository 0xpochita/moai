const ENDPOINT = "https://api.uniswap.org/v1/graphql";

const QUERY = `
  query TopV4Pools($chain: Chain!, $first: Int!) {
    topV4Pools(first: $first, chain: $chain) {
      poolId
      feeTier
      totalLiquidity { value }
      historicalVolume(duration: DAY) { value }
    }
  }
`;

interface V4PoolNode {
  poolId: string;
  feeTier: number;
  totalLiquidity: { value: number | null } | null;
  historicalVolume: { value: number | null }[] | null;
}

interface V4Response {
  data?: { topV4Pools: V4PoolNode[] };
  errors?: { message: string }[];
}

export interface PoolStats {
  poolId: string;
  tvlUsd: number;
  volume24hUsd: number;
  feeTierBps: number;
}

let cached: { ts: number; map: Map<string, PoolStats> } | null = null;
const CACHE_MS = 60_000;

async function loadAll(signal?: AbortSignal): Promise<Map<string, PoolStats>> {
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_MS) {
    return cached.map;
  }

  try {
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
      body: JSON.stringify({
        query: QUERY,
        variables: { chain: "BASE", first: 100 },
      }),
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`v4 stats failed (${res.status})`);
    const json = (await res.json()) as V4Response;
    if (json.errors?.length || !json.data) {
      throw new Error(json.errors?.[0]?.message ?? "v4 stats no data");
    }

    const map = new Map<string, PoolStats>();
    for (const node of json.data.topV4Pools) {
      const tvl = node.totalLiquidity?.value ?? 0;
      let volume24h = 0;
      for (const entry of node.historicalVolume ?? []) {
        if (typeof entry.value === "number" && Number.isFinite(entry.value)) {
          volume24h += entry.value;
        }
      }
      map.set(node.poolId.toLowerCase(), {
        poolId: node.poolId.toLowerCase(),
        tvlUsd: tvl,
        volume24hUsd: volume24h,
        feeTierBps: node.feeTier,
      });
    }

    cached = { ts: now, map };
    return map;
  } catch (err) {
    console.warn("[v4-stats] failed:", err);
    return cached?.map ?? new Map();
  }
}

export async function fetchV4PoolStats(
  poolId: string,
  signal?: AbortSignal,
): Promise<PoolStats | null> {
  const map = await loadAll(signal);
  return map.get(poolId.toLowerCase()) ?? null;
}
