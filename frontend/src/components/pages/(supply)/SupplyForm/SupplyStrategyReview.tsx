"use client";

import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge, ProtocolIcon, Skeleton, TokenPairLogos } from "@/components/ui";
import { formatPercent, formatUsd, RISK_LABEL, RISK_TONE } from "@/lib";
import { selectFilteredPools, usePoolsStore, useSupplyStore } from "@/store";
import type { Pool } from "@/types";

function pickPool(pools: Pool[], selectedId: string | null): Pool | null {
  if (!pools.length) return null;
  if (selectedId) {
    const match = pools.find((p) => p.id === selectedId);
    if (match) return match;
  }
  return pools[0] ?? null;
}

export function SupplyStrategyReview() {
  const status = usePoolsStore((s) => s.status);
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const selectedPoolId = useSupplyStore((s) => s.selectedPoolId);
  const pool = useMemo(
    () => pickPool(filtered, selectedPoolId),
    [filtered, selectedPoolId],
  );

  if (status === "loading" && !pool) {
    return (
      <div className="bg-elevated rounded-xl p-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2.5 h-12 w-full" />
        <Skeleton className="mt-2 h-16 w-full" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="bg-elevated text-muted rounded-xl p-3 text-xs">
        Select a pool on the right to preview the strategy.
      </div>
    );
  }

  return (
    <div className="bg-elevated rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
          Your Agent Strategy
        </div>
        <Badge tone={RISK_TONE[pool.risk]}>{RISK_LABEL[pool.risk]} risk</Badge>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <ProtocolIcon protocol={pool.protocol} className="h-4 w-4 text-[8px]" />
        <span className="text-main text-xs font-semibold tracking-tight">
          Uniswap {pool.protocol}
        </span>
      </div>

      <div className="bg-surface ring-soft mt-2.5 flex items-center justify-between rounded-xl p-2.5">
        <div className="flex items-center gap-2">
          {pool.token0 && pool.token1 ? (
            <TokenPairLogos
              token0={pool.token0}
              token1={pool.token1}
              size="md"
            />
          ) : (
            <ProtocolIcon protocol={pool.protocol} />
          )}
          <div>
            <div className="text-main text-xs font-semibold tracking-tight">
              {pool.symbol}
            </div>
            <div className="text-muted mt-0.5 text-[10px]">
              Uniswap {pool.protocol} · {pool.chain}
            </div>
          </div>
        </div>
        <a
          href={`https://app.uniswap.org/explore/pools/ethereum/${pool.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-elevated text-main hover:bg-brand-soft inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors"
        >
          Pool
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      {pool.token0 && pool.token1 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <TokenAddressChip token={pool.token0} />
          <TokenAddressChip token={pool.token1} />
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Stat label="APY" value={formatPercent(pool.apy)} accent />
        <Stat label="TVL" value={formatUsd(pool.tvlUsd, { compact: true })} />
        <Stat label="30D avg APY" value={formatPercent(pool.apyMean30d)} />
        <Stat
          label="Fee tier"
          value={pool.feeTier !== undefined ? `${pool.feeTier}%` : "—"}
        />
        {pool.volumeUsd1d !== undefined && (
          <Stat
            label="1D Volume"
            value={formatUsd(pool.volumeUsd1d, { compact: true })}
            className="col-span-2"
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-surface ring-soft rounded-xl p-2.5 ${className ?? ""}`}>
      <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-base font-semibold tracking-tight ${accent ? "text-brand" : "text-main"}`}
      >
        {value}
      </div>
    </div>
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function TokenAddressChip({
  token,
}: {
  token: { symbol: string; address: string };
}) {
  return (
    <a
      href={`https://etherscan.io/address/${token.address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-surface ring-soft hover:bg-brand-soft flex items-center justify-between rounded-xl px-2.5 py-1.5 text-[10px] transition-colors"
    >
      <span className="text-muted font-medium tracking-wide uppercase">
        {token.symbol}
      </span>
      <span className="text-main font-mono font-medium tracking-tight">
        {shortAddress(token.address)}
      </span>
    </a>
  );
}
