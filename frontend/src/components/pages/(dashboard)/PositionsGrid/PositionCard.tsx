"use client";

import { ArrowUpRight } from "lucide-react";
import { Badge, TokenPairLogos } from "@/components/ui";
import { explorerAddressUrl, formatPercent, formatUsd } from "@/lib";
import type { Position } from "@/types";
import { PositionActivity } from "./PositionActivity";
import { PositionNetworkPill } from "./PositionNetworkPill";

type PositionCardProps = {
  position: Position;
};

function formatAprRange(min: number, max: number): string {
  if (max <= 0) return "—";
  if (Math.abs(min - max) < 0.001) return formatPercent(max, 2);
  return `${formatPercent(min, 2)} - ${formatPercent(max, 2)}`;
}

function formatStat(value: number): string {
  if (value <= 0) return "—";
  return formatUsd(value, { compact: true });
}

export function PositionCard({ position }: PositionCardProps) {
  const long0 = position.tokenLongName0 ?? position.token0.symbol;
  const long1 = position.tokenLongName1 ?? position.token1.symbol;

  return (
    <article className="bg-surface ring-card flex flex-col gap-4 rounded-2xl p-5 transition-all">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenPairLogos
            token0={position.token0}
            token1={position.token1}
            size="md"
          />
          <div>
            <div className="text-main text-base font-semibold tracking-tight">
              {long0} / {long1}
            </div>
            <div className="text-muted mt-0.5 text-xs">
              {position.token0.symbol} / {position.token1.symbol}
            </div>
          </div>
        </div>
        <PositionNetworkPill networkId={position.network} />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <PrimaryStat
          label="Volume (24h)"
          value={formatStat(position.volume24hUsd)}
        />
        <PrimaryStat
          label="Pool TVL"
          value={formatStat(position.poolTvlUsd)}
        />
        <div>
          <PrimaryStat
            label="APR Range"
            value={formatAprRange(position.aprMin, position.aprMax)}
          />
          <a
            href={explorerAddressUrl(position.network, position.poolAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover mt-1 inline-flex items-center gap-1 text-[11px] font-medium tracking-tight"
          >
            Contract
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>

      <div className="bg-brand-soft/50 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div>
          <div className="text-muted text-[11px] font-medium tracking-wide uppercase">
            Your position
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-main text-xl font-semibold tracking-tight">
              {formatUsd(position.valueUsd)}
            </span>
            <span className="text-muted text-[11px]">
              +{formatUsd(position.uncollectedFeesUsd)} fees
            </span>
          </div>
        </div>
        {position.delegated && <Badge tone="success">Delegated</Badge>}
      </div>

      <PositionActivity position={position} />
    </article>
  );
}

function PrimaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted text-xs font-medium tracking-tight">
        {label}
      </div>
      <div className="text-main mt-1 text-base font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}
