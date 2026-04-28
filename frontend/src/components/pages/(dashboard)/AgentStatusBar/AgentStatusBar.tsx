"use client";

import { Loader2, Power, Radio, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatRelativeTime } from "@/lib";
import { buildRevocation, relayAgent } from "@/services";
import {
  RISK_PROFILES,
  useDelegationStore,
  useKeeperStore,
  useSettingsStore,
} from "@/store";

const BASE_CHAIN_ID = 8453;
const POLL_INTERVAL_MS = 15_000;

export function AgentStatusBar() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const delegationStatus = useDelegationStore((s) => s.status);
  const markNotDelegated = useDelegationStore((s) => s.markNotDelegated);

  const keeperStatus = useKeeperStore((s) => s.status);
  const subscription = useKeeperStore((s) => s.subscription);
  const meta = useKeeperStore((s) => s.meta);
  const ownerAddress = useKeeperStore((s) => s.ownerAddress);
  const enable = useKeeperStore((s) => s.enable);
  const disable = useKeeperStore((s) => s.disable);
  const startPolling = useKeeperStore((s) => s.startPolling);
  const stopPolling = useKeeperStore((s) => s.stopPolling);

  const riskProfile = useSettingsStore((s) => s.riskProfile);
  const riskMeta =
    RISK_PROFILES.find((r) => r.key === riskProfile) ?? RISK_PROFILES[1];

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (delegationStatus !== "delegated" || !address) {
      stopPolling();
      return;
    }
    if (ownerAddress?.toLowerCase() !== address.toLowerCase()) {
      startPolling(address, POLL_INTERVAL_MS);
    }
    return () => {
      stopPolling();
    };
  }, [delegationStatus, address, ownerAddress, startPolling, stopPolling]);

  useEffect(() => {
    if (
      delegationStatus === "delegated" &&
      address &&
      keeperStatus === "success" &&
      !subscription
    ) {
      void enable(address).catch(() => {
        // ignore: keeper offline; user can retry by toggling
      });
    }
  }, [delegationStatus, address, keeperStatus, subscription, enable]);

  if (!isConnected || !address) return null;
  if (delegationStatus !== "delegated") return null;

  const lastTickAtSec = meta?.tickStats.lastTickAtSec ?? 0;
  const lastCheckedAtSec = subscription?.lastCheckedAtSec ?? 0;
  const isSubscribed = Boolean(subscription);

  const handleRevoke = async () => {
    if (!walletClient || !publicClient || !address) return;
    setBusy(true);
    try {
      if (isSubscribed) {
        await disable(address).catch(() => {
          // tolerate keeper offline
        });
      }
      // User signs an EIP-712 batch that revokes the agent key on Calibur.
      // Relayer pays gas to submit it.
      const envelope = await buildRevocation(address);
      const message = {
        batchedCall: {
          calls: envelope.signedBatchedCall.batchedCall.calls.map((c) => ({
            to: c.to as `0x${string}`,
            value: BigInt(c.value),
            data: c.data as Hex,
          })),
          revertOnFailure:
            envelope.signedBatchedCall.batchedCall.revertOnFailure,
        },
        nonce: BigInt(envelope.signedBatchedCall.nonce),
        keyHash: envelope.signedBatchedCall.keyHash as Hex,
        executor: envelope.signedBatchedCall.executor as `0x${string}`,
        deadline: BigInt(envelope.signedBatchedCall.deadline),
      };
      // biome-ignore lint/suspicious/noExplicitAny: viem typed-data generics
      const sig = (await walletClient.signTypedData({
        account: walletClient.account!,
        domain: envelope.typedData.domain,
        types: envelope.typedData.types,
        primaryType: envelope.typedData.primaryType,
        message,
      } as any)) as Hex;

      const relay = await relayAgent({
        owner: address,
        signedBatchedCall: envelope.signedBatchedCall,
        signature: sig,
      });

      markNotDelegated();
      toast("Agent revoked", {
        description: `Tx ${relay.txHash.slice(0, 10)}… submitted on Base.`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not revoke delegation";
      toast("Revoke failed", { description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-elevated ring-card flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <span className="bg-brand text-white inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl">
          {isSubscribed ? (
            <Radio className="h-4 w-4" aria-hidden />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0">
          <div className="text-main flex items-center gap-2 text-sm font-semibold tracking-tight">
            Agent active
            <span className="bg-brand-soft text-brand inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              <span className="bg-brand h-1.5 w-1.5 animate-pulse rounded-full" />
              {isSubscribed ? "Watching" : "Connecting"}
            </span>
            <span className="bg-surface text-muted ring-soft inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              {riskMeta.label}
            </span>
          </div>
          <p className="text-muted mt-1 text-xs leading-snug">
            MOAI is monitoring your positions. When one goes out-of-range it
            migrates funds to the best Li.Fi Earn vault for your risk profile.
            The agent never holds your balance.
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
        </div>
      </div>

      <button
        type="button"
        onClick={handleRevoke}
        disabled={busy || !walletClient}
        className="bg-surface text-muted ring-soft hover:text-main hover:bg-elevated inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Power className="h-3 w-3" aria-hidden />
        )}
        Revoke
      </button>
    </section>
  );
}
