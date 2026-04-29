import type { Address, Hex } from "viem";
import type { CaliburCall } from "@/lib/calibur";
import type { AgentAction, MigrationPlan } from "@/types";
import {
  buildAgentBatch,
  isAgentRegistered,
  relaySignedBatch,
  signAsAgent,
} from "./calibur";
import {
  isCoolingDown,
  listSubscriptions,
  recordActivity,
  recordTick,
  setCooldown,
  updateSubscription,
} from "./keeper-store";
import { buildHarvestPlan } from "./harvest-planner";
import { fetchPortfolio, fetchVaults } from "./lifi-earn";
import { buildMigrationPlan } from "./migration-planner";
import { fetchPositionsOnChain } from "./positions-onchain";

interface MigrationOutcome {
  type:
    | "no-action"
    | "skipped-cooldown"
    | "no-plan"
    | "submitted"
    | "harvested"
    | "logged"
    | "rotation-suggested"
    | "error";
  positionTokenId?: string;
  txHash?: Hex;
  destination?: string;
  reason?: string;
  feesUsd?: number;
}

const ROTATION_APY_DELTA_PCT = Number(
  process.env.KEEPER_ROTATION_APY_DELTA_PCT ?? "0.5",
);
const HARVEST_MIN_USD = Number(process.env.KEEPER_HARVEST_MIN_USD ?? "5");
const HARVEST_INTERVAL_SEC = Number(
  process.env.KEEPER_HARVEST_INTERVAL_SEC ?? String(24 * 60 * 60),
);

function isKeeperConfigured(): boolean {
  const pk = process.env.KEEPER_PRIVATE_KEY;
  return Boolean(pk && /^0x[0-9a-fA-F]{64}$/.test(pk));
}

function planLegsToCaliburCalls(plan: MigrationPlan): CaliburCall[] {
  const calls: CaliburCall[] = [];
  for (const leg of plan.legs) {
    if (!leg.calldata) continue;
    calls.push({
      to: leg.targetAddress as Address,
      value: leg.value ? BigInt(leg.value) : 0n,
      data: leg.calldata as Hex,
    });
  }
  return calls;
}

function makeAction(args: {
  ownerAddress: string;
  type: AgentAction["type"];
  title: string;
  description: string;
  txHash?: string;
  positionTokenId?: string;
  destination?: string;
}): AgentAction {
  return {
    id: `keeper-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: args.type,
    title: args.title,
    description: args.description,
    txHash: args.txHash,
    destination: args.destination,
    positionTokenId: args.positionTokenId,
    createdAtSec: Math.floor(Date.now() / 1000),
  };
}

async function detectRotations(
  ownerAddress: string,
): Promise<MigrationOutcome[]> {
  const holdings = await fetchPortfolio(ownerAddress).catch(() => []);
  if (holdings.length === 0) return [];

  const outcomes: MigrationOutcome[] = [];
  for (const h of holdings) {
    const cooldownKey = `rotate:${h.vaultAddress.toLowerCase()}`;
    if (isCoolingDown(ownerAddress, cooldownKey)) continue;

    const topVaults = await fetchVaults({
      chainId: 8453,
      asset: h.underlyingTokenSymbol,
      sortBy: "apy",
      limit: 5,
      trustedOnly: true,
      minTvlUsd: 500_000,
    }).catch(() => []);

    const better = topVaults.find(
      (v) =>
        v.address.toLowerCase() !== h.vaultAddress.toLowerCase() &&
        v.apyTotal - h.apyTotal >= ROTATION_APY_DELTA_PCT,
    );
    if (!better) continue;

    const destination = `${better.protocolName} ${better.name}`;
    recordActivity(
      ownerAddress,
      makeAction({
        ownerAddress,
        type: "migrate",
        title: "Rotation suggested",
        description: `${h.vaultName} (${h.apyTotal.toFixed(2)}%) → ${destination} (${better.apyTotal.toFixed(2)}%) — open Withdraw to act.`,
        destination,
      }),
    );
    setCooldown(ownerAddress, cooldownKey, Math.floor(Date.now() / 1000));
    outcomes.push({
      type: "rotation-suggested",
      destination,
      reason: `apy delta ${(better.apyTotal - h.apyTotal).toFixed(2)}%`,
    });
  }
  return outcomes;
}

async function processHarvests(
  ownerAddress: string,
  positions: Awaited<ReturnType<typeof fetchPositionsOnChain>>,
): Promise<MigrationOutcome[]> {
  const inRange = positions.filter((p) => p.status !== "out-of-range");
  if (inRange.length === 0) return [];

  const outcomes: MigrationOutcome[] = [];
  const keeperReady =
    isKeeperConfigured() &&
    (await isAgentRegistered(ownerAddress as Address));

  for (const position of inRange) {
    const cooldownKey = `harvest:${position.tokenId}`;
    if (
      isCoolingDown(ownerAddress, cooldownKey, HARVEST_INTERVAL_SEC)
    ) {
      continue;
    }

    const feesUsd = position.uncollectedFeesUsd ?? 0;
    if (feesUsd < HARVEST_MIN_USD) continue;

    let plan: MigrationPlan;
    try {
      plan = await buildHarvestPlan(ownerAddress, position.tokenId, undefined, {
        minHarvestUsd: HARVEST_MIN_USD,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      outcomes.push({
        type: "no-plan",
        positionTokenId: position.tokenId,
        reason,
      });
      continue;
    }

    if (!keeperReady) {
      recordActivity(
        ownerAddress,
        makeAction({
          ownerAddress,
          type: "harvest",
          title: "Auto-harvest detected",
          description: `Position #${position.tokenId} has $${feesUsd.toFixed(2)} accrued fees. Delegate the agent to enable auto-harvest.`,
          positionTokenId: position.tokenId,
        }),
      );
      outcomes.push({
        type: "logged",
        positionTokenId: position.tokenId,
      });
      continue;
    }

    const calls = planLegsToCaliburCalls(plan);
    if (calls.length !== plan.legs.length) {
      outcomes.push({
        type: "no-plan",
        positionTokenId: position.tokenId,
        reason: "Harvest plan missing calldata",
      });
      continue;
    }

    const destination = `${plan.destination.protocolName} ${plan.destination.name}`;
    try {
      const { typedData, signedBatchedCall } = await buildAgentBatch({
        userEoa: ownerAddress as Address,
        calls,
      });
      const signature = await signAsAgent(typedData);
      const txHash = await relaySignedBatch({
        userEoa: ownerAddress as Address,
        signedBatchedCall,
        signature,
      });

      recordActivity(
        ownerAddress,
        makeAction({
          ownerAddress,
          type: "harvest",
          title: "Auto-harvest",
          description: `Collected $${feesUsd.toFixed(2)} fees from #${position.tokenId} → ${destination}. LP stays live.`,
          txHash,
          destination,
          positionTokenId: position.tokenId,
        }),
      );
      setCooldown(
        ownerAddress,
        cooldownKey,
        Math.floor(Date.now() / 1000),
      );
      outcomes.push({
        type: "harvested",
        positionTokenId: position.tokenId,
        txHash,
        destination,
        feesUsd,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      recordActivity(
        ownerAddress,
        makeAction({
          ownerAddress,
          type: "harvest",
          title: "Auto-harvest failed",
          description: `Could not harvest #${position.tokenId}: ${reason}`,
          positionTokenId: position.tokenId,
        }),
      );
      outcomes.push({
        type: "error",
        positionTokenId: position.tokenId,
        reason,
      });
    }
  }

  return outcomes;
}

async function processSubscription(
  ownerAddress: string,
): Promise<MigrationOutcome[]> {
  const positions = await fetchPositionsOnChain(ownerAddress).catch((err) => {
    console.warn(`[keeper] positions read failed for ${ownerAddress}:`, err);
    return [];
  });

  const oor = positions.filter((p) => p.status === "out-of-range");
  const outcomesAcc: MigrationOutcome[] = [];
  if (oor.length === 0) {
    const harvests = await processHarvests(ownerAddress, positions);
    const rot = await detectRotations(ownerAddress);
    const combined = [...harvests, ...rot];
    return combined.length > 0 ? combined : [{ type: "no-action" }];
  }

  const outcomes: MigrationOutcome[] = outcomesAcc;
  for (const position of oor) {
    if (isCoolingDown(ownerAddress, position.tokenId)) {
      outcomes.push({
        type: "skipped-cooldown",
        positionTokenId: position.tokenId,
      });
      continue;
    }

    let plan: MigrationPlan;
    try {
      plan = await buildMigrationPlan(ownerAddress, position.tokenId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      outcomes.push({
        type: "no-plan",
        positionTokenId: position.tokenId,
        reason,
      });
      continue;
    }

    const calls = planLegsToCaliburCalls(plan);
    const destination = `${plan.destination.protocolName} ${plan.destination.name}`;
    const canExecute =
      isKeeperConfigured() &&
      calls.length === plan.legs.length &&
      (await isAgentRegistered(ownerAddress as Address));

    if (canExecute) {
      try {
        const { typedData, signedBatchedCall } = await buildAgentBatch({
          userEoa: ownerAddress as Address,
          calls,
        });
        const signature = await signAsAgent(typedData);
        const txHash = await relaySignedBatch({
          userEoa: ownerAddress as Address,
          signedBatchedCall,
          signature,
        });

        recordActivity(
          ownerAddress,
          makeAction({
            ownerAddress,
            type: "migrate",
            title: "Auto-migrate",
            description: `Moved out-of-range #${position.tokenId} → ${destination}`,
            txHash,
            destination,
            positionTokenId: position.tokenId,
          }),
        );
        setCooldown(
          ownerAddress,
          position.tokenId,
          Math.floor(Date.now() / 1000),
        );
        outcomes.push({
          type: "submitted",
          positionTokenId: position.tokenId,
          txHash,
          destination,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        recordActivity(
          ownerAddress,
          makeAction({
            ownerAddress,
            type: "migrate",
            title: "Auto-migrate failed",
            description: `Could not migrate #${position.tokenId}: ${reason}`,
            positionTokenId: position.tokenId,
          }),
        );
        outcomes.push({
          type: "error",
          positionTokenId: position.tokenId,
          reason,
        });
      }
    } else {
      recordActivity(
        ownerAddress,
        makeAction({
          ownerAddress,
          type: "migrate",
          title: "Auto-migrate detected",
          description: `Out-of-range #${position.tokenId} ready for ${destination}. Agent not registered yet — delegate first.`,
          destination,
          positionTokenId: position.tokenId,
        }),
      );
      outcomes.push({
        type: "logged",
        positionTokenId: position.tokenId,
        destination,
      });
    }
  }

  const harvests = await processHarvests(ownerAddress, positions);
  outcomes.push(...harvests);

  const rotations = await detectRotations(ownerAddress);
  outcomes.push(...rotations);

  return outcomes;
}

export async function runKeeperTick(): Promise<{
  processed: number;
  migrations: number;
  results: Array<{
    address: string;
    outcomes: MigrationOutcome[];
  }>;
}> {
  const subs = listSubscriptions();
  const results: Array<{
    address: string;
    outcomes: MigrationOutcome[];
  }> = [];
  let migrations = 0;

  for (const sub of subs) {
    try {
      const outcomes = await processSubscription(sub.address);
      const submitted = outcomes.filter((o) => o.type === "submitted").length;
      const harvested = outcomes.filter((o) => o.type === "harvested").length;
      const logged = outcomes.filter((o) => o.type === "logged").length;
      migrations += submitted + harvested + logged;

      const lastResult: SubscriptionResult = outcomes.some(
        (o) => o.type === "submitted",
      )
        ? "migrated"
        : outcomes.some((o) => o.type === "harvested")
          ? "migrated"
          : outcomes.some((o) => o.type === "error")
            ? "error"
            : "no-action";
      const lastError =
        outcomes.find((o) => o.type === "error")?.reason ?? null;

      updateSubscription(sub.address, {
        lastCheckedAtSec: Math.floor(Date.now() / 1000),
        lastResult,
        lastError,
      });

      results.push({ address: sub.address, outcomes });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      updateSubscription(sub.address, {
        lastCheckedAtSec: Math.floor(Date.now() / 1000),
        lastResult: "error",
        lastError: reason,
      });
      results.push({
        address: sub.address,
        outcomes: [{ type: "error", reason }],
      });
    }
  }

  recordTick(subs.length, migrations);

  return {
    processed: subs.length,
    migrations,
    results,
  };
}

type SubscriptionResult = "idle" | "no-action" | "migrated" | "error";
