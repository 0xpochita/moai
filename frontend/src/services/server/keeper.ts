import {
  type Address,
  createWalletClient,
  encodeFunctionData,
  type Hex,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import type { AgentAction, MigrationPlan } from "@/types";
import {
  isCoolingDown,
  listSubscriptions,
  recordActivity,
  recordTick,
  setCooldown,
  updateSubscription,
} from "./keeper-store";
import { buildMigrationPlan } from "./migration-planner";
import { fetchPositionsOnChain } from "./positions-onchain";

const BASE_CHAIN_ID = 8453;

const HOOK_EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

interface MigrationOutcome {
  type:
    | "no-action"
    | "skipped-cooldown"
    | "no-plan"
    | "submitted"
    | "logged"
    | "error";
  positionTokenId?: string;
  txHash?: Hex;
  destination?: string;
  reason?: string;
}

function getKeeperWallet() {
  const pk = process.env.KEEPER_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
  const account = privateKeyToAccount(pk as Hex);
  const transport = http(
    process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
  );
  return createWalletClient({ account, chain: base, transport });
}

function planLegsToHookCalls(plan: MigrationPlan) {
  const calls: { target: Address; value: bigint; data: Hex }[] = [];
  for (const leg of plan.legs) {
    if (!leg.calldata) continue;
    calls.push({
      target: leg.targetAddress as Address,
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

async function processSubscription(
  ownerAddress: string,
): Promise<MigrationOutcome[]> {
  const positions = await fetchPositionsOnChain(ownerAddress).catch((err) => {
    console.warn(`[keeper] positions read failed for ${ownerAddress}:`, err);
    return [];
  });

  const oor = positions.filter((p) => p.status === "out-of-range");
  if (oor.length === 0) {
    return [{ type: "no-action" }];
  }

  const outcomes: MigrationOutcome[] = [];
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

    const calls = planLegsToHookCalls(plan);
    const hookAddress = process.env.NEXT_PUBLIC_GUARDED_HOOK_ADDRESS;
    const wallet = getKeeperWallet();
    const destination = `${plan.destination.protocolName} ${plan.destination.name}`;

    if (hookAddress && wallet && calls.length === plan.legs.length) {
      try {
        const calldata = encodeFunctionData({
          abi: HOOK_EXECUTE_ABI,
          functionName: "execute",
          args: [calls],
        });
        const totalValue = calls.reduce((sum, c) => sum + c.value, 0n);
        const txHash = await wallet.sendTransaction({
          account: wallet.account,
          chain: wallet.chain,
          to: ownerAddress as Address,
          data: calldata,
          value: totalValue,
          chainId: BASE_CHAIN_ID,
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
          description: `Out-of-range #${position.tokenId} ready for ${destination}. Click "Migrate" to sign.`,
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
      const logged = outcomes.filter((o) => o.type === "logged").length;
      migrations += submitted + logged;

      const lastResult: SubscriptionResult = outcomes.some(
        (o) => o.type === "submitted",
      )
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
