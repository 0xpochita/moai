"use client";

import {
  ArrowRightLeft,
  ArrowUpRight,
  CheckCircle2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { ProtocolAvatar } from "@/components/ui";
import {
  explorerTxUrl,
  formatProtocolName,
  formatRelativeTime,
} from "@/lib";
import {
  type RiskProfile,
  useAgentActionsStore,
  useSettingsStore,
} from "@/store";
import type {
  AgentAction,
  AgentActionType,
  NetworkId,
  Position,
} from "@/types";

const ICON_MAP: Record<AgentActionType, typeof ArrowRightLeft> = {
  migrate: ArrowRightLeft,
  delegation: CheckCircle2,
  exit: LogOut,
};

const MAX_VISIBLE = 3;

const STRATEGY_COPY: Record<
  RiskProfile,
  { headline: string; tagline: string; protocols: string[] }
> = {
  conservative: {
    headline: "Conservative",
    tagline: "Highest-TVL bluechips.",
    protocols: ["aave", "compound", "lido"],
  },
  balanced: {
    headline: "Balanced",
    tagline: "Best APY across blue-chips.",
    protocols: ["morpho", "aave", "compound"],
  },
  aggressive: {
    headline: "Aggressive",
    tagline: "Max APY across yield protocols.",
    protocols: ["pendle", "ethena", "yearn", "euler", "etherfi"],
  },
};

type PositionActivityProps = {
  position: Position;
};

export function PositionActivity({ position }: PositionActivityProps) {
  const riskProfile = useSettingsStore((s) => s.riskProfile);
  const strategy = STRATEGY_COPY[riskProfile];

  const filtered = useAgentActionsStore(
    useShallow((s) => {
      const tokenId = position.tokenId;
      const local = s.actions.filter((a) => a.positionTokenId === tokenId);
      const remote = s.remoteActions.filter(
        (a) => a.positionTokenId === tokenId,
      );
      return [...remote, ...local].sort(
        (a, b) => b.createdAtSec - a.createdAtSec,
      );
    }),
  );

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between px-1">
        <span className="text-muted text-[11px] font-medium tracking-wide uppercase">
          Agent strategy
        </span>
        {filtered.length > MAX_VISIBLE && (
          <span className="text-muted-soft text-[10px]">
            {MAX_VISIBLE} of {filtered.length}
          </span>
        )}
      </header>

      <div className="bg-brand-soft/40 ring-soft flex items-center gap-2.5 rounded-xl px-3 py-2.5 ring-1">
        <span className="bg-brand text-white inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="h-3 w-3" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-main text-[11px] font-semibold tracking-tight">
            {strategy.headline}
          </div>
          <p className="text-muted mt-0.5 text-[10px] leading-snug">
            {strategy.tagline}
          </p>
        </div>
        <div className="flex shrink-0 items-center -space-x-1.5">
          {strategy.protocols.map((p) => (
            <span
              key={p}
              className="bg-surface ring-soft inline-flex items-center justify-center overflow-hidden rounded-full ring-1 ring-white/80"
              title={formatProtocolName(p)}
            >
              <ProtocolAvatar protocolName={p} size={20} />
            </span>
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {filtered.slice(0, MAX_VISIBLE).map((action) => (
            <ActivityItem
              key={action.id}
              action={action}
              network={position.network}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityItem({
  action,
  network,
}: {
  action: AgentAction;
  network: NetworkId;
}) {
  const Icon = ICON_MAP[action.type];

  return (
    <li className="bg-elevated flex items-start gap-2.5 rounded-xl p-2.5">
      <span className="bg-brand-soft text-brand mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-main truncate font-semibold tracking-tight">
            {action.title}
          </span>
          <span className="text-muted-soft shrink-0 text-[10px]">
            {formatRelativeTime(action.createdAtSec)}
          </span>
        </div>
        <p className="text-muted mt-0.5 truncate text-[11px] leading-snug">
          {action.description}
        </p>
        {action.txHash && (
          <a
            href={explorerTxUrl(network, action.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium"
          >
            View on explorer
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </li>
  );
}
