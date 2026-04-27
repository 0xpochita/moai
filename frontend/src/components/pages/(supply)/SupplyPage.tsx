"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { usePoolsStore } from "@/store";
import { RoutesPanel } from "./RoutesPanel";
import { SupplyForm } from "./SupplyForm";

export function SupplyPage() {
  const status = usePoolsStore((s) => s.status);
  const error = usePoolsStore((s) => s.error);
  const load = usePoolsStore((s) => s.load);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (status === "error" && error) {
      toast("Pool feed unavailable", { description: error });
    }
  }, [status, error]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-6 md:px-6">
      <header>
        <h1 className="text-main text-lg font-semibold tracking-tight">
          Supply liquidity
        </h1>
        <p className="text-muted mt-0.5 text-xs">
          Discover and supply to live Uniswap mainnet pools.
        </p>
      </header>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SupplyForm />
        <RoutesPanel />
      </section>
    </main>
  );
}
