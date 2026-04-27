import { create } from "zustand";
import type { Timeframe } from "@/types";

interface SupplyState {
  amount: string;
  token: string;
  selectedPoolId: string | null;
  timeframe: Timeframe;
  setAmount: (amount: string) => void;
  setToken: (token: string) => void;
  selectPool: (id: string | null) => void;
  setTimeframe: (timeframe: Timeframe) => void;
}

export const useSupplyStore = create<SupplyState>((set) => ({
  amount: "1",
  token: "USDC",
  selectedPoolId: null,
  timeframe: "1Y",
  setAmount: (amount) => set({ amount }),
  setToken: (token) => set({ token }),
  selectPool: (selectedPoolId) => set({ selectedPoolId }),
  setTimeframe: (timeframe) => set({ timeframe }),
}));
