"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { usePositionsStore } from "@/store";
import { DelegationBanner } from "./DelegationBanner";
import { DestinationsPanel } from "./DestinationsPanel";
import { MigrationModal } from "./MigrationModal";
import { PositionsGrid, PositionsHeader } from "./PositionsGrid";

export function DashboardPage() {
  const { address, isConnected } = useAccount();
  const status = usePositionsStore((s) => s.status);
  const error = usePositionsStore((s) => s.error);
  const ownerAddress = usePositionsStore((s) => s.ownerAddress);
  const load = usePositionsStore((s) => s.load);
  const clear = usePositionsStore((s) => s.clear);

  useEffect(() => {
    if (!isConnected || !address) {
      clear();
      return;
    }
    if (ownerAddress?.toLowerCase() !== address.toLowerCase()) {
      void load(address);
    }
  }, [address, isConnected, ownerAddress, load, clear]);

  useEffect(() => {
    if (status === "error" && error) {
      toast("Could not load positions", { description: error });
    }
  }, [status, error]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <DelegationBanner />
      <PositionsHeader />
      <PositionsGrid walletConnected={isConnected} />
      <DestinationsPanel />
      <MigrationModal />
    </main>
  );
}
