import type { AgentAction } from "@/types";

export interface SubscriptionRecord {
  address: string;
  subscribedAtSec: number;
  lastCheckedAtSec: number | null;
  lastResult: "idle" | "no-action" | "migrated" | "error";
  lastError: string | null;
}

const subscriptions = new Map<string, SubscriptionRecord>();
const activityByAddress = new Map<string, AgentAction[]>();
const cooldowns = new Map<string, number>();
const tickStats = {
  lastTickAtSec: 0,
  lastTickProcessed: 0,
  lastTickMigrations: 0,
  totalTicks: 0,
};

const ACTIVITY_LIMIT = 50;
const COOLDOWN_SEC = Number(process.env.KEEPER_COOLDOWN_SEC ?? "3600");

function key(address: string): string {
  return address.toLowerCase();
}

function cooldownKey(address: string, tokenId: string): string {
  return `${key(address)}#${tokenId}`;
}

export function subscribe(address: string): SubscriptionRecord {
  const k = key(address);
  const existing = subscriptions.get(k);
  if (existing) return existing;
  const record: SubscriptionRecord = {
    address: k,
    subscribedAtSec: Math.floor(Date.now() / 1000),
    lastCheckedAtSec: null,
    lastResult: "idle",
    lastError: null,
  };
  subscriptions.set(k, record);
  return record;
}

export function unsubscribe(address: string): boolean {
  return subscriptions.delete(key(address));
}

export function isSubscribed(address: string): boolean {
  return subscriptions.has(key(address));
}

export function getSubscription(address: string): SubscriptionRecord | null {
  return subscriptions.get(key(address)) ?? null;
}

export function listSubscriptions(): SubscriptionRecord[] {
  return Array.from(subscriptions.values());
}

export function updateSubscription(
  address: string,
  patch: Partial<SubscriptionRecord>,
): void {
  const k = key(address);
  const existing = subscriptions.get(k);
  if (!existing) return;
  subscriptions.set(k, { ...existing, ...patch });
}

export function getCooldown(address: string, tokenId: string): number {
  return cooldowns.get(cooldownKey(address, tokenId)) ?? 0;
}

export function setCooldown(
  address: string,
  tokenId: string,
  sec: number,
): void {
  cooldowns.set(cooldownKey(address, tokenId), sec);
}

export function isCoolingDown(address: string, tokenId: string): boolean {
  const last = getCooldown(address, tokenId);
  if (last === 0) return false;
  return Math.floor(Date.now() / 1000) - last < COOLDOWN_SEC;
}

export function recordActivity(address: string, action: AgentAction): void {
  const k = key(address);
  const existing = activityByAddress.get(k) ?? [];
  const next = [action, ...existing].slice(0, ACTIVITY_LIMIT);
  activityByAddress.set(k, next);
}

export function listActivities(address: string): AgentAction[] {
  return activityByAddress.get(key(address)) ?? [];
}

export function getTickStats() {
  return { ...tickStats };
}

export function recordTick(processed: number, migrations: number): void {
  tickStats.lastTickAtSec = Math.floor(Date.now() / 1000);
  tickStats.lastTickProcessed = processed;
  tickStats.lastTickMigrations = migrations;
  tickStats.totalTicks += 1;
}
