import { NextResponse } from "next/server";
import {
  fetchDefiLlamaPools,
  fetchUniswapSubgraphPools,
  isSubgraphConfigured,
} from "@/services/server";
import type { Pool } from "@/types";

export const revalidate = 60;

const CACHE_HEADERS = {
  "cache-control": "s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: Request) {
  const signal = request.signal;

  const subgraphPromise = isSubgraphConfigured()
    ? fetchUniswapSubgraphPools(50, signal).catch((err) => {
        console.warn("[/api/pools] subgraph failed:", err);
        return [] as Pool[];
      })
    : Promise.resolve([] as Pool[]);

  const defillamaPromise = fetchDefiLlamaPools(signal, {
    excludeChains: ["Ethereum"],
    minTvl: 100_000,
    limit: 100,
  }).catch((err) => {
    console.warn("[/api/pools] defillama failed:", err);
    return [] as Pool[];
  });

  const [ethereumPools, otherChainPools] = await Promise.all([
    subgraphPromise,
    defillamaPromise,
  ]);

  if (signal.aborted) {
    return NextResponse.json({ error: "aborted" }, { status: 499 });
  }

  let merged = [...ethereumPools, ...otherChainPools];

  if (merged.length === 0) {
    try {
      merged = await fetchDefiLlamaPools(signal, { limit: 100 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Pool feed unavailable";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const pools = merged.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 100);

  const sources = {
    subgraph: ethereumPools.length,
    defillama: otherChainPools.length,
  };

  return NextResponse.json({ pools, sources }, { headers: CACHE_HEADERS });
}
