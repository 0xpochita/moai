"use client";

import { Check, ExternalLink } from "lucide-react";
import { Badge, ProtocolIcon } from "@/components/ui";
import { cn, formatPercent, formatUsd, RISK_LABEL, RISK_TONE } from "@/lib";
import { useSupplyStore } from "@/store";
import type { Pool } from "@/types";

type RouteCardProps = {
  pool: Pool;
  isBest: boolean;
};

export function RouteCard({ pool, isBest }: RouteCardProps) {
  const selectedPoolId = useSupplyStore((s) => s.selectedPoolId);
  const selectPool = useSupplyStore((s) => s.selectPool);
  const isSelected = selectedPoolId === pool.id || (!selectedPoolId && isBest);

  return (
    <button
      type="button"
      onClick={() => selectPool(pool.id)}
      className={cn(
        "bg-elevated w-full rounded-xl p-2.5 text-left transition-all duration-150 ease-in-out active:scale-[0.99]",
        isSelected ? "ring-card bg-surface" : "hover:bg-brand-soft",
      )}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-3">
        <ProtocolIcon protocol={pool.protocol} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-main truncate text-xs font-semibold tracking-tight">
              Uniswap {pool.protocol}
            </span>
            <ExternalLink className="text-muted h-3 w-3 shrink-0" aria-hidden />
            {isBest && <Badge tone="neutral">Best</Badge>}
          </div>
          <div className="text-muted mt-0.5 truncate text-[10px]">
            {pool.symbol} · {pool.chain}
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <div className="text-muted text-[9px] font-medium tracking-wide uppercase">
            TVL
          </div>
          <div className="text-main text-xs font-semibold tracking-tight">
            {formatUsd(pool.tvlUsd, { compact: true })}
          </div>
        </div>

        <div className="hidden text-right sm:block">
          <Badge tone={RISK_TONE[pool.risk]} className="justify-center">
            {RISK_LABEL[pool.risk]}
          </Badge>
        </div>

        <div className="text-right">
          <div className="text-brand text-sm font-semibold tracking-tight">
            {formatPercent(pool.apy)}
          </div>
          <div className="text-muted mt-0.5 text-[9px]">
            30d · {formatPercent(pool.apyMean30d)}
          </div>
        </div>

        <span
          className={cn(
            "ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
            isSelected ? "bg-brand text-white" : "bg-surface ring-soft",
          )}
          aria-hidden
        >
          {isSelected && <Check className="h-3 w-3" />}
        </span>
      </div>
    </button>
  );
}
