import { NextResponse } from "next/server";
import {
  fetchDefiLlamaPools,
  fetchUniswapSubgraphPools,
  isSubgraphConfigured,
} from "@/services/server";

export const revalidate = 60;

export async function GET(request: Request) {
  const signal = request.signal;

  if (isSubgraphConfigured()) {
    try {
      const pools = await fetchUniswapSubgraphPools(50, signal);
      if (pools.length > 0) {
        return NextResponse.json(
          { pools, source: "subgraph" },
          {
            headers: {
              "cache-control": "s-maxage=60, stale-while-revalidate=300",
            },
          },
        );
      }
    } catch (err) {
      if (signal.aborted) {
        return NextResponse.json({ error: "aborted" }, { status: 499 });
      }
      console.warn("[/api/pools] subgraph failed:", err);
    }
  }

  try {
    const pools = await fetchDefiLlamaPools(signal);
    return NextResponse.json(
      { pools, source: "defillama" },
      {
        headers: { "cache-control": "s-maxage=60, stale-while-revalidate=300" },
      },
    );
  } catch (err) {
    if (signal.aborted) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const message =
      err instanceof Error ? err.message : "Pool feed unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
