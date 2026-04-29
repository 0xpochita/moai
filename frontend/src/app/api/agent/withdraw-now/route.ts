import { NextResponse } from "next/server";
import type { Address } from "viem";
import type { CaliburCall } from "@/lib/calibur";
import { NONCE_KEY } from "@/lib/calibur";
import {
  buildAgentBatch,
  buildWithdrawalPlan,
  isAgentRegistered,
  relaySignedBatch,
  signAsAgent,
} from "@/services/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface RequestBody {
  owner?: string;
  vaultAddress?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const vault = body.vaultAddress?.trim();
  if (!owner || !ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json(
      { error: "Invalid owner address" },
      { status: 400 },
    );
  }
  if (!vault || !ADDRESS_PATTERN.test(vault)) {
    return NextResponse.json(
      { error: "Invalid vault address" },
      { status: 400 },
    );
  }

  const userEoa = owner as Address;

  const registered = await isAgentRegistered(userEoa);
  if (!registered) {
    return NextResponse.json(
      { error: "Agent not registered on this wallet. Delegate first." },
      { status: 412 },
    );
  }

  try {
    // Plan once. If composer quote failed (best-effort in planner), retry
    // the whole plan once before giving up — Li.Fi quotes are flaky on
    // first call for fresh vault deposits.
    let plan = await buildWithdrawalPlan(userEoa, vault);
    const hasMissingCalldata = plan.legs.some((leg) => !leg.calldata);
    if (hasMissingCalldata) {
      plan = await buildWithdrawalPlan(userEoa, vault);
    }

    const calls: CaliburCall[] = plan.legs
      .filter((leg) => leg.calldata)
      .map((leg) => ({
        to: leg.targetAddress as Address,
        value: leg.value ? BigInt(leg.value) : 0n,
        data: leg.calldata as `0x${string}`,
      }));

    if (calls.length !== plan.legs.length) {
      return NextResponse.json(
        {
          error:
            "Could not build a Li.Fi redemption route for this vault. The vault may not be supported by Li.Fi Composer yet — please try again or contact support.",
        },
        { status: 502 },
      );
    }

    const { typedData, signedBatchedCall } = await buildAgentBatch({
      userEoa,
      calls,
      nonceKey: NONCE_KEY.withdrawal,
    });
    const signature = await signAsAgent(typedData);
    const txHash = await relaySignedBatch({
      userEoa,
      signedBatchedCall,
      signature,
    });

    return NextResponse.json({
      txHash,
      vaultName: plan.source.pair,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to withdraw vault position";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
