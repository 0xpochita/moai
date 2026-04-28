"use client";

import { ShieldCheck, Sparkles, Target } from "lucide-react";
import { RISK_PROFILES, type RiskProfile, useSettingsStore } from "@/store";

const ICON_MAP: Record<RiskProfile, typeof ShieldCheck> = {
  conservative: ShieldCheck,
  balanced: Target,
  aggressive: Sparkles,
};

type Props = {
  variant?: "stacked" | "grid";
};

export function RiskProfilePicker({ variant = "stacked" }: Props) {
  const value = useSettingsStore((s) => s.riskProfile);
  const setValue = useSettingsStore((s) => s.setRiskProfile);

  const layout =
    variant === "grid" ? "grid grid-cols-3 gap-1.5" : "flex flex-col gap-1.5";

  return (
    <div className={layout}>
      {RISK_PROFILES.map(({ key, label, description }) => {
        const Icon = ICON_MAP[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setValue(key)}
            aria-pressed={active}
            className={`flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors ${
              active
                ? "bg-brand-soft text-brand ring-1 ring-brand"
                : "bg-surface text-muted ring-soft hover:text-main"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-semibold tracking-tight">
                {label}
              </span>
            </div>
            {variant === "stacked" && (
              <p className="text-muted-soft text-[10px] leading-snug">
                {description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
