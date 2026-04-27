"use client";

import { Globe } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib";
import type { Network } from "@/types";

type NetworkIconProps = {
  network: Network;
  size?: number;
  className?: string;
};

export function NetworkIcon({
  network,
  size = 20,
  className,
}: NetworkIconProps) {
  const [errored, setErrored] = useState(false);

  if (network.id === "all") {
    return (
      <span
        style={{ height: size, width: size }}
        className={cn(
          "bg-brand-soft text-brand inline-flex shrink-0 items-center justify-center rounded-full",
          className,
        )}
      >
        <Globe style={{ height: size * 0.6, width: size * 0.6 }} aria-hidden />
      </span>
    );
  }

  if (errored || !network.logoUrl) {
    return (
      <span
        style={{
          height: size,
          width: size,
          backgroundColor: `${network.accent}1f`,
          color: network.accent,
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-tight uppercase",
          className,
        )}
      >
        {network.label.charAt(0)}
      </span>
    );
  }

  return (
    <Image
      src={network.logoUrl}
      alt={network.label}
      width={size}
      height={size}
      style={{ height: size, width: size }}
      className={cn("shrink-0 rounded-full object-cover", className)}
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
