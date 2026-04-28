import { create } from "zustand";
import { type AgentStatus, fetchAgentStatus } from "@/services";

interface AgentStatusState {
  status: AgentStatus | null;
  isLoading: boolean;
  ownerAddress: string | null;
  error: string | null;
  refresh: (owner: string) => Promise<void>;
  clear: () => void;
}

export const useAgentStatusStore = create<AgentStatusState>((set, get) => ({
  status: null,
  isLoading: false,
  ownerAddress: null,
  error: null,
  refresh: async (owner) => {
    if (get().isLoading && get().ownerAddress === owner) return;
    set({ isLoading: true, ownerAddress: owner, error: null });
    try {
      const status = await fetchAgentStatus(owner);
      set({ status, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load agent status";
      set({ status: null, error: message, isLoading: false });
    }
  },
  clear: () =>
    set({ status: null, ownerAddress: null, error: null, isLoading: false }),
}));
