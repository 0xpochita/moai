"use client";

import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Hex } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { RiskProfilePicker } from "@/components/pages/(dashboard)/SettingsPanel";
import { MotionModal } from "@/components/ui";
import { getCaliburHookAddress, shortAddress } from "@/lib";
import {
  CALIBUR_SINGLETON,
  type CaliburCall,
  type CaliburSignedBatchedCall,
  signedBatchedCallTypedData,
} from "@/lib/calibur";
import { submitSelfDelegationTx } from "@/lib/eip7702";
import {
  buildRegistration,
  type JsonSignedBatchedCall,
  relayAgent,
} from "@/services";
import { useDelegationStore, useKeeperStore, usePositionsStore } from "@/store";

const BASE_CHAIN_ID = 8453;
const EXPIRY_DAYS = 30;

type Step = "prepare" | "delegate" | "register" | "active";

type DelegationModalProps = {
  open: boolean;
  onClose: () => void;
};

function reviveCalls(
  json: JsonSignedBatchedCall["batchedCall"]["calls"],
): CaliburCall[] {
  return json.map((c) => ({
    to: c.to as `0x${string}`,
    value: BigInt(c.value),
    data: c.data as Hex,
  }));
}

function reviveSignedBatchedCall(
  json: JsonSignedBatchedCall,
): CaliburSignedBatchedCall {
  return {
    batchedCall: {
      calls: reviveCalls(json.batchedCall.calls),
      revertOnFailure: json.batchedCall.revertOnFailure,
    },
    nonce: BigInt(json.nonce),
    keyHash: json.keyHash as Hex,
    executor: json.executor as `0x${string}`,
    deadline: BigInt(json.deadline),
  };
}

export function DelegationModal({ open, onClose }: DelegationModalProps) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const status = useDelegationStore((s) => s.status);
  const delegateAddress = useDelegationStore((s) => s.delegateAddress);
  const markDelegated = useDelegationStore((s) => s.markDelegated);
  const positions = usePositionsStore(useShallow((s) => s.positions));
  const enableKeeper = useKeeperStore((s) => s.enable);

  const hookAddress = getCaliburHookAddress();
  const eligibleCount = positions.filter((p) => p.status !== "closed").length;

  const alreadyDelegatedToCalibur = useMemo(() => {
    return delegateAddress?.toLowerCase() === CALIBUR_SINGLETON.toLowerCase();
  }, [delegateAddress]);

  const [step, setStep] = useState<Step>(
    status === "delegated" ? "active" : "prepare",
  );
  const [busy, setBusy] = useState(false);

  // Reset to "prepare" each time the modal reopens.
  useEffect(() => {
    if (!open) return;
    setStep(status === "delegated" ? "active" : "prepare");
    setBusy(false);
  }, [open, status]);

  const handleContinue = async () => {
    if (!walletClient || !address || !hookAddress) {
      toast("Hook contract not configured", {
        description: "Set NEXT_PUBLIC_CALIBUR_HOOK_ADDRESS first.",
      });
      return;
    }

    setBusy(true);

    try {
      // Step A — EIP-7702 self-delegation to the Calibur singleton (if not
      // already there). Reuse the existing helper (it sends a type-4 tx).
      if (!alreadyDelegatedToCalibur) {
        setStep("delegate");
        const txHash = await submitSelfDelegationTx({
          walletClient,
          delegate: CALIBUR_SINGLETON,
          chainId: BASE_CHAIN_ID,
        });
        toast("EIP-7702 delegation submitted", {
          description: `Tx ${shortAddress(txHash)} on Base.`,
        });
        // Wait briefly for the block; the next call needs the EOA's bytecode
        // to be Calibur.
        await new Promise((r) => setTimeout(r, 2500));
      }

      // Step B — fetch the typed-data envelope from the relayer.
      setStep("register");
      const envelope = await buildRegistration(address);

      // Step C — user signs the EIP-712 typed data (no transaction).
      // viem's signTypedData uses tightly inferred generics; cast the args
      // since the typehashes come back from the server as plain JSON.
      const sig = (await walletClient.signTypedData({
        account: walletClient.account!,
        domain: envelope.typedData.domain,
        types: envelope.typedData.types,
        primaryType: envelope.typedData.primaryType,
        message: reviveSignedBatchedCall(envelope.signedBatchedCall),
        // biome-ignore lint/suspicious/noExplicitAny: viem typed-data generics
      } as any)) as Hex;

      // Step D — relayer submits the registration call paying gas.
      const relay = await relayAgent({
        owner: address,
        signedBatchedCall: envelope.signedBatchedCall,
        signature: sig,
      });

      markDelegated(CALIBUR_SINGLETON);
      toast("Agent registered", {
        description: `Tx ${shortAddress(relay.txHash)} on Base.`,
      });

      void enableKeeper(address).catch(() => {
        // keeper offline — agent still works, just no auto-trigger
      });

      setStep("active");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign authorization";
      toast("Delegation failed", { description: message });
      setStep("prepare");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionModal
      open={open}
      onClose={onClose}
      ariaLabel="Delegate to MOAI agent"
    >
      <div className="bg-surface ring-card relative mx-auto flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-2xl p-5">
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

        <Stepper step={step} skipDelegate={alreadyDelegatedToCalibur} />

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
                    {alreadyDelegatedToCalibur
                      ? "Your wallet is already a smart account (Calibur via EIP-7702)."
                      : "Your wallet delegates to the Calibur smart account (EIP-7702)."}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">2.</span>
                  <span>
                    The MOAI agent's key is registered on your account with a
                    30-day expiry and a hook that whitelists Uniswap v4 + Li.Fi
                    Earn calls only.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">3.</span>
                  <span>
                    Funds never leave your wallet. The agent submits batched
                    calls; the hook validates each one before execution.
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
                label="Smart account"
                value={shortAddress(CALIBUR_SINGLETON)}
              />
              <SummaryRow
                label="Hook"
                value={hookAddress ? shortAddress(hookAddress) : "Loading…"}
              />
              <SummaryRow
                label="Scope"
                value={`${eligibleCount} position${eligibleCount === 1 ? "" : "s"}`}
              />
              <SummaryRow label="Expiry" value={`${EXPIRY_DAYS} days`} />
            </section>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!walletClient || !hookAddress || busy}
              className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Continue
            </button>
          </>
        )}

        {step === "delegate" && (
          <div className="bg-elevated flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <Loader2 className="text-brand h-6 w-6 animate-spin" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Awaiting EIP-7702 signature…
            </div>
            <p className="text-muted text-[11px] leading-snug">
              Sign the authorization in your wallet. This sets your wallet's
              code to the Calibur smart account.
            </p>
          </div>
        )}

        {step === "register" && (
          <div className="bg-elevated flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <Loader2 className="text-brand h-6 w-6 animate-spin" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Sign agent registration
            </div>
            <p className="text-muted text-[11px] leading-snug">
              Sign the EIP-712 typed-data message in your wallet — no
              transaction here. Our relayer submits it for you.
            </p>
          </div>
        )}

        {step === "active" && (
          <div className="bg-success-soft flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <CheckCircle2 className="text-success h-6 w-6" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Agent active
            </div>
            <p className="text-muted text-[11px] leading-snug">
              MOAI is watching your positions. The 30-day key auto-expires; you
              can revoke any time.
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
    </MotionModal>
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

function Stepper({
  step,
  skipDelegate,
}: {
  step: Step;
  skipDelegate: boolean;
}) {
  const allSteps: Array<{
    key: Step;
    label: string;
    icon: typeof ShieldCheck;
  }> = [
    { key: "prepare", label: "Prepare", icon: ShieldCheck },
    { key: "delegate", label: "Delegate", icon: KeyRound },
    { key: "register", label: "Register", icon: Send },
    { key: "active", label: "Active", icon: Sparkles },
  ];
  const steps = skipDelegate
    ? allSteps.filter((s) => s.key !== "delegate")
    : allSteps;
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
