import type { Pool } from "@/types";

interface PoolsResponse {
  pools: Pool[];
  source?: "subgraph" | "defillama";
  error?: string;
}

export async function fetchUniswapMainnetPools(
  signal?: AbortSignal,
): Promise<Pool[]> {
  const res = await fetch("/api/pools", {
    signal,
    headers: { accept: "application/json" },
  });

  const json = (await res.json()) as PoolsResponse;

  if (!res.ok || !Array.isArray(json.pools)) {
    throw new Error(json.error ?? `pool feed unavailable (${res.status})`);
  }

  return json.pools;
}
