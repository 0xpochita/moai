"use client";

import { useShallow } from "zustand/react/shallow";
import { usePositionsStore } from "@/store";
import { PositionCard } from "./PositionCard";
import { PositionsEmptyState } from "./PositionsEmptyState";

type PositionsGridProps = {
  walletConnected: boolean;
};

export function PositionsGrid({ walletConnected }: PositionsGridProps) {
  const positions = usePositionsStore(useShallow((s) => s.positions));

  if (positions.length === 0) {
    return <PositionsEmptyState walletConnected={walletConnected} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {positions.map((position) => (
        <PositionCard key={position.id} position={position} />
      ))}
    </div>
  );
}
