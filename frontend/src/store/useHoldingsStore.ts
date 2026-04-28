import { create } from "zustand";
import { fetchPortfolioForWallet } from "@/services";
import type { FetchStatus, PortfolioPosition } from "@/types";

interface HoldingsState {
  status: FetchStatus;
  positions: PortfolioPosition[];
  error: string | null;
  ownerAddress: string | null;
  controller: AbortController | null;
  load: (address: string) => Promise<void>;
  clear: () => void;
}

export const useHoldingsStore = create<HoldingsState>((set, get) => ({
  status: "idle",
  positions: [],
  error: null,
  ownerAddress: null,
  controller: null,
  load: async (address) => {
    get().controller?.abort();
    const next = new AbortController();
    set({
      status: "loading",
      error: null,
      ownerAddress: address,
      controller: next,
    });
    try {
      const positions = await fetchPortfolioForWallet(address, next.signal);
      if (next.signal.aborted) return;
      set({ status: "success", positions, controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not load holdings";
      set({ status: "error", error: message, controller: null });
    }
  },
  clear: () => {
    get().controller?.abort();
    set({
      status: "idle",
      positions: [],
      error: null,
      ownerAddress: null,
      controller: null,
    });
  },
}));
