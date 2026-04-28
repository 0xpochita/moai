"use client";

import {
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
import { useAccount, usePublicClient } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { RiskProfilePicker } from "@/components/pages/(dashboard)/SettingsPanel";
import { MotionModal, SuccessAnimation } from "@/components/ui";
import { getCaliburHookAddress, shortAddress, toastTx } from "@/lib";
import { CALIBUR_DOMAIN_SALT, CALIBUR_SINGLETON } from "@/lib/calibur";
import { buildRegistration, relayAgent } from "@/services";
import {
  useAgentStatusStore,
  useDelegationStore,
  useKeeperStore,
  usePositionsStore,
} from "@/store";

const BASE_CHAIN_ID = 8453;
const EXPIRY_DAYS = 30;

type Step = "prepare" | "sign" | "relaying" | "active";

type DelegationModalProps = {
  open: boolean;
  onClose: () => void;
};

// EIP-712 type definitions matching Calibur's Call / BatchedCall /
// SignedBatchedCall type strings verbatim. Including EIP712Domain in the
// types map is necessary for `eth_signTypedData_v4` so the wallet builds
// the right domain separator (which uses the salt field).
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

function isCaliburCode(code: string | undefined): boolean {
  if (!code || code === "0x" || code.length < 46) return false;
  const lower = code.toLowerCase();
  const expected = `0xef0100${CALIBUR_SINGLETON.slice(2).toLowerCase()}`;
  return lower.startsWith(expected);
}

export function DelegationModal({ open, onClose }: DelegationModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const markDelegated = useDelegationStore((s) => s.markDelegated);
  const positions = usePositionsStore(useShallow((s) => s.positions));
  const enableKeeper = useKeeperStore((s) => s.enable);
  const agentStatus = useAgentStatusStore((s) => s.status);
  const refreshAgentStatus = useAgentStatusStore((s) => s.refresh);

  const hookAddress = getCaliburHookAddress();
  const eligibleCount = positions.filter((p) => p.status !== "closed").length;

  // Truth: agent already active = on-chain confirms BOTH the EOA is
  // Calibur-delegated AND the agent key is registered. We never trust
  // local "I clicked it" state.
  const isAgentLive = useMemo(
    () =>
      Boolean(agentStatus?.caliburDelegated && agentStatus?.agentRegistered),
    [agentStatus?.caliburDelegated, agentStatus?.agentRegistered],
  );

  const initialStep: Step = isAgentLive ? "active" : "prepare";
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setBusy(false);
    if (address) void refreshAgentStatus(address);
  }, [open, initialStep, address, refreshAgentStatus]);

  const handleContinue = async () => {
    if (!address || !publicClient || !hookAddress) {
      toast("Hook contract not configured", {
        description: "Set NEXT_PUBLIC_CALIBUR_HOOK_ADDRESS first.",
      });
      return;
    }

    setBusy(true);

    try {
      // Pre-flight: the EOA must already be delegated to Calibur. Smart
      // Wallets (Uniswap, Coinbase) inject this delegation lazily on
      // their first transaction.
      const code = await publicClient.getCode({ address });
      if (!isCaliburCode(code)) {
        toast("Wallet not yet delegated to Calibur", {
          description:
            "Open Uniswap Wallet → enable Smart Wallet (Settings → Advanced) → do any tx (e.g. tiny swap). Or use Coinbase Smart Wallet.",
        });
        setBusy(false);
        return;
      }

      // Switch wallet to Base before signing.
      const provider = (window as { ethereum?: EthereumProvider }).ethereum;
      if (!provider) throw new Error("No wallet provider available");
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch {
        // some wallets don't expose this; ignore
      }

      // Server builds the registration batch (register + update). Returns
      // the typed-data envelope + JSON-safe SignedBatchedCall struct.
      setStep("sign");
      const envelope = await buildRegistration(address);

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

      // Relayer submits Calibur.execute(SignedBatchedCall, signature).
      setStep("relaying");
      const relay = await relayAgent({
        owner: address,
        signedBatchedCall: envelope.signedBatchedCall,
        signature,
      });

      toastTx({
        title: "Agent registration submitted",
        txHash: relay.txHash,
      });

      try {
        await publicClient.waitForTransactionReceipt({
          hash: relay.txHash,
          timeout: 60_000,
        });
      } catch {
        // best-effort wait — backend may have already confirmed
      }

      markDelegated(CALIBUR_SINGLETON);
      // Re-read on-chain so banner/status bar reflect actual registration.
      await refreshAgentStatus(address).catch(() => {});
      void enableKeeper(address).catch(() => {
        // keeper offline — agent still works, no auto-trigger
      });

      setStep("active");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not activate agent";
      toast("Activation failed", { description: message });
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
                    Your wallet must already be delegated to Calibur — Uniswap
                    Wallet (Smart Wallet enabled, after first tx) or Coinbase
                    Smart Wallet does this for you.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">2.</span>
                  <span>
                    You sign one EIP-712 typed-data message (no transaction)
                    that registers the agent's key with a 30-day expiry + a hook
                    that whitelists Uniswap v4 + Li.Fi Earn calls.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-soft shrink-0">3.</span>
                  <span>
                    Our relayer submits that signature on-chain and pays the
                    gas. Funds never leave your wallet.
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
              disabled={!address || !hookAddress || busy}
              className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Continue
            </button>
          </>
        )}

        {step === "sign" && (
          <div className="bg-elevated flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <Loader2 className="text-brand h-6 w-6 animate-spin" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Sign the registration message
            </div>
            <p className="text-muted text-[11px] leading-snug">
              Approve the typed-data signature in your wallet. No transaction,
              no gas — our relayer submits it.
            </p>
          </div>
        )}

        {step === "relaying" && (
          <div className="bg-elevated flex flex-col items-center gap-3 rounded-xl p-6 text-center">
            <Loader2 className="text-brand h-6 w-6 animate-spin" aria-hidden />
            <div className="text-main text-sm font-semibold tracking-tight">
              Relaying to Base…
            </div>
            <p className="text-muted text-[11px] leading-snug">
              Tx submitted by the relayer. Waiting for confirmation.
            </p>
          </div>
        )}

        {step === "active" && (
          <div className="bg-success-soft flex flex-col items-center gap-2 rounded-xl p-6 text-center">
            <SuccessAnimation size={140} loop />
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

function Stepper({ step }: { step: Step }) {
  const steps: Array<{
    key: Step;
    label: string;
    icon: typeof ShieldCheck;
  }> = [
    { key: "prepare", label: "Prepare", icon: ShieldCheck },
    { key: "sign", label: "Sign", icon: KeyRound },
    { key: "relaying", label: "Relay", icon: Send },
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
