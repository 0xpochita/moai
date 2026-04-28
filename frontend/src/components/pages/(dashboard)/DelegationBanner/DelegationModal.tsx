"use client";

import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useWalletClient } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { RiskProfilePicker } from "@/components/pages/(dashboard)/SettingsPanel";
import {
  getGuardedHookAddress,
  shortAddress,
  submitSelfDelegationTx,
} from "@/lib";
import { useDelegationStore, usePositionsStore } from "@/store";

const BASE_CHAIN_ID = 8453;
const EXPIRY_DAYS = 30;

type DelegationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DelegationModal({ open, onClose }: DelegationModalProps) {
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const status = useDelegationStore((s) => s.status);
  const markDelegated = useDelegationStore((s) => s.markDelegated);
  const positions = usePositionsStore(useShallow((s) => s.positions));

  const hookAddress = getGuardedHookAddress();
  const [step, setStep] = useState<"prepare" | "signing" | "active">(
    status === "delegated" ? "active" : "prepare",
  );

  if (!open) return null;

  const eligibleCount = positions.filter((p) => p.status !== "closed").length;

  const handleContinue = async () => {
    if (!walletClient || !hookAddress) {
      toast("Hook contract not deployed yet", {
        description:
          "Set NEXT_PUBLIC_GUARDED_HOOK_ADDRESS once the GuardedExecutorHook is on-chain.",
      });
      return;
    }
    setStep("signing");
    try {
      const txHash = await submitSelfDelegationTx({
        walletClient,
        delegate: hookAddress,
        chainId: BASE_CHAIN_ID,
      });
      markDelegated(hookAddress);
      toast("Delegation submitted", {
        description: `Tx ${shortAddress(txHash)} on Base.`,
      });
      setStep("active");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign authorization";
      toast("Delegation failed", { description: message });
      setStep("prepare");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delegate to MOAI"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        type="button"
        aria-label="Close delegation modal"
        onClick={onClose}
        className="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
      />

      <div className="bg-surface ring-card relative flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-brand-soft text-brand inline-flex h-9 w-9 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="text-main text-base font-semibold tracking-tight">
                Delegate to MOAI
              </div>
              <div className="text-muted text-[11px] leading-snug">
                Grant MOAI permission to automatically rebalance{" "}
                {eligibleCount > 0 ? `${eligibleCount} ` : ""}position
                {eligibleCount === 1 ? "" : "s"}.
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted hover:text-main inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <Stepper step={step} />

        {step === "prepare" && (
          <>
            <section className="ring-soft flex flex-col gap-2 rounded-xl p-4">
              <div className="text-main text-xs font-semibold tracking-tight">
                What happens when you delegate?
              </div>
              <ol className="text-muted flex flex-col gap-1.5 text-[11px] leading-snug">
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">1.</span>
                  <span>
                    Your wallet delegates to a smart account (Calibur via
                    EIP-7702).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">2.</span>
                  <span>
                    The MOAI agent's key is registered with restricted
                    permissions.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">3.</span>
                  <span>
                    The agent can only call whitelisted Uniswap V4 + Li.Fi Earn
                    functions.
                  </span>
                </li>
              </ol>
            </section>

            <section className="ring-soft flex flex-col gap-2 rounded-xl p-4">
              <div className="text-main text-xs font-semibold tracking-tight">
                Risk profile
              </div>
              <p className="text-muted-soft text-[11px] leading-snug">
                Tells the agent how to pick destination vaults on Li.Fi Earn.
              </p>
              <RiskProfilePicker variant="stacked" />
            </section>

            <section className="ring-soft flex flex-col gap-1.5 rounded-xl p-4 text-[11px]">
              <SummaryRow
                label="Agent contract"
                value={hookAddress ? shortAddress(hookAddress) : "Loading…"}
              />
              <SummaryRow
                label="Scope"
                value={`${eligibleCount} position${eligibleCount === 1 ? "" : "s"}`}
              />
              <SummaryRow label="Expiry" value={`${EXPIRY_DAYS} days`} />
              <SummaryRow label="Guard" value="GuardedExecutorHook" />
            </section>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!walletClient || !hookAddress}
              className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Continue to sign
            </button>
          </>
        )}

        {step === "signing" && (
          <div className="bg-elevated flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <Loader2 className="text-brand h-6 w-6 animate-spin" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Signing authorization…
            </div>
            <p className="text-muted text-[11px] leading-snug">
              Approve the EIP-7702 authorization in your wallet. This is a
              one-time signature; no funds move yet.
            </p>
          </div>
        )}

        {step === "active" && (
          <div className="bg-success-soft flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <CheckCircle2 className="text-success h-6 w-6" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Delegation active
            </div>
            <p className="text-muted text-[11px] leading-snug">
              MOAI can now migrate out-of-range positions on your behalf. Enable
              Autopilot to let the agent run autonomously.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-surface text-main ring-soft hover:bg-elevated mt-1 inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold tracking-tight transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-main font-medium">{value}</span>
    </div>
  );
}

function Stepper({ step }: { step: "prepare" | "signing" | "active" }) {
  const steps: Array<{
    key: typeof step;
    label: string;
    icon: typeof ShieldCheck;
  }> = [
    { key: "prepare", label: "Prepare", icon: ShieldCheck },
    { key: "signing", label: "Sign", icon: KeyRound },
    { key: "active", label: "Active", icon: Sparkles },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const reached = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <div
            key={s.key}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <div className="flex flex-col items-center gap-1">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  reached
                    ? active
                      ? "bg-brand text-white"
                      : "bg-brand-soft text-brand"
                    : "bg-elevated text-muted-soft"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span
                className={`text-[10px] font-medium tracking-tight ${
                  active ? "text-main" : "text-muted-soft"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`h-px flex-1 ${
                  i < currentIndex ? "bg-brand" : "bg-elevated"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
