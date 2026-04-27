"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui";
import {
  cn,
  formatPercent,
  formatUsd,
  projectYield,
  safeParseAmount,
} from "@/lib";
import { selectFilteredPools, usePoolsStore, useSupplyStore } from "@/store";
import type { Pool, Timeframe } from "@/types";

const TIMEFRAMES: { id: Timeframe; days: number }[] = [
  { id: "1Y", days: 365 },
  { id: "1M", days: 30 },
  { id: "1W", days: 7 },
  { id: "1D", days: 1 },
];

function pickPool(pools: Pool[], selectedId: string | null): Pool | null {
  if (!pools.length) return null;
  if (selectedId) {
    const match = pools.find((p) => p.id === selectedId);
    if (match) return match;
  }
  return pools[0] ?? null;
}

export function SupplyEstimatedYield() {
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const selectedPoolId = useSupplyStore((s) => s.selectedPoolId);
  const amount = useSupplyStore((s) => s.amount);
  const timeframe = useSupplyStore((s) => s.timeframe);
  const setTimeframe = useSupplyStore((s) => s.setTimeframe);

  const pool = useMemo(
    () => pickPool(filtered, selectedPoolId),
    [filtered, selectedPoolId],
  );
  const numericAmount = safeParseAmount(amount);

  const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? 365;
  const projected = pool
    ? projectYield(numericAmount, pool.apy, days) - numericAmount
    : 0;

  const apyLabel = pool ? formatPercent(pool.apy) : "—";
  const sourceLabel = pool ? `via Uniswap ${pool.protocol}` : "select a pool";

  return (
    <div className="bg-elevated rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
          Estimated yield
        </div>
        <Badge tone="neutral">{apyLabel} APY</Badge>
      </div>

      <div className="bg-surface ring-soft mt-2.5 inline-flex w-full rounded-full p-0.5">
        {TIMEFRAMES.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTimeframe(t.id)}
            className={cn(
              "flex-1 rounded-full px-2 py-1 text-[11px] font-medium tracking-tight transition-colors",
              timeframe === t.id
                ? "bg-brand text-white"
                : "text-muted hover:text-main",
            )}
          >
            {t.id}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-main text-2xl font-semibold tracking-tight">
            {formatUsd(projected)}
          </div>
          <div className="text-muted mt-0.5 text-[10px]">
            ~{formatUsd(projected / Math.max(days / 30, 1))} / month
          </div>
        </div>
        <div className="text-muted text-right text-[10px]">
          <div>/ {timeframe === "1Y" ? "YEAR" : timeframe}</div>
          <div className="mt-0.5">{sourceLabel}</div>
        </div>
      </div>
    </div>
  );
}
