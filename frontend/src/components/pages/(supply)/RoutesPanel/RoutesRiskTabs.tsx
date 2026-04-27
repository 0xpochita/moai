"use client";

import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib";
import { selectRiskCounts, usePoolsStore } from "@/store";
import type { RiskTier } from "@/types";

const TABS: { id: RiskTier | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export function RoutesRiskTabs() {
  const counts = usePoolsStore(useShallow(selectRiskCounts));
  const total = counts.low + counts.medium + counts.high;
  const active = usePoolsStore((s) => s.filter.risk);
  const setRisk = usePoolsStore((s) => s.setRisk);

  const countFor = (id: RiskTier | "all"): number =>
    id === "all" ? total : counts[id];

  return (
    <div className="bg-elevated inline-flex w-full items-center gap-0.5 rounded-full p-0.5">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            type="button"
            key={t.id}
            onClick={() => setRisk(t.id)}
            className={cn(
              "flex-1 rounded-full px-2 py-1 text-[11px] font-medium tracking-tight transition-colors",
              isActive ? "bg-brand text-white" : "text-muted hover:text-main",
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "ml-1 text-[9px]",
                isActive ? "text-white/70" : "text-muted-soft",
              )}
            >
              {countFor(t.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
