import { create } from "zustand";
import type { AgentAction } from "@/types";

interface AgentActionsState {
  actions: AgentAction[];
  remoteActions: AgentAction[];
  recordMigration: (
    positionTokenId: string,
    destination: string,
    txHash?: string,
  ) => void;
  recordDelegation: (delegateAddress: string) => void;
  recordWithdrawal: (vaultLabel: string, txHash?: string) => void;
  setRemoteActions: (actions: AgentAction[]) => void;
  reset: () => void;
}

const NOW = (): number => Math.floor(Date.now() / 1000);

export const useAgentActionsStore = create<AgentActionsState>((set) => ({
  actions: [],
  remoteActions: [],
  recordMigration: (positionTokenId, destination, txHash) =>
    set((state) => {
      const action: AgentAction = {
        id: `${Date.now()}-migrate`,
        type: "migrate",
        title: "Migrate",
        description: `Moved out-of-range #${positionTokenId} → ${destination}`,
        destination,
        txHash,
        positionTokenId,
        createdAtSec: NOW(),
      };
      return { actions: [action, ...state.actions].slice(0, 50) };
    }),
  recordDelegation: (delegateAddress) =>
    set((state) => {
      const action: AgentAction = {
        id: `${Date.now()}-delegation`,
        type: "delegation",
        title: "Delegation",
        description: `Delegation set up for ${delegateAddress.slice(0, 10)}…`,
        createdAtSec: NOW(),
      };
      return { actions: [action, ...state.actions].slice(0, 50) };
    }),
  recordWithdrawal: (vaultLabel, txHash) =>
    set((state) => {
      const action: AgentAction = {
        id: `${Date.now()}-exit`,
        type: "exit",
        title: "Withdraw",
        description: `Redeemed ${vaultLabel} → wallet`,
        txHash,
        createdAtSec: NOW(),
      };
      return { actions: [action, ...state.actions].slice(0, 50) };
    }),
  setRemoteActions: (remoteActions) => set({ remoteActions }),
  reset: () => set({ actions: [], remoteActions: [] }),
}));
