import { create } from "zustand";
import { fetchPositions } from "@/services";
import type { FetchStatus, Position } from "@/types";

interface PositionsState {
  positions: Position[];
  status: FetchStatus;
  error: string | null;
  source: string;
  ownerAddress: string | null;
  controller: AbortController | null;
  load: (address: string) => Promise<void>;
  retry: () => Promise<void>;
  clear: () => void;
}

export const usePositionsStore = create<PositionsState>((set, get) => ({
  positions: [],
  status: "idle",
  error: null,
  source: "",
  ownerAddress: null,
  controller: null,
  load: async (address) => {
    const { controller } = get();
    controller?.abort();

    const next = new AbortController();
    set({
      status: "loading",
      error: null,
      ownerAddress: address,
      controller: next,
    });

    try {
      const { positions, source } = await fetchPositions(address, next.signal);
      if (next.signal.aborted) return;
      set({ positions, status: "success", source, controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Failed to load positions";
      set({ status: "error", error: message, controller: null });
    }
  },
  retry: async () => {
    const { ownerAddress } = get();
    if (!ownerAddress) return;
    set({ status: "idle", error: null });
    await get().load(ownerAddress);
  },
  clear: () => {
    get().controller?.abort();
    set({
      positions: [],
      status: "idle",
      error: null,
      source: "",
      ownerAddress: null,
      controller: null,
    });
  },
}));

export function selectTotals(state: PositionsState): {
  totalValueUsd: number;
  totalYieldDayUsd: number;
} {
  let totalValueUsd = 0;
  let totalYieldDayUsd = 0;
  for (const p of state.positions) {
    totalValueUsd += p.valueUsd;
    totalYieldDayUsd += p.yieldDayUsd;
  }
  return { totalValueUsd, totalYieldDayUsd };
}
