import type { Hex } from "viem";
import { create } from "zustand";
import {
  fetchMigrationPlan,
  fetchWithdrawalPlan,
  migrateNow,
  withdrawNow,
} from "@/services";
import type { MigrationPlan, MigrationStatus } from "@/types";
import { useAgentActionsStore } from "./useAgentActionsStore";
import { useSettingsStore } from "./useSettingsStore";

interface ExecuteParams {
  owner?: string | null;
}

interface MigrationState {
  status: MigrationStatus;
  plan: MigrationPlan | null;
  error: string | null;
  controller: AbortController | null;
  open: boolean;
  txHash: Hex | null;
  /// vault address (for withdrawals) — needed when re-submitting via agent.
  withdrawalTarget: string | null;
  start: (owner: string, tokenId: string) => Promise<void>;
  startWithdrawal: (owner: string, vaultAddress: string) => Promise<void>;
  cancel: () => void;
  execute: (params?: ExecuteParams) => Promise<void>;
  dismiss: () => void;
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
  status: "idle",
  plan: null,
  error: null,
  controller: null,
  open: false,
  txHash: null,
  withdrawalTarget: null,
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
      withdrawalTarget: null,
    });
    try {
      const riskProfile = useSettingsStore.getState().riskProfile;
      const plan = await fetchMigrationPlan(owner, tokenId, {
        riskProfile,
        signal: next.signal,
      });
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
      withdrawalTarget: vaultAddress,
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
      withdrawalTarget: null,
    });
  },
  execute: async (params) => {
    const { plan, withdrawalTarget } = get();
    if (!plan) return;
    if (!params?.owner) {
      set({ status: "error", error: "Wallet not connected" });
      return;
    }
    set({ status: "executing", error: null });

    try {
      const owner = params.owner;
      const agentActions = useAgentActionsStore.getState();
      let txHash: Hex;

      if (plan.intent === "withdraw") {
        if (!withdrawalTarget) throw new Error("Missing vault address");
        const result = await withdrawNow({
          owner,
          vaultAddress: withdrawalTarget,
        });
        txHash = result.txHash;
        agentActions.recordWithdrawal(plan.source.pair, txHash);
      } else {
        const riskProfile = useSettingsStore.getState().riskProfile;
        const result = await migrateNow({
          owner,
          tokenId: plan.positionTokenId,
          riskProfile,
        });
        txHash = result.txHash;
        agentActions.recordMigration(
          plan.positionTokenId,
          `${plan.destination.protocolName} ${plan.destination.name}`,
          txHash,
        );
      }

      set({ status: "complete", txHash });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Agent execution failed";
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
      withdrawalTarget: null,
    });
  },
}));
