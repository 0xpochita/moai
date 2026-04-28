import { NextResponse } from "next/server";
import {
  buildRegistrationBatch,
  getAgentInfo,
  getCaliburHookAddress,
} from "@/services/server";
import { bigintToString } from "@/services/server/json-bigint";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface RequestBody {
  owner?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  if (!owner || !ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json(
      { error: "Invalid owner address" },
      { status: 400 },
    );
  }

  const agent = getAgentInfo();
  if (!agent) {
    return NextResponse.json(
      { error: "KEEPER_PRIVATE_KEY not configured on server" },
      { status: 503 },
    );
  }

  const hookAddress = getCaliburHookAddress();
  if (!hookAddress) {
    return NextResponse.json(
      { error: "Hook address not configured on server" },
      { status: 503 },
    );
  }

  try {
    const result = await buildRegistrationBatch({
      userEoa: owner as `0x${string}`,
      agentAddress: agent.address,
      hookAddress,
    });
    return NextResponse.json({
      typedData: bigintToString(result.typedData),
      signedBatchedCall: bigintToString(result.signedBatchedCall),
      agentAddress: agent.address,
      hookAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "build failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
