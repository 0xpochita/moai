"use client";

import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Flame,
} from "lucide-react";
import Image from "next/image";
import { getLocalTokenLogo } from "@/lib";
import type { MigrationLeg, MigrationLegKind } from "@/types";

const ICON_MAP: Record<MigrationLegKind, typeof Flame> = {
  burn: Flame,
  swap: ArrowRightLeft,
  deposit: ArrowDownToLine,
  withdraw: ArrowUpFromLine,
};

const LABEL_MAP: Record<MigrationLegKind, string> = {
  burn: "Burn LP",
  swap: "Swap",
  deposit: "Deposit",
  withdraw: "Redeem",
};

type MigrationLegItemProps = {
  leg: MigrationLeg;
  index: number;
};

const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

function getTargetLogo(leg: MigrationLeg): {
  src: string;
  alt: string;
  horizontal?: boolean;
} | null {
  if (leg.kind === "burn") {
    return { src: "/Assets/Images/logo-defi/uniswap-logo.svg", alt: "Uniswap" };
  }
  if (leg.kind === "deposit" || leg.kind === "withdraw") {
    return {
      src: "/Assets/Images/logo-brand/lifi_brand_assets/SVG/logo_lifi_light_horizontal.svg",
      alt: "Li.Fi",
      horizontal: true,
    };
  }
  if (leg.kind === "swap") {
    const usdcLogo = getLocalTokenLogo(USDC_BASE);
    if (usdcLogo) return { src: usdcLogo, alt: "USDC" };
  }
  return null;
}

export function MigrationLegItem({ leg, index }: MigrationLegItemProps) {
  const Icon = ICON_MAP[leg.kind];
  const targetLogo = getTargetLogo(leg);

  return (
    <li className="bg-elevated flex items-start gap-3 rounded-xl p-3">
      <span className="bg-brand-soft text-brand inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-main font-semibold tracking-tight">
            {index + 1}. {LABEL_MAP[leg.kind]}
          </span>
          <span className="text-muted-soft inline-flex items-center gap-1.5 text-[10px]">
            {targetLogo &&
              (targetLogo.horizontal ? (
                <Image
                  src={targetLogo.src}
                  alt={targetLogo.alt}
                  width={36}
                  height={14}
                  className="h-3.5 w-auto shrink-0 object-contain"
                  unoptimized
                />
              ) : (
                <Image
                  src={targetLogo.src}
                  alt={targetLogo.alt}
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 shrink-0 object-contain"
                  unoptimized
                />
              ))}
            {leg.target}
          </span>
        </div>
        <p className="text-muted mt-0.5 text-[11px] leading-snug">
          {leg.description}
        </p>
      </div>
    </li>
  );
}
