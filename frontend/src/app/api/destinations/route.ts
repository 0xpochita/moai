import { NextResponse } from "next/server";
import { fetchVaults } from "@/services/server";

export const revalidate = 60;

const CACHE_HEADERS = {
  "cache-control": "s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId") ?? "8453");
  const asset = url.searchParams.get("asset") ?? undefined;
  const sortByParam = url.searchParams.get("sortBy");
  const sortBy =
    sortByParam === "tvl" || sortByParam === "apy" ? sortByParam : "apy";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam), 50) : 12;
  const minTvlParam = url.searchParams.get("minTvl");
  const minTvlUsd = minTvlParam ? Number(minTvlParam) : undefined;
  const trustedOnly = url.searchParams.get("trusted") !== "0";

  if (!Number.isFinite(chainId) || chainId <= 0) {
    return NextResponse.json({ error: "Invalid chainId" }, { status: 400 });
  }

  try {
    const vaults = await fetchVaults(
      { chainId, asset, sortBy, limit, trustedOnly, minTvlUsd },
      request.signal,
    );
    return NextResponse.json(
      { vaults, source: "lifi-earn" },
      { headers: CACHE_HEADERS },
    );
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const message =
      err instanceof Error ? err.message : "destinations feed failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
