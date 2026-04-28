import type { MigrationPlan } from "@/types";

interface PlanResponse {
  plan?: MigrationPlan;
  error?: string;
}

export type RiskProfileWire = "conservative" | "balanced" | "aggressive";

export async function fetchMigrationPlan(
  owner: string,
  tokenId: string,
  options?: { riskProfile?: RiskProfileWire; signal?: AbortSignal },
): Promise<MigrationPlan> {
  const res = await fetch("/api/migrate/plan", {
    method: "POST",
    signal: options?.signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      owner,
      tokenId,
      riskProfile: options?.riskProfile,
    }),
  });

  const json = (await res.json()) as PlanResponse;
  if (!res.ok || !json.plan) {
    throw new Error(json.error ?? `migration plan failed (${res.status})`);
  }
  return json.plan;
}

export async function fetchWithdrawalPlan(
  owner: string,
  vaultAddress: string,
  signal?: AbortSignal,
): Promise<MigrationPlan> {
  const res = await fetch("/api/migrate/withdraw", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ owner, vaultAddress }),
  });

  const json = (await res.json()) as PlanResponse;
  if (!res.ok || !json.plan) {
    throw new Error(json.error ?? `withdrawal plan failed (${res.status})`);
  }
  return json.plan;
}
