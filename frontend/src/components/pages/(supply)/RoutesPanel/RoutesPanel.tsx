"use client";

import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui";
import { selectFilteredPools, usePoolsStore } from "@/store";
import { RouteCard } from "./RouteCard";
import { RoutesEmptyState } from "./RoutesEmptyState";
import { RoutesHeader } from "./RoutesHeader";
import { RoutesReviewBar } from "./RoutesReviewBar";
import { RoutesRiskTabs } from "./RoutesRiskTabs";

export function RoutesPanel() {
  const status = usePoolsStore((s) => s.status);
  const filtered = usePoolsStore(useShallow(selectFilteredPools));
  const showList = status === "success" && filtered.length > 0;

  return (
    <Card className="flex flex-col gap-3">
      <RoutesHeader />
      <RoutesRiskTabs />

      <div className="flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-0.5">
        {showList ? (
          filtered.map((pool, index) => (
            <RouteCard key={pool.id} pool={pool} isBest={index === 0} />
          ))
        ) : (
          <RoutesEmptyState />
        )}
      </div>

      <RoutesReviewBar />
    </Card>
  );
}
