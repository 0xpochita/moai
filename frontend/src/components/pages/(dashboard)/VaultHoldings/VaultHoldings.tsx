"use client";

import { ArrowDownToLine, Loader2, Wallet } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useShallow } from "zustand/react/shallow";
import { ProtocolAvatar, Skeleton } from "@/components/ui";
import {
  formatPercent,
  formatProtocolName,
  formatUsd,
  getLocalTokenLogo,
} from "@/lib";
import { useHoldingsStore, useMigrationStore } from "@/store";
import type { PortfolioPosition } from "@/types";

const BASE_CHAIN_ID = 8453;

export function VaultHoldings() {
  const { address, isConnected } = useAccount();
  const positions = useHoldingsStore(useShallow((s) => s.positions));
  const status = useHoldingsStore((s) => s.status);
  const error = useHoldingsStore((s) => s.error);
  const ownerAddress = useHoldingsStore((s) => s.ownerAddress);
  const load = useHoldingsStore((s) => s.load);
  const clear = useHoldingsStore((s) => s.clear);

  useEffect(() => {
    if (!isConnected || !address) {
      clear();
      return;
    }
    if (ownerAddress?.toLowerCase() !== address.toLowerCase()) {
      void load(address);
    }
  }, [address, isConnected, ownerAddress, load, clear]);

  if (!isConnected || !address) return null;

  const totalUsd = positions.reduce(
    (sum, p) => sum + p.underlyingBalanceUsd,
    0,
  );

  return (
    <section className="bg-surface ring-card flex flex-col gap-3 rounded-2xl p-4">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="bg-brand-soft text-brand inline-flex h-7 w-7 items-center justify-center rounded-xl">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
              Vault holdings
            </div>
            <div className="text-main text-sm font-semibold tracking-tight">
              Your Li.Fi Earn positions
            </div>
          </div>
        </div>
        {positions.length > 0 && (
          <div className="text-right">
            <div className="text-muted text-[10px] font-medium tracking-wide uppercase">
              Total
            </div>
            <div className="text-main text-sm font-semibold tracking-tight">
              {formatUsd(totalUsd)}
            </div>
          </div>
        )}
      </header>

      {status === "loading" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="bg-elevated text-muted rounded-xl p-4 text-center text-xs">
          {error ?? "Could not load holdings."}
        </div>
      )}

      {status === "success" && positions.length === 0 && (
        <div className="bg-elevated text-muted rounded-xl p-4 text-center text-xs">
          No vault holdings yet. Once the agent migrates a position, it shows up
          here.
        </div>
      )}

      {status === "success" && positions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {positions.map((p) => (
            <HoldingCard key={`${p.vaultAddress}`} position={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function HoldingCard({ position }: { position: PortfolioPosition }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: BASE_CHAIN_ID });
  const startWithdrawal = useMigrationStore((s) => s.startWithdrawal);
  const status = useMigrationStore((s) => s.status);
  const planTokenId = useMigrationStore((s) => s.plan?.positionTokenId);
  const intent = useMigrationStore((s) => s.plan?.intent);

  const isThisRowBusy =
    intent === "withdraw" &&
    planTokenId?.toLowerCase() === position.vaultAddress.toLowerCase() &&
    (status === "planning" || status === "executing");

  const handleWithdraw = () => {
    if (!address || !walletClient) return;
    void startWithdrawal(address, position.vaultAddress);
  };

  const pnl = position.pnlUsd;
  const pnlPositive = pnl >= 0;
  const hasApy = position.apyTotal > 0;

  return (
    <div className="bg-elevated flex flex-col gap-2 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <TokenLogo
              address={position.underlyingTokenAddress}
              symbol={position.underlyingTokenSymbol}
              chainId={position.chainId}
              size={32}
            />
            <span className="bg-surface ring-soft absolute -right-1 -bottom-1 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full">
              <ProtocolAvatar
                protocolName={position.protocolName}
                size={16}
              />
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-main truncate text-sm font-semibold tracking-tight">
              {position.vaultName}
            </div>
            <div className="text-muted-soft truncate text-[11px]">
              {formatProtocolName(position.protocolName)} ·{" "}
              {position.underlyingTokenSymbol}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-xs font-semibold tracking-tight ${hasApy ? "text-success" : "text-muted"}`}
          >
            {hasApy ? formatPercent(position.apyTotal, 2) : "—"}
          </div>
          <div className="text-muted-soft text-[10px]">APY</div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-main text-base font-semibold tracking-tight">
            {formatUsd(position.underlyingBalanceUsd)}
          </div>
          {pnl !== 0 && (
            <div
              className={`text-[10px] font-medium ${
                pnlPositive ? "text-success" : "text-warning"
              }`}
            >
              {pnlPositive ? "+" : ""}
              {formatUsd(pnl)} PnL
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={!address || !walletClient || isThisRowBusy}
          className="bg-surface text-main ring-soft hover:bg-elevated inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-tight transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isThisRowBusy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <ArrowDownToLine className="h-3 w-3" aria-hidden />
          )}
          Withdraw
        </button>
      </div>
    </div>
  );
}

function TokenLogo({
  address,
  symbol,
  chainId,
  size,
}: {
  address: string;
  symbol: string;
  chainId: number;
  size: number;
}) {
  const [errored, setErrored] = useState(false);
  const local = getLocalTokenLogo(address);
  const slug = chainId === 8453 ? "base" : "ethereum";
  const remote = `https://dd.dexscreener.com/ds-data/tokens/${slug}/${address.toLowerCase()}.png`;
  const src = local ?? remote;

  if (errored) {
    return (
      <span
        style={{ height: size, width: size }}
        className="bg-brand-soft text-brand inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-tight uppercase"
      >
        {symbol.charAt(0)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={symbol}
      width={size}
      height={size}
      style={{ height: size, width: size }}
      className="bg-surface ring-soft shrink-0 rounded-full object-cover"
      onError={() => setErrored(true)}
      unoptimized
    />
  );
}
