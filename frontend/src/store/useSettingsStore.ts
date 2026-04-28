import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RiskProfile = "conservative" | "balanced" | "aggressive";

interface SettingsState {
  riskProfile: RiskProfile;
  setRiskProfile: (profile: RiskProfile) => void;
}

export const RISK_PROFILES: Array<{
  key: RiskProfile;
  label: string;
  description: string;
}> = [
  {
    key: "conservative",
    label: "Conservative",
    description:
      "Highest-TVL bluechips (Aave, Compound, Lido). Caps APY for safety.",
  },
  {
    key: "balanced",
    label: "Balanced",
    description: "Best APY across Morpho, Aave, Compound. Default.",
  },
  {
    key: "aggressive",
    label: "Aggressive",
    description:
      "Maximum APY across Pendle, Ethena, Yearn, Euler, EtherFi. Higher risk.",
  },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      riskProfile: "balanced",
      setRiskProfile: (profile) => set({ riskProfile: profile }),
    }),
    { name: "moai-settings-v1" },
  ),
);
