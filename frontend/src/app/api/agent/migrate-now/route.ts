import { NextResponse } from "next/server";
import type { Address } from "viem";
import type { CaliburCall } from "@/lib/calibur";
import { NONCE_KEY } from "@/lib/calibur";
import {
  buildAgentBatch,
  buildMigrationPlan,
  isAgentRegistered,
  relaySignedBatch,
  signAsAgent,
} from "@/services/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const RISK_PROFILES = ["conservative", "balanced", "aggressive"] as const;
type RiskProfile = (typeof RISK_PROFILES)[number];

interface RequestBody {
  owner?: string;
  tokenId?: string;
  riskProfile?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const tokenId = body.tokenId?.trim();
  if (!owner || !ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json(
      { error: "Invalid owner address" },
      { status: 400 },
    );
  }
  if (!tokenId || !/^[0-9]+$/.test(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  const riskProfile: RiskProfile = RISK_PROFILES.includes(
    body.riskProfile as RiskProfile,
  )
    ? (body.riskProfile as RiskProfile)
    : "balanced";

  const userEoa = owner as Address;

  const registered = await isAgentRegistered(userEoa);
  if (!registered) {
    return NextResponse.json(
      { error: "Agent not registered on this wallet. Delegate first." },
      { status: 412 },
    );
  }

  try {
    const plan = await buildMigrationPlan(userEoa, tokenId, undefined, {
      riskProfile,
    });

    const calls: CaliburCall[] = plan.legs
      .filter((leg) => leg.calldata)
      .map((leg) => ({
        to: leg.targetAddress as Address,
        value: leg.value ? BigInt(leg.value) : 0n,
        data: leg.calldata as `0x${string}`,
      }));

    if (calls.length !== plan.legs.length) {
      return NextResponse.json(
        { error: "Plan has legs without calldata; aborting." },
        { status: 502 },
      );
    }

    const { typedData, signedBatchedCall } = await buildAgentBatch({
      userEoa,
      calls,
      nonceKey: NONCE_KEY.migration,
    });
    const signature = await signAsAgent(typedData);
    const txHash = await relaySignedBatch({
      userEoa,
      signedBatchedCall,
      signature,
    });

    return NextResponse.json({
      txHash,
      destination: `${plan.destination.protocolName} ${plan.destination.name}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to migrate position";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
