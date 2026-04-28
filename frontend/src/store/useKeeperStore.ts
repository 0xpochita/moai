import { create } from "zustand";
import {
  fetchKeeperActivity,
  fetchKeeperStatus,
  type KeeperStatus,
  type KeeperSubscription,
  subscribeKeeper,
  unsubscribeKeeper,
} from "@/services";
import type { AgentAction, FetchStatus } from "@/types";
import { useAgentActionsStore } from "./useAgentActionsStore";

interface KeeperState {
  status: FetchStatus;
  subscription: KeeperSubscription | null;
  meta: KeeperStatus | null;
  error: string | null;
  pollHandle: ReturnType<typeof setInterval> | null;
  ownerAddress: string | null;
  loadStatus: (address: string) => Promise<void>;
  enable: (address: string) => Promise<void>;
  disable: (address: string) => Promise<void>;
  startPolling: (address: string, intervalMs?: number) => void;
  stopPolling: () => void;
}

async function syncRemoteActivity(address: string): Promise<void> {
  try {
    const actions = await fetchKeeperActivity(address);
    useAgentActionsStore.getState().setRemoteActions(actions);
  } catch {
    // ignore: keeper offline / not configured
  }
}

export const useKeeperStore = create<KeeperState>((set, get) => ({
  status: "idle",
  subscription: null,
  meta: null,
  error: null,
  pollHandle: null,
  ownerAddress: null,
  loadStatus: async (address) => {
    set({ status: "loading", error: null, ownerAddress: address });
    try {
      const meta = await fetchKeeperStatus(address);
      set({
        status: "success",
        meta,
        subscription: meta.subscription ?? null,
      });
      await syncRemoteActivity(address);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "keeper status failed";
      set({ status: "error", error: message });
    }
  },
  enable: async (address) => {
    const subscription = await subscribeKeeper(address);
    set({ subscription });
    await get().loadStatus(address);
  },
  disable: async (address) => {
    await unsubscribeKeeper(address);
    set({ subscription: null });
    await get().loadStatus(address);
  },
  startPolling: (address, intervalMs = 15_000) => {
    get().stopPolling();
    void get().loadStatus(address);
    const handle = setInterval(() => {
      void get().loadStatus(address);
    }, intervalMs);
    set({ pollHandle: handle });
  },
  stopPolling: () => {
    const handle = get().pollHandle;
    if (handle) clearInterval(handle);
    set({ pollHandle: null });
    useAgentActionsStore.getState().setRemoteActions([] as AgentAction[]);
  },
}));
