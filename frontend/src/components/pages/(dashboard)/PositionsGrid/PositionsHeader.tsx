"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import { formatUsd } from "@/lib";
import { selectTotals, usePositionsStore } from "@/store";

const CREATE_V4_URL = "https://app.uniswap.org/positions/create/v4";

export function PositionsHeader() {
  const totals = usePositionsStore(useShallow(selectTotals));

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
          label="Yield / day"
          value={formatUsd(totals.totalYieldDayUsd)}
          accent
        />
        <Stat label="Total value" value={formatUsd(totals.totalValueUsd)} />
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

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div
        className={`text-base font-semibold tracking-tight ${accent ? "text-brand" : "text-main"}`}
      >
        {value}
      </div>
    </div>
  );
}
