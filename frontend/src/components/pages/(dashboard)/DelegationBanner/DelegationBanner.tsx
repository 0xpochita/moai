"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { AgentInactiveAnimation } from "@/components/ui";
import { getCaliburHookAddress, shortAddress } from "@/lib";
import { useAgentStatusStore, useDelegationStore, useUiStore } from "@/store";
import { DelegationModal } from "./DelegationModal";

const BASE_CHAIN_ID = 8453;

export function DelegationBanner() {
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const walletAddress = useDelegationStore((s) => s.walletAddress);
  const check = useDelegationStore((s) => s.check);
  const clear = useDelegationStore((s) => s.clear);

  const agentStatus = useAgentStatusStore((s) => s.status);
  const refreshAgentStatus = useAgentStatusStore((s) => s.refresh);

  const hookAddress = getCaliburHookAddress();

  const modalOpen = useUiStore((s) => s.delegationModalOpen);
  const openModal = useUiStore((s) => s.openDelegationModal);
  const closeModal = useUiStore((s) => s.closeDelegationModal);

  const account = walletClient?.account?.address ?? null;

  useEffect(() => {
    if (!publicClient) return;
    if (!account) {
      clear();
      return;
    }
    if (walletAddress?.toLowerCase() !== account.toLowerCase()) {
      void check(publicClient, account);
      void refreshAgentStatus(account);
    }
  }, [publicClient, account, walletAddress, check, clear, refreshAgentStatus]);

  if (!account) return null;

  // Truth: hide banner only when on-chain agent is fully wired up
  // (Calibur-delegated AND agent key registered). Stale local state
  // can't fool this check.
  const isAgentLive = Boolean(
    agentStatus?.caliburDelegated && agentStatus?.agentRegistered,
  );

  if (isAgentLive) {
    // Banner hidden; modal still mounted so other components can open it.
    return <DelegationModal open={modalOpen} onClose={closeModal} />;
  }

  const ready = Boolean(walletClient && hookAddress);

  return (
    <>
      <section className="bg-linear-to-r from-[#fff0f6] to-[#ffe4ee] dark:from-[#1d1f2a] dark:to-[#241828] ring-card relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
        <span
          aria-hidden
          className="bg-brand/5 pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full blur-2xl"
        />
        <div className="relative flex items-center gap-3">
          <div className="shrink-0">
            <AgentInactiveAnimation size={72} />
          </div>
          <div>
            <div className="text-main flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Sparkles className="text-brand h-3.5 w-3.5" aria-hidden />
              Enable agent migrations
            </div>
            <p className="text-muted mt-1 text-xs leading-snug">
              Sign once so the MOAI agent can move out-of-range positions to a
              Li.Fi Earn vault. Funds stay in your wallet — the validator hook
              only allows whitelisted calls
              {hookAddress ? ` (${shortAddress(hookAddress)})` : ""}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openModal}
          disabled={!ready}
          className="bg-brand hover:bg-brand-hover inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {ready ? "Delegate to MOAI" : "Hook deployment pending"}
        </button>
      </section>

      <DelegationModal open={modalOpen} onClose={closeModal} />
    </>
  );
}
