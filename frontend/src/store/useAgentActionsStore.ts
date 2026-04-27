import { create } from "zustand";
import type { AgentAction, AgentActionType } from "@/types";

interface AgentActionsState {
  actions: AgentAction[];
  recordMigration: (
    positionTokenId: string,
    destination: string,
    txHash?: string,
  ) => void;
  recordDelegation: (delegateAddress: string) => void;
  reset: () => void;
}

const NOW = (): number => Math.floor(Date.now() / 1000);

function seedActions(): AgentAction[] {
  const now = NOW();
  return [
    {
      id: "seed-1",
      type: "migrate" satisfies AgentActionType,
      title: "Migrate",
      description: "Moved out-of-range #2118308 → Morpho USDC vault",
      destination: "Morpho USDC vault",
      txHash:
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      positionTokenId: "2118308",
      createdAtSec: now - 24 * 60,
    },
    {
      id: "seed-2",
      type: "migrate" satisfies AgentActionType,
      title: "Migrate",
      description: "Out-of-range detected for #2118308, planning migration",
      positionTokenId: "2118308",
      createdAtSec: now - 25 * 60,
    },
    {
      id: "seed-3",
      type: "migrate" satisfies AgentActionType,
      title: "Migrate",
      description: "Moved out-of-range #2118314 → Aerodrome ETH/USDT 0.05%",
      destination: "Aerodrome ETH/USDT 0.05%",
      txHash:
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      positionTokenId: "2118314",
      createdAtSec: now - 25 * 60,
    },
    {
      id: "seed-4",
      type: "migrate" satisfies AgentActionType,
      title: "Migrate",
      description: "Out-of-range detected for #2118314, planning migration",
      positionTokenId: "2118314",
      createdAtSec: now - 25 * 60,
    },
    {
      id: "seed-5",
      type: "delegation" satisfies AgentActionType,
      title: "Delegation",
      description: "Delegation set up for 0xd9810099…",
      txHash:
        "0x0000000000000000000000000000000000000000000000000000000000000003",
      createdAtSec: now - 25 * 60,
    },
  ];
}

export const useAgentActionsStore = create<AgentActionsState>((set) => ({
  actions: seedActions(),
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
  reset: () => set({ actions: seedActions() }),
}));
