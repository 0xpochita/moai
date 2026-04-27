"use client";

import { ChevronDown } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { selectFilteredPools, usePoolsStore } from "@/store";
import type { UniswapVersion } from "@/types";

const PROTOCOLS: { id: UniswapVersion | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "v2", label: "v2" },
  { id: "v3", label: "v3" },
  { id: "v4", label: "v4" },
];

export function RoutesHeader() {
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const protocol = usePoolsStore((s) => s.filter.protocol);
  const setProtocol = usePoolsStore((s) => s.setProtocol);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="bg-brand-soft text-brand inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-semibold tracking-tight">
          U
        </span>
        <div>
          <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
            Routes
          </div>
          <div className="text-main text-sm font-semibold tracking-tight">
            Pool Aggregator
          </div>
          <div className="text-muted mt-0.5 text-[10px]">
            {filtered.length} pools via Uniswap mainnet
          </div>
        </div>
      </div>
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
  );
}
