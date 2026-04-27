"use client";

import { ArrowUpRight, Plus, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { usePositionsStore } from "@/store";

type PositionsEmptyStateProps = {
  walletConnected: boolean;
};

const CREATE_V4_URL = "https://app.uniswap.org/positions/create/v4";
const CREATE_V3_URL = "https://app.uniswap.org/positions/create/v3";

export function PositionsEmptyState({
  walletConnected,
}: PositionsEmptyStateProps) {
  const status = usePositionsStore((s) => s.status);

  if (status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[4/3] min-h-[200px]" />
        ))}
      </div>
    );
  }

  if (!walletConnected) {
    return (
      <div className="bg-surface ring-card flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center">
        <span className="bg-brand-soft text-brand inline-flex h-10 w-10 items-center justify-center rounded-full">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-main mt-1 text-sm font-medium">Connect a wallet</p>
        <p className="text-muted text-xs">
          Sign in to view your live Uniswap positions on Base.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface ring-card flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center">
      <span className="bg-brand-soft text-brand inline-flex h-10 w-10 items-center justify-center rounded-full">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <p className="text-main text-sm font-medium">
          No positions on Base yet
        </p>
        <p className="text-muted mt-1 text-xs">
          Create a Uniswap liquidity position so MOAI can track and migrate it
          when it goes out of range.
        </p>
      </div>
      <div className="mt-1 flex flex-col items-center gap-1.5">
        <a
          href={CREATE_V4_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand-hover inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
        >
          Create v4 position on Uniswap
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
        <a
          href={CREATE_V3_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-brand inline-flex items-center gap-1 text-[11px] font-medium tracking-tight transition-colors"
        >
          or create a v3 position
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </div>
  );
}
