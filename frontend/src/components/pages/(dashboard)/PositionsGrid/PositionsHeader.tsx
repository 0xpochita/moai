"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import { formatUsd } from "@/lib";
import { selectTotals, useHoldingsStore, usePositionsStore } from "@/store";

const CREATE_V4_URL = "https://app.uniswap.org/positions/create/v4";

export function PositionsHeader() {
  const totals = usePositionsStore(useShallow(selectTotals));
  const earnPositionsUsd = useHoldingsStore((s) =>
    s.positions.reduce((sum, p) => sum + p.underlyingBalanceUsd, 0),
  );

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-center gap-3">
        <span className="bg-brand-soft inline-flex h-9 w-9 items-center justify-center rounded-2xl">
          <Image
            src="/Assets/Images/logo-defi/uniswap-logo.svg"
            alt="Uniswap"
            width={20}
            height={22}
            priority
          />
        </span>
        <h1 className="text-main text-lg font-semibold tracking-tight md:text-xl">
          Your Position on Uniswap Liquidity Pool
        </h1>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <Stat
          label="Your Li.Fi Earn"
          labelLogo={{
            src: "/Assets/Images/logo-brand/lifi_brand_assets/PNG/logo_lifi_light_horizontal.png",
            alt: "Li.Fi",
            width: 36,
            height: 12,
          }}
          value={formatUsd(earnPositionsUsd)}
          accent
          icon="/Assets/Images/logo-coin/usdc-logo.svg"
          iconAlt="USDC"
        />
        <Stat
          label="Your Uniswap Position"
          labelLogo={{
            src: "/Assets/Images/logo-defi/uniswap-logo.svg",
            alt: "Uniswap",
            width: 12,
            height: 13,
          }}
          value={formatUsd(totals.totalValueUsd)}
          icon="/Assets/Images/logo-coin/usdc-logo.svg"
          iconAlt="USDC"
        />
        <a
          href={CREATE_V4_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand-hover group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-2 text-xs font-semibold tracking-tight text-white shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="bg-white/15 inline-flex h-7 w-7 items-center justify-center rounded-full">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </span>
          New position
          <ArrowUpRight
            className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        </a>
      </div>
    </header>
  );
}

type StatLabelLogo = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

function Stat({
  label,
  labelLogo,
  value,
  accent = false,
  icon,
  iconAlt,
}: {
  label?: string;
  labelLogo?: StatLabelLogo;
  value: string;
  accent?: boolean;
  icon?: string;
  iconAlt?: string;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="text-muted flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
        {labelLogo && (
          <Image
            src={labelLogo.src}
            alt={labelLogo.alt}
            width={labelLogo.width}
            height={labelLogo.height}
            className="shrink-0 object-contain"
            unoptimized
          />
        )}
        {label}
      </div>
      <div
        className={`flex items-center justify-end gap-1.5 text-base font-semibold tracking-tight ${accent ? "text-brand" : "text-main"}`}
      >
        {icon && (
          <Image
            src={icon}
            alt={iconAlt ?? ""}
            width={18}
            height={18}
            className="h-4.5 w-4.5 shrink-0"
            unoptimized
          />
        )}
        {value}
      </div>
    </div>
  );
}
