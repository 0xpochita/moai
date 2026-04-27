import type { MigrationPlan } from "@/types";

interface PlanResponse {
  plan?: MigrationPlan;
  error?: string;
}

export async function fetchMigrationPlan(
  owner: string,
  tokenId: string,
  signal?: AbortSignal,
): Promise<MigrationPlan> {
  const res = await fetch("/api/migrate/plan", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ owner, tokenId }),
  });

  const json = (await res.json()) as PlanResponse;
  if (!res.ok || !json.plan) {
    throw new Error(json.error ?? `migration plan failed (${res.status})`);
  }
  return json.plan;
}
