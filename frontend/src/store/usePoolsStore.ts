import { create } from "zustand";
import { fetchUniswapMainnetPools } from "@/services";
import type {
  FetchStatus,
  Pool,
  PoolFilter,
  RiskTier,
  UniswapVersion,
} from "@/types";

interface PoolsState {
  pools: Pool[];
  status: FetchStatus;
  error: string | null;
  filter: PoolFilter;
  controller: AbortController | null;
  load: () => Promise<void>;
  retry: () => Promise<void>;
  setProtocol: (protocol: UniswapVersion | "all") => void;
  setRisk: (risk: RiskTier | "all") => void;
}

const INITIAL_FILTER: PoolFilter = { protocol: "all", risk: "all" };

export const usePoolsStore = create<PoolsState>((set, get) => ({
  pools: [],
  status: "idle",
  error: null,
  filter: INITIAL_FILTER,
  controller: null,
  load: async () => {
    const { status, controller } = get();
    if (status === "loading") return;
    controller?.abort();

    const next = new AbortController();
    set({ status: "loading", error: null, controller: next });

    try {
      const pools = await fetchUniswapMainnetPools(next.signal);
      if (next.signal.aborted) return;
      set({ pools, status: "success", controller: null });
    } catch (err) {
      if (next.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "Could not load pools";
      set({ status: "error", error: message, controller: null });
    }
  },
  retry: async () => {
    set({ status: "idle", error: null });
    await get().load();
  },
  setProtocol: (protocol) =>
    set((state) => ({ filter: { ...state.filter, protocol } })),
  setRisk: (risk) => set((state) => ({ filter: { ...state.filter, risk } })),
}));

export function selectFilteredPools(state: PoolsState): Pool[] {
  const { pools, filter } = state;
  return pools.filter((pool) => {
    if (filter.protocol !== "all" && pool.protocol !== filter.protocol)
      return false;
    if (filter.risk !== "all" && pool.risk !== filter.risk) return false;
    return true;
  });
}

export function selectRiskCounts(state: PoolsState): Record<RiskTier, number> {
  return state.pools.reduce(
    (acc, pool) => {
      acc[pool.risk] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 } as Record<RiskTier, number>,
  );
}
