import { create } from "zustand";
import { fetchMigrationPlan } from "@/services";
import type { MigrationPlan, MigrationStatus } from "@/types";
import { useAgentActionsStore } from "./useAgentActionsStore";

interface MigrationState {
  status: MigrationStatus;
  plan: MigrationPlan | null;
  error: string | null;
  controller: AbortController | null;
  open: boolean;
  start: (owner: string, tokenId: string) => Promise<void>;
  cancel: () => void;
  execute: () => Promise<void>;
  dismiss: () => void;
}

export const useMigrationStore = create<MigrationState>((set, get) => ({
  status: "idle",
  plan: null,
  error: null,
  controller: null,
  open: false,
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
  cancel: () => {
    get().controller?.abort();
    set({
      status: "idle",
      plan: null,
      error: null,
      controller: null,
      open: false,
    });
  },
  execute: async () => {
    const { plan } = get();
    if (!plan) return;
    set({ status: "executing", error: null });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const mockTxHash =
        `0x${Math.random().toString(16).slice(2).padStart(64, "0")}` as const;
      useAgentActionsStore
        .getState()
        .recordMigration(
          plan.positionTokenId,
          `${plan.destination.protocolName} ${plan.destination.name}`,
          mockTxHash,
        );
      set({ status: "complete" });
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
    });
  },
}));
