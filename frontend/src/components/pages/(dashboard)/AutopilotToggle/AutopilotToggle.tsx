"use client";

import {
  AlertTriangle,
  CircleDot,
  Loader2,
  Pause,
  Play,
  Radio,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { formatRelativeTime } from "@/lib";
import { useKeeperStore } from "@/store";

const POLL_INTERVAL_MS = 15_000;

export function AutopilotToggle() {
  const { address, isConnected } = useAccount();

  const status = useKeeperStore((s) => s.status);
  const subscription = useKeeperStore((s) => s.subscription);
  const meta = useKeeperStore((s) => s.meta);
  const error = useKeeperStore((s) => s.error);
  const ownerAddress = useKeeperStore((s) => s.ownerAddress);
  const enable = useKeeperStore((s) => s.enable);
  const disable = useKeeperStore((s) => s.disable);
  const startPolling = useKeeperStore((s) => s.startPolling);
  const stopPolling = useKeeperStore((s) => s.stopPolling);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      stopPolling();
      return;
    }
    if (ownerAddress?.toLowerCase() !== address.toLowerCase()) {
      startPolling(address, POLL_INTERVAL_MS);
    }
    return () => {
      stopPolling();
    };
  }, [address, isConnected, ownerAddress, startPolling, stopPolling]);

  if (!isConnected || !address) return null;

  const isSubscribed = Boolean(subscription);
  const autoExecute = meta?.autoExecuteEnabled ?? false;
  const hookConfigured = meta?.hookConfigured ?? false;
  const keeperWalletConfigured = meta?.keeperWalletConfigured ?? false;
  const lastTickAtSec = meta?.tickStats.lastTickAtSec ?? 0;
  const lastCheckedAtSec = subscription?.lastCheckedAtSec ?? 0;

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (isSubscribed) {
        await disable(address);
        toast("Autopilot disabled", {
          description: "Keeper will stop monitoring this wallet.",
        });
      } else {
        await enable(address);
        toast("Autopilot enabled", {
          description: autoExecute
            ? "Agent will auto-migrate out-of-range positions."
            : "Agent will detect out-of-range positions (auto-execute off).",
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Keeper action failed";
      toast("Autopilot error", { description: message });
    } finally {
      setBusy(false);
    }
  };

  const loading = status === "loading" && !meta;

  return (
    <section className="bg-elevated ring-card flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
            isSubscribed
              ? "bg-brand text-white"
              : "bg-surface text-muted ring-soft"
          }`}
        >
          {isSubscribed ? (
            <Radio className="h-4 w-4" aria-hidden />
          ) : (
            <CircleDot className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <div className="text-main flex items-center gap-2 text-sm font-semibold tracking-tight">
            Autopilot
            {isSubscribed ? (
              <span className="bg-brand-soft text-brand inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                <span className="bg-brand h-1.5 w-1.5 animate-pulse rounded-full" />
                Active
              </span>
            ) : (
              <span className="bg-surface text-muted ring-soft inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                Off
              </span>
            )}
          </div>
          <p className="text-muted mt-1 text-xs leading-snug">
            {isSubscribed
              ? autoExecute
                ? "Keeper monitors your positions and auto-migrates when they go out of range."
                : "Keeper monitors your positions and logs migration plans (auto-execute off)."
              : "Enable to let the MOAI keeper watch your positions and migrate on out-of-range events."}
          </p>
          {isSubscribed && (
            <div className="text-muted-soft mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              {lastCheckedAtSec > 0 && (
                <span>Last check {formatRelativeTime(lastCheckedAtSec)}</span>
              )}
              {lastTickAtSec > 0 && (
                <span>Last tick {formatRelativeTime(lastTickAtSec)}</span>
              )}
              {meta && (
                <span>
                  {meta.tickStats.totalTicks} tick
                  {meta.tickStats.totalTicks === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
          {isSubscribed && !autoExecute && (
            <div className="text-warning mt-2 inline-flex items-start gap-1.5 text-[11px] leading-snug">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                Auto-execute disabled — {!hookConfigured && "hook not deployed"}
                {!hookConfigured && !keeperWalletConfigured && ", "}
                {!keeperWalletConfigured && "keeper wallet not configured"}.
                Detection only.
              </span>
            </div>
          )}
          {error && <p className="text-warning mt-1.5 text-[11px]">{error}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={busy || loading}
        className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-tight transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
          isSubscribed
            ? "bg-surface text-main ring-soft hover:bg-elevated"
            : "bg-brand hover:bg-brand-hover text-white"
        }`}
      >
        {busy || loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : isSubscribed ? (
          <Pause className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy
          ? isSubscribed
            ? "Disabling…"
            : "Enabling…"
          : loading
            ? "Loading…"
            : isSubscribed
              ? "Disable autopilot"
              : "Enable autopilot"}
      </button>
    </section>
  );
}
