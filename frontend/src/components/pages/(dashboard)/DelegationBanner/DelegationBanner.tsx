"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { getGuardedHookAddress, shortAddress } from "@/lib";
import { useDelegationStore } from "@/store";
import { DelegationModal } from "./DelegationModal";

const BASE_CHAIN_ID = 8453;

export function DelegationBanner() {
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const status = useDelegationStore((s) => s.status);
  const delegateAddress = useDelegationStore((s) => s.delegateAddress);
  const walletAddress = useDelegationStore((s) => s.walletAddress);
  const check = useDelegationStore((s) => s.check);
  const clear = useDelegationStore((s) => s.clear);

  const hookAddress = getGuardedHookAddress();
  const [modalOpen, setModalOpen] = useState(false);

  const account = walletClient?.account?.address ?? null;

  useEffect(() => {
    if (!publicClient) return;
    if (!account) {
      clear();
      return;
    }
    if (walletAddress?.toLowerCase() !== account.toLowerCase()) {
      void check(publicClient, account);
    }
  }, [publicClient, account, walletAddress, check, clear]);

  if (!account) return null;
  if (status === "delegated") return null;

  const isMatchingDelegate =
    delegateAddress && hookAddress
      ? delegateAddress.toLowerCase() === hookAddress.toLowerCase()
      : false;

  if (isMatchingDelegate) return null;

  const ready = Boolean(walletClient && hookAddress);

  return (
    <>
      <section className="bg-brand-soft ring-card flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-brand inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="text-main flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Sparkles className="text-brand h-3.5 w-3.5" aria-hidden />
              Enable agent migrations
            </div>
            <p className="text-muted mt-1 text-xs leading-snug">
              Sign one EIP-7702 delegation so the MOAI agent can move
              out-of-range positions to a Li.Fi Earn vault. Funds stay in your
              wallet — the GuardedExecutorHook only allows whitelisted calls
              {hookAddress ? ` (${shortAddress(hookAddress)})` : ""}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!ready}
          className="bg-brand hover:bg-brand-hover inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {ready ? "Delegate to MOAI" : "Hook deployment pending"}
        </button>
      </section>

      <DelegationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
