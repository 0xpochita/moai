import { create } from "zustand";
import { fetchDestinations } from "@/services";
import type { DestinationVault, FetchStatus } from "@/types";

interface DestinationsState {
  vaults: DestinationVault[];
  status: FetchStatus;
  error: string | null;
  controller: AbortController | null;
  load: (asset?: string) => Promise<void>;
  retry: () => Promise<void>;
}

export const useDestinationsStore = create<DestinationsState>((set, get) => ({
  vaults: [],
  status: "idle",
  error: null,
  controller: null,
  load: async (asset = "USDC") => {
    const { controller, status } = get();
    if (status === "loading") return;
    controller?.abort();

    const next = new AbortController();
    set({ status: "loading", error: null, controller: next });

    try {
      const vaults = await fetchDestinations(
        { chainId: 8453, asset, sortBy: "apy", limit: 12 },
        next.signal,
      );
      if (next.signal.aborted) return;
      set({ vaults, status: "success", controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not load destinations";
      set({ status: "error", error: message, controller: null });
    }
  },
  retry: async () => {
    set({ status: "idle", error: null });
    await get().load();
  },
}));
