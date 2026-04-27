"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib";

type TokenPairLogosProps = {
  token0?: { symbol: string; logoUrl: string };
  token1?: { symbol: string; logoUrl: string };
  fallback?: string;
  size?: "sm" | "md";
  className?: string;
};

const SIZE = {
  sm: { wrap: "h-7 w-10", logo: 20 },
  md: { wrap: "h-9 w-14", logo: 28 },
};

function FallbackBadge({
  text,
  size,
  offset,
}: {
  text: string;
  size: number;
  offset?: boolean;
}) {
  return (
    <span
      style={{ height: size, width: size }}
      className={cn(
        "bg-brand-soft text-brand inline-flex shrink-0 items-center justify-center rounded-full text-[9px] font-semibold tracking-tight uppercase",
        offset && "-ml-2",
      )}
    >
      {text.slice(0, 2)}
    </span>
  );
}

function TokenLogo({
  src,
  alt,
  size,
  offset,
  fallback,
}: {
  src: string;
  alt: string;
  size: number;
  offset?: boolean;
  fallback: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <FallbackBadge text={fallback} size={size} offset={offset} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ height: size, width: size }}
      className={cn(
        "ring-soft bg-surface shrink-0 rounded-full object-cover",
        offset && "-ml-2",
      )}
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}

export function TokenPairLogos({
  token0,
  token1,
  fallback,
  size = "md",
  className,
}: TokenPairLogosProps) {
  const dims = SIZE[size];

  if (!token0 || !token1) {
    return (
      <span
        className={cn(
          "bg-brand-soft text-brand inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tracking-tight",
          className,
        )}
      >
        {fallback ?? "·"}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", dims.wrap, className)}>
      <TokenLogo
        src={token0.logoUrl}
        alt={token0.symbol}
        size={dims.logo}
        fallback={token0.symbol}
      />
      <TokenLogo
        src={token1.logoUrl}
        alt={token1.symbol}
        size={dims.logo}
        offset
        fallback={token1.symbol}
      />
    </span>
  );
}
