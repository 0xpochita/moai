import type { Hex, TypedDataDomain } from "viem";

export interface JsonSignedBatchedCall {
  batchedCall: {
    calls: Array<{ to: string; value: string; data: string }>;
    revertOnFailure: boolean;
  };
  nonce: string;
  keyHash: string;
  executor: string;
  deadline: string;
}

export interface BuildEnvelopeResult {
  typedData: {
    domain: TypedDataDomain;
    types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
    primaryType: string;
    message: JsonSignedBatchedCall;
  };
  signedBatchedCall: JsonSignedBatchedCall;
  agentAddress?: string;
  hookAddress?: string;
  revokedKeyHash?: string;
}

export interface RelayResult {
  txHash: Hex;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `${url} failed (${res.status})`);
  }
  return json;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `${url} failed (${res.status})`);
  }
  return json;
}

export interface AgentInfo {
  agentAddress: string;
  agentKeyHash: string;
  hookAddress: string;
}

export function fetchAgentInfo(): Promise<AgentInfo> {
  return getJson<AgentInfo>("/api/agent/info");
}

export interface AgentStatus {
  caliburDelegated: boolean;
  agentRegistered: boolean;
  agentAddress: string;
  agentKeyHash: string;
}

export function fetchAgentStatus(owner: string): Promise<AgentStatus> {
  return getJson<AgentStatus>(
    `/api/agent/status?owner=${encodeURIComponent(owner)}`,
  );
}

export function buildRegistration(owner: string): Promise<BuildEnvelopeResult> {
  return postJson<BuildEnvelopeResult>("/api/agent/build-registration", {
    owner,
  });
}

export function buildRevocation(owner: string): Promise<BuildEnvelopeResult> {
  return postJson<BuildEnvelopeResult>("/api/agent/build-revocation", {
    owner,
  });
}

export function relayAgent(args: {
  owner: string;
  signedBatchedCall: JsonSignedBatchedCall;
  signature: Hex;
}): Promise<RelayResult> {
  return postJson<RelayResult>("/api/agent/relay", args);
}

export interface MigrateNowResult {
  txHash: Hex;
  destination: string;
}

export function migrateNow(args: {
  owner: string;
  tokenId: string;
  riskProfile?: "conservative" | "balanced" | "aggressive";
}): Promise<MigrateNowResult> {
  return postJson<MigrateNowResult>("/api/agent/migrate-now", args);
}

export interface WithdrawNowResult {
  txHash: Hex;
  vaultName: string;
}

export function withdrawNow(args: {
  owner: string;
  vaultAddress: string;
}): Promise<WithdrawNowResult> {
  return postJson<WithdrawNowResult>("/api/agent/withdraw-now", args);
}
