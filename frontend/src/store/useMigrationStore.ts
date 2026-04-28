import type { Address, Hex, WalletClient } from "viem";
import { create } from "zustand";
import {
  getGuardedHookAddress,
  type HookCall,
  submitMigrationBatch,
} from "@/lib";
import { fetchMigrationPlan, fetchWithdrawalPlan } from "@/services";
import type { MigrationPlan, MigrationStatus } from "@/types";
import { useAgentActionsStore } from "./useAgentActionsStore";

const BASE_CHAIN_ID = 8453;

interface ExecuteParams {
  walletClient?: WalletClient | null;
}

interface MigrationState {
  status: MigrationStatus;
  plan: MigrationPlan | null;
  error: string | null;
  controller: AbortController | null;
  open: boolean;
  txHash: Hex | null;
  start: (owner: string, tokenId: string) => Promise<void>;
  startWithdrawal: (owner: string, vaultAddress: string) => Promise<void>;
  cancel: () => void;
  execute: (params?: ExecuteParams) => Promise<void>;
  dismiss: () => void;
}

function legsToHookCalls(plan: MigrationPlan): HookCall[] {
  const calls: HookCall[] = [];
  for (const leg of plan.legs) {
    if (!leg.calldata) continue;
    calls.push({
      target: leg.targetAddress as Address,
      value: leg.value ? BigInt(leg.value) : 0n,
      data: leg.calldata as Hex,
    });
  }
  return calls;
}

function randomMockTxHash(): Hex {
  const hex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `0x${hex}` as Hex;
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
  status: "idle",
  plan: null,
  error: null,
  controller: null,
  open: false,
  txHash: null,
  start: async (owner, tokenId) => {
    const { controller } = get();
    controller?.abort();
    const next = new AbortController();
    set({
      status: "planning",
      plan: null,
      error: null,
      controller: next,
      open: true,
      txHash: null,
    });
    try {
      const plan = await fetchMigrationPlan(owner, tokenId, next.signal);
      if (next.signal.aborted) return;
      set({ status: "ready", plan, controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not plan migration";
      set({ status: "error", error: message, controller: null });
    }
  },
  startWithdrawal: async (owner, vaultAddress) => {
    const { controller } = get();
    controller?.abort();
    const next = new AbortController();
    set({
      status: "planning",
      plan: null,
      error: null,
      controller: next,
      open: true,
      txHash: null,
    });
    try {
      const plan = await fetchWithdrawalPlan(owner, vaultAddress, next.signal);
      if (next.signal.aborted) return;
      set({ status: "ready", plan, controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not plan withdrawal";
      set({ status: "error", error: message, controller: null });
    }
  },
  cancel: () => {
    get().controller?.abort();
    set({
      status: "idle",
      plan: null,
      error: null,
      controller: null,
      open: false,
      txHash: null,
    });
  },
  execute: async (params) => {
    const { plan } = get();
    if (!plan) return;
    set({ status: "executing", error: null });

    const hookAddress = getGuardedHookAddress();
    const walletClient = params?.walletClient ?? null;
    const calls = legsToHookCalls(plan);
    const canSubmit = Boolean(
      walletClient && hookAddress && calls.length === plan.legs.length,
    );

    try {
      let txHash: Hex;
      if (canSubmit && walletClient) {
        txHash = await submitMigrationBatch({
          walletClient,
          calls,
          chainId: BASE_CHAIN_ID,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        txHash = randomMockTxHash();
      }

      const agentActions = useAgentActionsStore.getState();
      if (plan.intent === "withdraw") {
        agentActions.recordWithdrawal(plan.source.pair, txHash);
      } else {
        agentActions.recordMigration(
          plan.positionTokenId,
          `${plan.destination.protocolName} ${plan.destination.name}`,
          txHash,
        );
      }
      set({ status: "complete", txHash });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Migration failed";
      set({ status: "error", error: message });
    }
  },
  dismiss: () => {
    set({
      status: "idle",
      plan: null,
      error: null,
      open: false,
      txHash: null,
    });
  },
}));
