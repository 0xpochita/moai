"use client";

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { Badge, TokenPairLogos } from "@/components/ui";
import { explorerAddressUrl, formatPercent, formatUsd } from "@/lib";
import { useMigrationStore } from "@/store";
import type { Position, PositionStatus } from "@/types";
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
  const startMigration = useMigrationStore((s) => s.start);
  const isOutOfRange = position.status === "out-of-range";

  const handleMigrate = () => {
    void startMigration(position.owner, position.tokenId);
  };

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
        <div className="flex flex-col items-end gap-1.5">
          <PositionNetworkPill networkId={position.network} />
          <PositionStatusPill status={position.status} />
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <PrimaryStat
          label="Volume (24h)"
          value={formatStat(position.volume24hUsd)}
        />
        <PrimaryStat label="Pool TVL" value={formatStat(position.poolTvlUsd)} />
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

      {isOutOfRange && (
        <button
          type="button"
          onClick={handleMigrate}
          className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-between gap-3 rounded-full px-2 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
        >
          <span className="bg-white/15 inline-flex items-center rounded-full px-1.5 py-1">
            <TokenPairLogos
              token0={position.token0}
              token1={position.token1}
              size="sm"
            />
          </span>
          <span className="flex items-center gap-1.5">
            Migrate to Earn vault
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="bg-white inline-flex h-7 items-center justify-center rounded-full px-2.5">
            <Image
              src="/Assets/Images/logo-brand/lifi_brand_assets/SVG/logo_lifi_light_horizontal.svg"
              alt="Li.Fi Earn"
              width={48}
              height={14}
              className="h-3.5 w-auto"
            />
          </span>
        </button>
      )}

      <PositionActivity position={position} />
    </article>
  );
}

const STATUS_CONFIG: Record<
  PositionStatus,
  {
    label: string;
    tone: "success" | "danger" | "outline";
    icon: typeof CheckCircle2;
  }
> = {
  "in-range": { label: "In range", tone: "success", icon: CheckCircle2 },
  "out-of-range": {
    label: "Out of range",
    tone: "danger",
    icon: AlertTriangle,
  },
  closed: { label: "Closed", tone: "outline", icon: XCircle },
};

function PositionStatusPill({ status }: { status: PositionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Badge tone={cfg.tone}>
      <Icon className="h-3 w-3" aria-hidden />
      {cfg.label}
    </Badge>
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
