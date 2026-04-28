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

interface SettingsState {
  minApyPct: number;
  maxGasUsd: number;
  allowedProtocols: ProtocolKey[];
  setMinApyPct: (pct: number) => void;
  setMaxGasUsd: (usd: number) => void;
  toggleProtocol: (key: ProtocolKey) => void;
  resetDefaults: () => void;
}

const DEFAULTS = {
  minApyPct: 3,
  maxGasUsd: 5,
  allowedProtocols: [...TRUSTED_PROTOCOLS] as ProtocolKey[],
};

export const ALL_TRUSTED_PROTOCOLS: ProtocolKey[] = [...TRUSTED_PROTOCOLS];

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
      resetDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: "moai-settings-v1" },
  ),
);
