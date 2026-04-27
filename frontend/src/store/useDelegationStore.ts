import type { Address, PublicClient } from "viem";
import { create } from "zustand";
import { readDelegationStatus } from "@/lib";

export type DelegationStoreStatus =
  | "idle"
  | "checking"
  | "delegated"
  | "not-delegated"
  | "error";

interface DelegationState {
  status: DelegationStoreStatus;
  walletAddress: Address | null;
  delegateAddress: Address | null;
  error: string | null;
  lastCheckedSec: number;
  controller: AbortController | null;
  check: (client: PublicClient, address: Address) => Promise<void>;
  markDelegated: (delegate: Address) => void;
  markNotDelegated: () => void;
  clear: () => void;
}

export const useDelegationStore = create<DelegationState>((set, get) => ({
  status: "idle",
  walletAddress: null,
  delegateAddress: null,
  error: null,
  lastCheckedSec: 0,
  controller: null,
  check: async (client, address) => {
    const { controller } = get();
    controller?.abort();
    const next = new AbortController();
    set({
      status: "checking",
      walletAddress: address,
      error: null,
      controller: next,
    });

    try {
      const result = await readDelegationStatus(client, address);
      if (next.signal.aborted) return;
      set({
        status: result.isDelegated ? "delegated" : "not-delegated",
        delegateAddress: result.delegateAddress,
        lastCheckedSec: Math.floor(Date.now() / 1000),
        controller: null,
      });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not read delegation";
      set({ status: "error", error: message, controller: null });
    }
  },
  markDelegated: (delegate) =>
    set({
      status: "delegated",
      delegateAddress: delegate,
      lastCheckedSec: Math.floor(Date.now() / 1000),
    }),
  markNotDelegated: () =>
    set({
      status: "not-delegated",
      delegateAddress: null,
      lastCheckedSec: Math.floor(Date.now() / 1000),
    }),
  clear: () => {
    get().controller?.abort();
    set({
      status: "idle",
      walletAddress: null,
      delegateAddress: null,
      error: null,
      lastCheckedSec: 0,
      controller: null,
    });
  },
}));
