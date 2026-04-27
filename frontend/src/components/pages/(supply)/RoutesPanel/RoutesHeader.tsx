"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib";
import { selectFilteredPools, usePoolsStore } from "@/store";
import type { UniswapVersion } from "@/types";
import { NetworkFilter } from "./NetworkFilter";

const PROTOCOLS: { id: UniswapVersion | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "v2", label: "v2" },
  { id: "v3", label: "v3" },
  { id: "v4", label: "v4" },
];

export function RoutesHeader() {
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const totalPools = usePoolsStore((s) => s.pools.length);
  const protocol = usePoolsStore((s) => s.filter.protocol);
  const setProtocol = usePoolsStore((s) => s.setProtocol);
  const status = usePoolsStore((s) => s.status);
  const retry = usePoolsStore((s) => s.retry);

  const isLoading = status === "loading";

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="bg-brand-soft inline-flex h-9 w-9 items-center justify-center rounded-xl">
          <Image
            src="/Assets/Images/logo-defi/uniswap-logo.svg"
            alt="Uniswap"
            width={20}
            height={22}
            className="select-none"
            priority
          />
        </span>
        <div>
          <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
            Routes
          </div>
          <div className="text-main text-sm font-semibold tracking-tight">
            Pool Aggregator
          </div>
          <div className="text-muted mt-0.5 text-[10px]">
            {filtered.length} of {totalPools} pools across Uniswap chains
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={retry}
          disabled={isLoading}
          aria-label="Refresh pools"
          className="bg-elevated hover:bg-brand-soft text-muted inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            aria-hidden
          />
        </button>
        <NetworkFilter />
        <label className="bg-elevated text-main hover:bg-brand-soft inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium tracking-tight transition-colors">
          Protocol
          <select
            value={protocol}
            onChange={(e) =>
              setProtocol(e.target.value as UniswapVersion | "all")
            }
            className="bg-transparent text-[11px] font-semibold tracking-tight outline-none"
            aria-label="Filter by protocol"
          >
            {PROTOCOLS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="text-muted h-3 w-3" aria-hidden />
        </label>
      </div>
    </div>
  );
}
