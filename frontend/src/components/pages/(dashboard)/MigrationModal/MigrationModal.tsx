"use client";

import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAccount, useWalletClient } from "wagmi";
import {
  Badge,
  MotionModal,
  ProtocolAvatar,
  Skeleton,
  TokenPairLogos,
} from "@/components/ui";
import { formatPercent, formatProtocolName, formatUsd } from "@/lib";
import {
  useHoldingsStore,
  useMigrationStore,
  usePositionsStore,
} from "@/store";
import { MigrationLegItem } from "./MigrationLegItem";

const BASE_CHAIN_ID = 8453;

export function MigrationModal() {
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const open = useMigrationStore((s) => s.open);
  const status = useMigrationStore((s) => s.status);
  const plan = useMigrationStore((s) => s.plan);
  const error = useMigrationStore((s) => s.error);
  const cancel = useMigrationStore((s) => s.cancel);
  const execute = useMigrationStore((s) => s.execute);
  const dismiss = useMigrationStore((s) => s.dismiss);
  const retryPositions = usePositionsStore((s) => s.retry);
  const loadHoldings = useHoldingsStore((s) => s.load);
  const { address } = useAccount();

  const handleExecute = () => {
    void execute({ walletClient: walletClient ?? null });
  };

  useEffect(() => {
    if (status === "complete") {
      toast(
        plan?.intent === "withdraw"
          ? "Withdrawal submitted"
          : "Migration submitted",
        {
          description: "Activity log updated. Refreshing positions…",
        },
      );
      void retryPositions();
      if (address) void loadHoldings(address);
    }
  }, [status, plan?.intent, retryPositions, loadHoldings, address]);

  const closing = status === "complete" ? dismiss : cancel;
  const ready = status === "ready" && plan !== null;
  const busy = status === "planning" || status === "executing";
  const isWithdraw = plan?.intent === "withdraw";

  return (
    <MotionModal open={open} onClose={closing} ariaLabel="Migrate position">
      <div className="bg-surface ring-card relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-brand-soft text-brand inline-flex h-9 w-9 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
                {isWithdraw ? "Withdrawal plan" : "Migration plan"}
              </div>
              <div className="text-main text-base font-semibold tracking-tight">
                {isWithdraw
                  ? "Redeem vault to wallet"
                  : "Move out-of-range position"}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={closing}
            className="text-muted hover:text-main h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {status === "planning" && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {status === "error" && (
          <div className="bg-elevated text-muted rounded-xl p-4 text-center text-xs">
            {error ?? "Failed to plan migration."}
          </div>
        )}

        {(ready || status === "executing" || status === "complete") && plan && (
          <>
            <section className="bg-brand-soft/50 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex shrink-0 items-center">
                  {plan.source.token0 && (
                    <TokenPairLogos
                      token0={plan.source.token0}
                      token1={plan.source.token1 ?? plan.source.token0}
                      size="sm"
                    />
                  )}
                  {plan.source.protocolLogoKey && (
                    <span className="bg-surface ring-soft absolute -right-1 -bottom-1 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full">
                      <ProtocolAvatar
                        protocolName={plan.source.protocolLogoKey}
                        size={16}
                      />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
                    From
                  </div>
                  <div className="text-main truncate text-sm font-semibold tracking-tight">
                    {plan.source.pair}
                  </div>
                  <div className="text-muted truncate text-[10px]">
                    {isWithdraw
                      ? `${formatProtocolName(plan.source.protocolLogoKey ?? "Vault")} · ${plan.source.chain}`
                      : `Uniswap ${plan.source.protocol} · ${formatPercent(plan.source.feeTier, 2)} · ${plan.source.chain}`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-main text-sm font-semibold tracking-tight">
                  {formatUsd(plan.source.valueUsd)}
                </div>
                {isWithdraw ? (
                  <Badge tone="outline">Holding</Badge>
                ) : (
                  <Badge tone="danger">Out of range</Badge>
                )}
              </div>
            </section>

            <section className="bg-success-soft/40 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProtocolAvatar
                  protocolName={plan.destination.protocolName}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
                    To
                  </div>
                  <div className="text-main truncate text-sm font-semibold tracking-tight">
                    {plan.destination.name}
                  </div>
                  <div className="text-muted truncate text-[10px]">
                    {formatProtocolName(plan.destination.protocolName)} ·{" "}
                    {plan.destination.underlyingTokenSymbol}
                  </div>
                </div>
              </div>
              <div className="text-right">
                {isWithdraw ? (
                  <>
                    <div className="text-main text-sm font-semibold tracking-tight">
                      {plan.destination.underlyingTokenSymbol}
                    </div>
                    <div className="text-muted text-[10px]">to wallet</div>
                  </>
                ) : (
                  <>
                    <div className="text-success text-sm font-semibold tracking-tight">
                      {formatPercent(plan.yield.apyPercent, 2)}
                    </div>
                    <div className="text-muted text-[10px]">APY</div>
                  </>
                )}
              </div>
            </section>

            <section>
              <div className="text-muted mb-2 px-1 text-[10px] font-medium tracking-wide uppercase">
                Atomic batch
              </div>
              <ul className="flex flex-col gap-1.5">
                {plan.legs.map((leg, i) => (
                  <MigrationLegItem
                    key={`${leg.kind}-${i.toString()}`}
                    leg={leg}
                    index={i}
                  />
                ))}
              </ul>
            </section>

            {!isWithdraw && (
              <section className="grid grid-cols-3 gap-2">
                <YieldStat
                  label="/ day"
                  value={formatUsd(plan.yield.perDayUsd)}
                />
                <YieldStat
                  label="/ month"
                  value={formatUsd(plan.yield.perMonthUsd)}
                />
                <YieldStat
                  label="/ year"
                  value={formatUsd(plan.yield.perYearUsd)}
                  accent
                />
              </section>
            )}
          </>
        )}

        {status !== "complete" && (
          <button
            type="button"
            onClick={handleExecute}
            disabled={!ready || busy}
            className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "executing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {isWithdraw ? "Withdrawing…" : "Migrating…"}
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {isWithdraw ? "Sign & withdraw" : "Sign & migrate"}
              </>
            )}
          </button>
        )}

        {status === "complete" && (
          <div className="bg-success-soft text-success flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold tracking-tight">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {isWithdraw ? "Withdrawal submitted" : "Migration submitted"}
          </div>
        )}
      </div>
    </MotionModal>
  );
}

function YieldStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-elevated rounded-xl px-3 py-2">
      <div className="text-muted text-[9px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-semibold tracking-tight ${accent ? "text-success" : "text-main"}`}
      >
        {value}
      </div>
    </div>
  );
}
