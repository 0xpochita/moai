"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui";
import { useDestinationsStore, useSettingsStore } from "@/store";
import { DestinationCard } from "./DestinationCard";

const TOP_N = 6;

export function DestinationsPanel() {
  const vaults = useDestinationsStore(useShallow((s) => s.vaults));
  const status = useDestinationsStore((s) => s.status);
  const error = useDestinationsStore((s) => s.error);
  const load = useDestinationsStore((s) => s.load);
  const minApyPct = useSettingsStore((s) => s.minApyPct);
  const allowedProtocols = useSettingsStore(
    useShallow((s) => s.allowedProtocols),
  );

  const filtered = useMemo(
    () =>
      vaults.filter(
        (v) =>
          v.apyTotal >= minApyPct &&
          allowedProtocols.includes(
            v.protocolName as (typeof allowedProtocols)[number],
          ),
      ),
    [vaults, minApyPct, allowedProtocols],
  );

  useEffect(() => {
    if (status === "idle") void load("USDC");
  }, [status, load]);

  return (
    <section className="bg-surface ring-card flex flex-col gap-3 rounded-2xl p-4">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="bg-surface ring-soft inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/Assets/Images/logo-brand/base-logo.jpg"
              alt="Base"
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
          </span>
          <div>
            <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
              Earn destinations
            </div>
            <div className="text-main text-sm font-semibold tracking-tight">
              Top USDC vaults on Base
            </div>
          </div>
        </div>
        <span className="text-muted-soft inline-flex items-center gap-1.5 text-[10px]">
          via
          <Image
            src="/Assets/Images/logo-brand/lifi_brand_assets/SVG/logo_lifi_light_horizontal.svg"
            alt="Li.Fi Earn"
            width={48}
            height={16}
            className="h-3.5 w-auto opacity-80"
            priority={false}
          />
        </span>
      </header>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="bg-elevated text-muted rounded-xl p-4 text-center text-xs">
          {error ?? "Could not load destinations."}
        </div>
      )}

      {status === "success" && filtered.length === 0 && (
        <div className="bg-elevated text-muted rounded-xl p-4 text-center text-xs">
          {vaults.length === 0
            ? "No vaults match the trust filter right now."
            : `No vaults match your filters (≥${minApyPct.toFixed(1)}% APY, ${allowedProtocols.length} protocols).`}
        </div>
      )}

      {status === "success" && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, TOP_N).map((vault) => (
            <DestinationCard key={vault.id} vault={vault} />
          ))}
        </div>
      )}
    </section>
  );
}
