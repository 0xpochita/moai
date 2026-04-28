"use client";

import { AlertTriangle, Loader2, Power } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Hex } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { AgentActiveAnimation, MotionModal } from "@/components/ui";
import { formatRelativeTime, toastTx } from "@/lib";
import { CALIBUR_DOMAIN_SALT } from "@/lib/calibur";
import { buildRevocation, relayAgent } from "@/services";
import {
  RISK_PROFILES,
  useAgentStatusStore,
  useDelegationStore,
  useKeeperStore,
  useSettingsStore,
} from "@/store";

const BASE_CHAIN_ID = 8453;
const POLL_INTERVAL_MS = 15_000;

const EIP712_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
    { name: "salt", type: "bytes32" },
  ],
  SignedBatchedCall: [
    { name: "batchedCall", type: "BatchedCall" },
    { name: "nonce", type: "uint256" },
    { name: "keyHash", type: "bytes32" },
    { name: "executor", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
  BatchedCall: [
    { name: "calls", type: "Call[]" },
    { name: "revertOnFailure", type: "bool" },
  ],
  Call: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export function AgentStatusBar() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const markNotDelegated = useDelegationStore((s) => s.markNotDelegated);

  const agentStatus = useAgentStatusStore((s) => s.status);
  const refreshAgentStatus = useAgentStatusStore((s) => s.refresh);
  const clearAgentStatus = useAgentStatusStore((s) => s.clear);

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Truth: agent is "active" only when on-chain status confirms BOTH
  // Calibur delegation + agent key registered.
  const isAgentLive = Boolean(
    agentStatus?.caliburDelegated && agentStatus?.agentRegistered,
  );

  // Refresh agent status whenever the connected address changes.
  useEffect(() => {
    if (!isConnected || !address) {
      clearAgentStatus();
      return;
    }
    void refreshAgentStatus(address);
  }, [isConnected, address, refreshAgentStatus, clearAgentStatus]);

  useEffect(() => {
    if (!isAgentLive || !address) {
      stopPolling();
      return;
    }
    if (ownerAddress?.toLowerCase() !== address.toLowerCase()) {
      startPolling(address, POLL_INTERVAL_MS);
    }
    return () => {
      stopPolling();
    };
  }, [isAgentLive, address, ownerAddress, startPolling, stopPolling]);

  useEffect(() => {
    if (isAgentLive && address && keeperStatus === "success" && !subscription) {
      void enable(address).catch(() => {
        // ignore: keeper offline
      });
    }
  }, [isAgentLive, address, keeperStatus, subscription, enable]);

  if (!isConnected || !address) return null;
  if (!isAgentLive) return null;

  const lastTickAtSec = meta?.tickStats.lastTickAtSec ?? 0;
  const lastCheckedAtSec = subscription?.lastCheckedAtSec ?? 0;
  const isSubscribed = Boolean(subscription);

  const handleRevoke = async () => {
    if (!publicClient || !address) return;
    setConfirmOpen(false);
    setBusy(true);
    try {
      // Stop polling first.
      if (isSubscribed) {
        await disable(address).catch(() => {
          // tolerate keeper offline
        });
      }

      // If the agent isn't actually registered on-chain, just clear local
      // state — there's nothing to revoke.
      if (!agentStatus?.agentRegistered) {
        markNotDelegated();
        clearAgentStatus();
        toast("Local state cleared", {
          description: "Agent wasn't registered on-chain; nothing to submit.",
        });
        return;
      }

      const envelope = await buildRevocation(address);

      const provider = (window as { ethereum?: EthereumProvider }).ethereum;
      if (!provider) throw new Error("No wallet provider available");

      const typedData = {
        types: EIP712_TYPES,
        primaryType: "SignedBatchedCall",
        domain: {
          name: "Calibur",
          version: "1.0.0",
          chainId: BASE_CHAIN_ID,
          verifyingContract: address,
          salt: CALIBUR_DOMAIN_SALT,
        },
        message: envelope.signedBatchedCall,
      };

      const signature = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      })) as Hex;

      const relay = await relayAgent({
        owner: address,
        signedBatchedCall: envelope.signedBatchedCall,
        signature,
      });

      try {
        await publicClient.waitForTransactionReceipt({
          hash: relay.txHash,
          timeout: 60_000,
        });
      } catch {
        // best-effort wait
      }

      markNotDelegated();
      await refreshAgentStatus(address);
      toastTx({
        title: "Agent revoked",
        txHash: relay.txHash,
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
    <section className="bg-linear-to-r from-[#fff5f9] to-[#fde8f1] dark:from-[#1d1f2a] dark:to-[#241828] ring-card relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
      <span
        aria-hidden
        className="bg-brand/5 pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-2xl"
      />
      <div className="relative flex items-center gap-3">
        <div className="shrink-0">
          <AgentActiveAnimation size={72} />
        </div>
        <div className="min-w-0">
          <div className="text-main flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight">
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
            MOAI is monitoring your positions and migrating out-of-range LP into
            the best Li.Fi Earn vault for your risk profile. Funds never leave
            your wallet.
          </p>
          {isSubscribed && (
            <div className="text-muted-soft mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              {lastCheckedAtSec > 0 && (
                <span>Last check {formatRelativeTime(lastCheckedAtSec)}</span>
              )}
              {lastTickAtSec > 0 && (
                <span>Last tick {formatRelativeTime(lastTickAtSec)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="bg-surface text-danger ring-soft hover:bg-danger-soft relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Power className="h-3 w-3" aria-hidden />
        )}
        Revoke
      </button>

      <MotionModal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        ariaLabel="Confirm revoke"
      >
        <div className="bg-surface ring-card mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="bg-danger-soft text-danger inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="text-main text-base font-semibold tracking-tight">
                Revoke agent?
              </div>
              <p className="text-muted mt-1 text-xs leading-snug">
                MOAI will stop monitoring your positions. You'll need to
                delegate again to re-enable auto-migrations.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
              className="bg-elevated text-main ring-soft hover:bg-brand-soft inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={busy}
              className="bg-danger hover:bg-danger/90 inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Power className="h-3.5 w-3.5" aria-hidden />
              )}
              Revoke
            </button>
          </div>
        </div>
      </MotionModal>
    </section>
  );
}
