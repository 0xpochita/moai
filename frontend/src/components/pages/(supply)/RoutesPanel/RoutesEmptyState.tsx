"use client";

import { AlertCircle } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { usePoolsStore } from "@/store";

export function RoutesEmptyState() {
  const status = usePoolsStore((s) => s.status);
  const error = usePoolsStore((s) => s.error);
  const retry = usePoolsStore((s) => s.retry);

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-elevated flex flex-col items-center justify-center rounded-xl p-6 text-center">
        <AlertCircle className="text-warning h-5 w-5" aria-hidden />
        <div className="text-main mt-2 text-xs font-medium">
          Could not load pools
        </div>
        <div className="text-muted mt-0.5 text-[10px]">
          {error ?? "Please try again."}
        </div>
        <Button onClick={retry} size="sm" variant="secondary" className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-elevated text-muted rounded-xl p-6 text-center text-xs">
      No pools match these filters. Try widening protocol or risk.
    </div>
  );
}
