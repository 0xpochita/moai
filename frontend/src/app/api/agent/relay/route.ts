import { NextResponse } from "next/server";
import type { CaliburSignedBatchedCall } from "@/lib/calibur";
import { relaySignedBatch } from "@/services/server";
import {
  type Jsonable,
  reviveSignedBatchedCall,
} from "@/services/server/json-bigint";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HEX_PATTERN = /^0x[a-fA-F0-9]*$/;

interface RequestBody {
  owner?: string;
  signature?: string;
  signedBatchedCall?: Jsonable<CaliburSignedBatchedCall>;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const owner = body.owner?.trim();
  const signature = body.signature?.trim();
  if (!owner || !ADDRESS_PATTERN.test(owner)) {
    return NextResponse.json(
      { error: "Invalid owner address" },
      { status: 400 },
    );
  }
  if (!signature || !HEX_PATTERN.test(signature) || signature.length < 132) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (!body.signedBatchedCall) {
    return NextResponse.json(
      { error: "Missing signedBatchedCall" },
      { status: 400 },
    );
  }

  let signedBatchedCall: CaliburSignedBatchedCall;
  try {
    signedBatchedCall = reviveSignedBatchedCall(body.signedBatchedCall);
  } catch {
    return NextResponse.json(
      { error: "Malformed signedBatchedCall" },
      { status: 400 },
    );
  }

  try {
    const txHash = await relaySignedBatch({
      userEoa: owner as `0x${string}`,
      signedBatchedCall,
      signature: signature as `0x${string}`,
    });
    return NextResponse.json({ txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "relay failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
