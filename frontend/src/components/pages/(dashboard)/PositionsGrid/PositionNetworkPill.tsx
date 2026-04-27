"use client";

import Image from "next/image";
import { cn, getNetwork } from "@/lib";
import type { NetworkId } from "@/types";

type PositionNetworkPillProps = {
  networkId: NetworkId;
  className?: string;
};

const NETWORK_LOGOS: Record<NetworkId, string | null> = {
  base: "/Assets/Images/logo-brand/base-logo.jpg",
  ethereum: null,
  arbitrum: null,
  optimism: null,
};

export function PositionNetworkPill({
  networkId,
  className,
}: PositionNetworkPillProps) {
  const network = getNetwork(networkId);
  const logoSrc = NETWORK_LOGOS[networkId];

  return (
    <span
      className={cn(
        "bg-surface text-main ring-soft inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium tracking-tight",
        className,
      )}
    >
      {logoSrc ? (
        <Image
          src={logoSrc}
          alt={network.label}
          width={14}
          height={14}
          className="h-3.5 w-3.5 rounded-full object-cover"
        />
      ) : (
        <span
          style={{ backgroundColor: network.accent }}
          className="h-3 w-3 rounded-full"
          aria-hidden
        />
      )}
      {network.label}
    </span>
  );
}
