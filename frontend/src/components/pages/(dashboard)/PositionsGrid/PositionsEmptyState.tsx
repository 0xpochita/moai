"use client";

import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { usePositionsStore } from "@/store";

type PositionsEmptyStateProps = {
  walletConnected: boolean;
};

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
        <Wallet className="text-brand h-6 w-6" aria-hidden />
        <p className="text-main text-sm font-medium">Connect a wallet</p>
        <p className="text-muted text-xs">
          Sign in to view your live Uniswap positions on Base.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface ring-card flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center">
      <p className="text-main text-sm font-medium">No positions yet</p>
      <p className="text-muted text-xs">
        Create a Uniswap v3 or v4 position on Base to see it here.
      </p>
    </div>
  );
}
