"use client";

import { ArrowUpRight } from "lucide-react";
import { ProtocolAvatar } from "@/components/ui";
import { formatPercent, formatProtocolName, formatUsd } from "@/lib";
import type { DestinationVault } from "@/types";

type DestinationCardProps = {
  vault: DestinationVault;
};

export function DestinationCard({ vault }: DestinationCardProps) {
  return (
    <a
      href={vault.vaultUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-surface ring-card flex flex-col gap-2 rounded-2xl p-3.5 transition-all hover:-translate-y-px"
    >
      <header className="flex items-start gap-2.5">
        <ProtocolAvatar protocolName={vault.protocolName} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-main truncate text-sm font-semibold tracking-tight">
              {vault.name}
            </div>
            <ArrowUpRight
              className="text-muted-soft h-3.5 w-3.5 shrink-0"
              aria-hidden
            />
          </div>
          <div className="text-muted mt-0.5 truncate text-[10px]">
            {formatProtocolName(vault.protocolName)} ·{" "}
            {vault.underlyingTokenSymbol}
          </div>
        </div>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
            APY
          </div>
          <div className="text-brand text-lg font-semibold tracking-tight">
            {formatPercent(vault.apyTotal, 2)}
          </div>
          {vault.apy30d > 0 && (
            <div className="text-muted-soft text-[10px]">
              30d · {formatPercent(vault.apy30d, 2)}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
            TVL
          </div>
          <div className="text-main text-sm font-semibold tracking-tight">
            {formatUsd(vault.tvlUsd, { compact: true })}
          </div>
        </div>
      </div>
    </a>
  );
}
