import type { AgentAction } from "@/types";

export interface KeeperSubscription {
  address: string;
  subscribedAtSec: number;
  lastCheckedAtSec: number | null;
  lastResult: "idle" | "no-action" | "migrated" | "error";
  lastError: string | null;
}

export interface KeeperTickStats {
  lastTickAtSec: number;
  lastTickProcessed: number;
  lastTickMigrations: number;
  totalTicks: number;
}

export interface KeeperStatus {
  subscription?: KeeperSubscription | null;
  subscriptions?: number;
  tickStats: KeeperTickStats;
  hookConfigured: boolean;
  keeperWalletConfigured: boolean;
  autoExecuteEnabled: boolean;
}

export async function subscribeKeeper(
  address: string,
  signal?: AbortSignal,
): Promise<KeeperSubscription> {
  const res = await fetch("/api/keeper/subscribe", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const json = (await res.json()) as {
    subscription?: KeeperSubscription;
    error?: string;
  };
  if (!res.ok || !json.subscription) {
    throw new Error(json.error ?? `subscribe failed (${res.status})`);
  }
  return json.subscription;
}

export async function unsubscribeKeeper(
  address: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const res = await fetch("/api/keeper/unsubscribe", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const json = (await res.json()) as { removed?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `unsubscribe failed (${res.status})`);
  }
  return json.removed ?? false;
}

export async function fetchKeeperStatus(
  address?: string,
  signal?: AbortSignal,
): Promise<KeeperStatus> {
  const url = new URL("/api/keeper/status", window.location.origin);
  if (address) url.searchParams.set("address", address);
  const res = await fetch(url.toString(), { signal });
  const json = (await res.json()) as KeeperStatus;
  if (!res.ok) {
    throw new Error("status failed");
  }
  return json;
}

export async function fetchKeeperActivity(
  address: string,
  signal?: AbortSignal,
): Promise<AgentAction[]> {
  const res = await fetch(`/api/keeper/activity/${address}`, { signal });
  const json = (await res.json()) as { actions?: AgentAction[] };
  if (!res.ok || !Array.isArray(json.actions)) return [];
  return json.actions;
}
