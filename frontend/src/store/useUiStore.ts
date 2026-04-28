import { create } from "zustand";

interface UiState {
  delegationModalOpen: boolean;
  openDelegationModal: () => void;
  closeDelegationModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  delegationModalOpen: false,
  openDelegationModal: () => set({ delegationModalOpen: true }),
  closeDelegationModal: () => set({ delegationModalOpen: false }),
}));
