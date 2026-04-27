"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui";
import { safeParseAmount } from "@/lib";
import { selectFilteredPools, usePoolsStore, useSupplyStore } from "@/store";
import type { Pool } from "@/types";

function pickPool(pools: Pool[], selectedId: string | null): Pool | null {
  if (!pools.length) return null;
  if (selectedId) {
    const match = pools.find((p) => p.id === selectedId);
    if (match) return match;
  }
  return pools[0] ?? null;
}

export function RoutesReviewBar() {
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const selectedPoolId = useSupplyStore((s) => s.selectedPoolId);
  const amount = useSupplyStore((s) => s.amount);
  const token = useSupplyStore((s) => s.token);

  const pool = useMemo(
    () => pickPool(filtered, selectedPoolId),
    [filtered, selectedPoolId],
  );
  const numericAmount = safeParseAmount(amount);
  const isReady = pool !== null && numericAmount > 0;

  const handleReview = () => {
    if (!pool) {
      toast("Select a pool", {
        description: "Pick one of the routes to continue.",
      });
      return;
    }
    if (numericAmount <= 0) {
      toast("Enter an amount", {
        description: "Supply amount must be greater than zero.",
      });
      return;
    }
    toast("Review deposit", {
      description: `Supplying ${amount} ${token} to ${pool.symbol} on Uniswap ${pool.protocol}. Approval and quote handled via the Uniswap Trading API.`,
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        onClick={handleReview}
        size="lg"
        disabled={!isReady}
        className="w-full"
      >
        Review deposit
      </Button>
      <div className="text-muted-soft text-center text-[10px]">
        Powered by Uniswap Trading API
      </div>
    </div>
  );
}
