"use client";

import { Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  Badge,
  MigrationPlanAnimation,
  MotionModal,
  ProtocolAvatar,
  Skeleton,
  SuccessAnimation,
  TokenPairLogos,
} from "@/components/ui";
import {
  formatPercent,
  formatProtocolName,
  formatUsd,
  getLocalTokenLogo,
  toastTx,
} from "@/lib";
import {
  type RiskProfile,
  useHoldingsStore,
  useMigrationStore,
  usePositionsStore,
  useSettingsStore,
  useUiStore,
} from "@/store";

const STRATEGY_COPY: Record<
  RiskProfile,
  { headline: string; detail: string; protocols: string[] }
> = {
  conservative: {
    headline: "Conservative Agent strategy",
    detail:
      "Routing to the highest-TVL bluechip. Yield capped for capital safety.",
    protocols: ["aave", "compound", "lido"],
  },
  balanced: {
    headline: "Balanced Agent strategy",
    detail: "Picking the best APY across blue-chips. Default risk-adjusted route.",
    protocols: ["morpho", "aave", "compound"],
  },
  aggressive: {
    headline: "Aggressive Agent strategy",
    detail: "Maximizing APY across yield protocols. Higher reward, higher risk.",
    protocols: ["pendle", "ethena", "yearn", "euler", "etherfi"],
  },
};
import { MigrationLegItem } from "./MigrationLegItem";

export function MigrationModal() {
  const open = useMigrationStore((s) => s.open);
  const status = useMigrationStore((s) => s.status);
  const plan = useMigrationStore((s) => s.plan);
  const error = useMigrationStore((s) => s.error);
  const txHash = useMigrationStore((s) => s.txHash);
  const withdrawalTarget = useMigrationStore((s) => s.withdrawalTarget);
  const cancel = useMigrationStore((s) => s.cancel);
  const execute = useMigrationStore((s) => s.execute);
  const dismiss = useMigrationStore((s) => s.dismiss);
  const retryPositions = usePositionsStore((s) => s.retry);
  const loadHoldings = useHoldingsStore((s) => s.load);
  const { address } = useAccount();

  const handleExecute = () => {
    void execute({ owner: address ?? null });
  };

  const openDelegationModal = useUiStore((s) => s.openDelegationModal);
  const needsDelegation =
    status === "error" &&
    typeof error === "string" &&
    /agent\s+not\s+registered|delegate\s+first/i.test(error);
  const handleDelegate = () => {
    cancel();
    openDelegationModal();
  };

  useEffect(() => {
    if (status === "complete") {
      toastTx({
        title:
          plan?.intent === "withdraw"
            ? "Withdrawal submitted"
            : "Migration submitted",
        txHash: txHash ?? undefined,
      });
      void retryPositions();
      if (address) void loadHoldings(address);
    }
  }, [status, plan?.intent, txHash, retryPositions, loadHoldings, address]);

  const closing = status === "complete" ? dismiss : cancel;
  const ready = status === "ready" && plan !== null;
  const busy = status === "planning" || status === "executing";
  const isWithdraw =
    plan?.intent === "withdraw" || withdrawalTarget !== null;
  const riskProfile = useSettingsStore((s) => s.riskProfile);
  const strategy = STRATEGY_COPY[riskProfile];

  return (
    <MotionModal open={open} onClose={closing} ariaLabel="Migrate position">
      <div className="bg-surface ring-card relative mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center">
              <MigrationPlanAnimation size={48} />
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
            className="text-muted hover:bg-elevated hover:text-main h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors"
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
          <div className="bg-elevated rounded-xl p-4 text-center">
            <p className="text-muted text-xs">
              {error ?? "Failed to plan migration."}
            </p>
            {needsDelegation && (
              <p className="text-muted-soft mt-2 text-[11px] leading-snug">
                Click{" "}
                <span className="text-brand font-semibold">
                  Delegate to MOAI
                </span>{" "}
                below to register the agent on your wallet (one signature, no
                gas), then come back to migrate.
              </p>
            )}
          </div>
        )}

        {(ready || status === "executing" || status === "complete") && plan && (
          <>
            {!isWithdraw && (
              <section className="bg-brand-soft/40 ring-soft flex items-center gap-3 rounded-xl px-4 py-3 ring-1">
                <span className="bg-brand text-white inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-main text-xs font-semibold tracking-tight">
                    {strategy.headline}
                  </div>
                  <div className="text-muted mt-0.5 text-[11px] leading-snug">
                    {strategy.detail}
                  </div>
                </div>
                <div className="flex shrink-0 items-center -space-x-1.5">
                  {strategy.protocols.map((p) => (
                    <span
                      key={p}
                      title={formatProtocolName(p)}
                      className="bg-surface inline-flex items-center justify-center overflow-hidden rounded-full ring-2 ring-white"
                    >
                      <ProtocolAvatar protocolName={p} size={22} />
                    </span>
                  ))}
                </div>
              </section>
            )}
            <section className="bg-brand-soft/50 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {isWithdraw ? (
                  <div className="relative shrink-0">
                    <ProtocolAvatar
                      protocolName={plan.source.protocolLogoKey ?? "Vault"}
                      size={32}
                    />
                    <span className="bg-surface ring-soft absolute -right-1 -bottom-1 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full">
                      <Image
                        src="/Assets/Images/logo-brand/base-logo.jpg"
                        alt="Base"
                        width={16}
                        height={16}
                        className="object-cover"
                        unoptimized
                      />
                    </span>
                  </div>
                ) : (
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
                )}
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
                <div className="relative shrink-0">
                  {isWithdraw ? (
                    <DestinationTokenLogo
                      address={plan.destination.underlyingTokenAddress}
                      symbol={plan.destination.underlyingTokenSymbol}
                      size={32}
                    />
                  ) : (
                    <ProtocolAvatar
                      protocolName={plan.destination.protocolName}
                      size={32}
                    />
                  )}
                  <span className="bg-surface ring-soft absolute -right-1 -bottom-1 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full">
                    <Image
                      src="/Assets/Images/logo-brand/base-logo.jpg"
                      alt="Base"
                      width={16}
                      height={16}
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
                    To
                  </div>
                  <div className="text-main truncate text-sm font-semibold tracking-tight">
                    {plan.destination.name}
                  </div>
                  <div className="text-muted truncate text-[10px]">
                    {isWithdraw
                      ? `${plan.destination.underlyingTokenSymbol} · Base`
                      : `${formatProtocolName(plan.destination.protocolName)} · ${plan.destination.underlyingTokenSymbol}`}
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

        {status !== "complete" &&
          (needsDelegation ? (
            <button
              type="button"
              onClick={handleDelegate}
              className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Delegate to MOAI
            </button>
          ) : (
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
                  {isWithdraw ? "Confirm withdrawal" : "Confirm migration"}
                </>
              )}
            </button>
          ))}

        {status === "complete" && (
          <div className="bg-success-soft text-success flex flex-col items-center gap-1 rounded-xl py-4 text-sm font-semibold tracking-tight">
            <SuccessAnimation size={120} loop />
            {isWithdraw ? "Withdrawal submitted" : "Migration submitted"}
          </div>
        )}
      </div>
    </MotionModal>
  );
}

function DestinationTokenLogo({
  address,
  symbol,
  size,
}: {
  address: string;
  symbol: string;
  size: number;
}) {
  const local = getLocalTokenLogo(address);
  const remote = `https://dd.dexscreener.com/ds-data/tokens/base/${address.toLowerCase()}.png`;
  return <FallbackImage src={local ?? remote} alt={symbol} size={size} />;
}

function FallbackImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: number;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return <SymbolBadge symbol={alt} size={size} />;
  return (
    <span
      style={{ height: size, width: size }}
      className="bg-surface ring-soft inline-flex items-center justify-center overflow-hidden rounded-full"
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ height: size, width: size }}
        className="object-cover"
        onError={() => setErrored(true)}
        unoptimized
      />
    </span>
  );
}

function SymbolBadge({ symbol, size }: { symbol: string; size: number }) {
  return (
    <span
      style={{ height: size, width: size }}
      className="bg-brand-soft text-brand inline-flex items-center justify-center rounded-full text-[10px] font-bold tracking-tight uppercase"
    >
      {symbol.slice(0, 2)}
    </span>
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
