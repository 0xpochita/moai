import { NextResponse } from "next/server";
import {
  fetchDefiLlamaPools,
  fetchUniswapExplorePools,
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

  const explorePromise = fetchUniswapExplorePools(undefined, 25, signal).catch(
    (err) => {
      console.warn("[/api/pools] uniswap explore failed:", err);
      return [] as Pool[];
    },
  );

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

  const [explore, subgraph, defillama] = await Promise.all([
    explorePromise,
    subgraphPromise,
    defillamaPromise,
  ]);

  if (signal.aborted) {
    return NextResponse.json({ error: "aborted" }, { status: 499 });
  }

  const map = new Map<string, Pool>();
  for (const p of defillama) map.set(p.id.toLowerCase(), p);
  for (const p of subgraph) map.set(p.id.toLowerCase(), p);
  for (const p of explore) map.set(p.id.toLowerCase(), p);

  const pools = Array.from(map.values())
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 100);

  if (pools.length === 0) {
    return NextResponse.json(
      { error: "all pool sources unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      pools,
      sources: {
        explore: explore.length,
        subgraph: subgraph.length,
        defillama: defillama.length,
      },
    },
    { headers: CACHE_HEADERS },
  );
}
