"use client";

import { ArrowDownToLine, ArrowRightLeft, Flame } from "lucide-react";
import type { MigrationLeg, MigrationLegKind } from "@/types";

const ICON_MAP: Record<MigrationLegKind, typeof Flame> = {
  burn: Flame,
  swap: ArrowRightLeft,
  deposit: ArrowDownToLine,
};

const LABEL_MAP: Record<MigrationLegKind, string> = {
  burn: "Burn LP",
  swap: "Swap",
  deposit: "Deposit",
};

type MigrationLegItemProps = {
  leg: MigrationLeg;
  index: number;
};

export function MigrationLegItem({ leg, index }: MigrationLegItemProps) {
  const Icon = ICON_MAP[leg.kind];
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
          <span className="text-muted-soft text-[10px]">{leg.target}</span>
        </div>
        <p className="text-muted mt-0.5 text-[11px] leading-snug">
          {leg.description}
        </p>
      </div>
    </li>
  );
}
