import { create } from "zustand";
import { persist } from "zustand/middleware";

const TRUSTED_PROTOCOLS = [
  "morpho-v1",
  "aave-v3",
  "compound-v3",
  "euler-v2",
  "ethena",
  "yearn-v3",
  "pendle",
  "etherfi",
  "lido",
  "yo-protocol",
] as const;

export type ProtocolKey = (typeof TRUSTED_PROTOCOLS)[number];

export type RiskProfile = "conservative" | "balanced" | "aggressive";

interface SettingsState {
  minApyPct: number;
  maxGasUsd: number;
  allowedProtocols: ProtocolKey[];
  riskProfile: RiskProfile;
  setMinApyPct: (pct: number) => void;
  setMaxGasUsd: (usd: number) => void;
  toggleProtocol: (key: ProtocolKey) => void;
  setRiskProfile: (profile: RiskProfile) => void;
  resetDefaults: () => void;
}

const DEFAULTS = {
  minApyPct: 3,
  maxGasUsd: 5,
  allowedProtocols: [...TRUSTED_PROTOCOLS] as ProtocolKey[],
  riskProfile: "balanced" as RiskProfile,
};

export const ALL_TRUSTED_PROTOCOLS: ProtocolKey[] = [...TRUSTED_PROTOCOLS];

export const RISK_PROFILES: Array<{
  key: RiskProfile;
  label: string;
  description: string;
}> = [
  {
    key: "conservative",
    label: "Conservative",
    description:
      "Highest-TVL bluechips (Aave, Morpho, Compound). Caps APY for safety.",
  },
  {
    key: "balanced",
    label: "Balanced",
    description: "Best APY across the trusted protocol list. Default.",
  },
  {
    key: "aggressive",
    label: "Aggressive",
    description:
      "Maximum APY with relaxed TVL floor. Higher risk, higher reward.",
  },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMinApyPct: (pct) =>
        set({ minApyPct: Math.max(0, Math.min(100, pct)) }),
      setMaxGasUsd: (usd) => set({ maxGasUsd: Math.max(0, usd) }),
      toggleProtocol: (key) =>
        set((s) => {
          const has = s.allowedProtocols.includes(key);
          return {
            allowedProtocols: has
              ? s.allowedProtocols.filter((p) => p !== key)
              : [...s.allowedProtocols, key],
          };
        }),
      setRiskProfile: (profile) => set({ riskProfile: profile }),
      resetDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: "moai-settings-v1" },
  ),
);
