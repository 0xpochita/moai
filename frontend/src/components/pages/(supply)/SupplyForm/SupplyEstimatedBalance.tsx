"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui";
import { formatPercent, formatUsd, projectYield, safeParseAmount } from "@/lib";
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

export function SupplyEstimatedBalance() {
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const selectedPoolId = useSupplyStore((s) => s.selectedPoolId);
  const amount = useSupplyStore((s) => s.amount);
  const pool = useMemo(
    () => pickPool(filtered, selectedPoolId),
    [filtered, selectedPoolId],
  );
  const numericAmount = safeParseAmount(amount);

  return (
    <div className="bg-elevated rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-main flex items-center gap-1.5 text-xs font-semibold tracking-tight">
          <span className="bg-brand-soft text-brand inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold">
            $
          </span>
          Estimated balance
        </div>
        <Badge tone="neutral">
          {pool ? `${formatPercent(pool.apy)} APY` : "—"}
        </Badge>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        {TIMEFRAMES.map((t) => {
          const projected = pool
            ? projectYield(numericAmount, pool.apy, t.days)
            : numericAmount;
          const delta = projected - numericAmount;
          return (
            <div key={t.id} className="bg-surface ring-soft rounded-xl p-2">
              <div className="text-muted text-[9px] font-medium tracking-wide uppercase">
                {t.id}
              </div>
              <div className="text-main mt-0.5 text-xs font-semibold tracking-tight">
                {formatUsd(projected)}
              </div>
              <div className="text-success mt-0.5 text-[10px] font-medium">
                +{formatUsd(delta)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
