"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  formatPercent,
  formatProtocolName,
  formatUsd,
  getProtocolLogoUrl,
} from "@/lib";
import type { DestinationVault } from "@/types";

type DestinationCardProps = {
  vault: DestinationVault;
};

function ProtocolAvatar({
  protocolName,
  size = 32,
}: {
  protocolName: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const url = getProtocolLogoUrl(protocolName);

  if (!url || errored) {
    return (
      <span
        style={{ height: size, width: size }}
        className="bg-brand-soft text-brand inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-tight uppercase"
      >
        {protocolName.charAt(0)}
      </span>
    );
  }

  return (
    <span
      style={{ height: size, width: size }}
      className="bg-surface ring-soft inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
    >
      <Image
        src={url}
        alt={protocolName}
        width={size}
        height={size}
        style={{ height: size, width: size }}
        className="object-cover"
        onError={() => setErrored(true)}
        unoptimized
      />
    </span>
  );
}

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
