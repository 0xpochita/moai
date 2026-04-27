"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NetworkIcon } from "@/components/ui";
import { cn, getNetwork, NETWORKS } from "@/lib";
import { usePoolsStore } from "@/store";

export function NetworkFilter() {
  const network = usePoolsStore((s) => s.filter.network);
  const setNetwork = usePoolsStore((s) => s.setNetwork);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = getNetwork(network);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="bg-elevated text-main hover:bg-brand-soft inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium tracking-tight transition-colors"
      >
        <NetworkIcon network={active} size={16} />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown
          className={cn(
            "text-muted h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Filter by network"
          className="bg-surface ring-card absolute right-0 z-20 mt-1.5 flex w-52 flex-col gap-0.5 rounded-2xl p-1.5"
        >
          {NETWORKS.map((n) => {
            const selected = n.id === network;
            return (
              <button
                type="button"
                key={n.id}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setNetwork(n.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs font-medium tracking-tight transition-colors",
                  selected
                    ? "bg-brand-soft text-brand"
                    : "text-main hover:bg-brand-soft",
                )}
              >
                <span className="flex items-center gap-2">
                  <NetworkIcon network={n} size={20} />
                  {n.label}
                </span>
                {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
