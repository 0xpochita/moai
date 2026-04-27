import type { Position } from "@/types";

interface PositionsResponse {
  positions: Position[];
  source?: string;
  error?: string;
}

export async function fetchPositions(
  address: string,
  signal?: AbortSignal,
): Promise<{ positions: Position[]; source: string }> {
  const res = await fetch(`/api/positions/${address}`, {
    signal,
    headers: { accept: "application/json" },
  });

  const json = (await res.json()) as PositionsResponse;
  if (!res.ok || !Array.isArray(json.positions)) {
    throw new Error(json.error ?? `positions feed failed (${res.status})`);
  }

  return {
    positions: json.positions,
    source: json.source ?? "unknown",
  };
}
