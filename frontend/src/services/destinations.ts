import type { DestinationVault, PortfolioPosition } from "@/types";

interface DestinationsResponse {
  vaults: DestinationVault[];
  source?: string;
  error?: string;
}

interface PortfolioResponse {
  positions: PortfolioPosition[];
  error?: string;
}

export interface FetchDestinationsParams {
  chainId?: number;
  asset?: string;
  sortBy?: "apy" | "tvl";
  limit?: number;
}

export async function fetchDestinations(
  params: FetchDestinationsParams = {},
  signal?: AbortSignal,
): Promise<DestinationVault[]> {
  const search = new URLSearchParams();
  search.set("chainId", String(params.chainId ?? 8453));
  if (params.asset) search.set("asset", params.asset);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.limit !== undefined) search.set("limit", String(params.limit));

  const res = await fetch(`/api/destinations?${search.toString()}`, {
    signal,
    headers: { accept: "application/json" },
  });

  const json = (await res.json()) as DestinationsResponse;
  if (!res.ok || !Array.isArray(json.vaults)) {
    throw new Error(json.error ?? `destinations failed (${res.status})`);
  }
  return json.vaults;
}

export async function fetchPortfolioForWallet(
  address: string,
  signal?: AbortSignal,
): Promise<PortfolioPosition[]> {
  const res = await fetch(`/api/portfolio/${address}`, {
    signal,
    headers: { accept: "application/json" },
  });

  const json = (await res.json()) as PortfolioResponse;
  if (!res.ok || !Array.isArray(json.positions)) {
    throw new Error(json.error ?? `portfolio failed (${res.status})`);
  }
  return json.positions;
}
