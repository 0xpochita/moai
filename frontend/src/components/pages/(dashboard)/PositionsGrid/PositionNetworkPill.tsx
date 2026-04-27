"use client";

import { Sparkles } from "lucide-react";
import { cn, getNetwork } from "@/lib";
import type { NetworkId } from "@/types";

type PositionNetworkPillProps = {
  networkId: NetworkId;
  className?: string;
};

export function PositionNetworkPill({
  networkId,
  className,
}: PositionNetworkPillProps) {
  const network = getNetwork(networkId);
  return (
    <span
      className={cn(
        "bg-brand-soft text-brand inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-tight",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      {network.label}
    </span>
  );
}
