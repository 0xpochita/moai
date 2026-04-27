"use client";

import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import { formatUsd } from "@/lib";
import { selectTotals, usePositionsStore } from "@/store";

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
      <div className="flex items-center gap-6">
        <Stat
          label="Yield / day"
          value={formatUsd(totals.totalYieldDayUsd)}
          accent
        />
        <Stat label="Total value" value={formatUsd(totals.totalValueUsd)} />
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
