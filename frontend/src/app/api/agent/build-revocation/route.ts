import { NextResponse } from "next/server";
import { type Address, encodeFunctionData, type Hex } from "viem";
import {
  CALIBUR_ABI,
  type CaliburCall,
  type CaliburSignedBatchedCall,
  NONCE_KEY,
  packNonce,
  ROOT_KEY_HASH,
  signedBatchedCallTypedData,
} from "@/lib/calibur";
import { getAgentInfo } from "@/services/server";
import { bigintToString } from "@/services/server/json-bigint";
import { baseClient } from "@/services/server/viem-client";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface RequestBody {
  owner?: string;
}

async function readSeq(userEoa: Address, nonceKey: bigint): Promise<bigint> {
  try {
    const seq = await baseClient.readContract({
      address: userEoa,
      abi: CALIBUR_ABI,
      functionName: "getSeq",
      args: [nonceKey],
    });
    return BigInt(seq as bigint);
  } catch {
    return 0n;
  }
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

  const userEoa = owner as Address;
  const revokeData = encodeFunctionData({
    abi: CALIBUR_ABI,
    functionName: "revoke",
    args: [agent.keyHash],
  });

  const calls: CaliburCall[] = [
    { to: userEoa, value: 0n, data: revokeData as Hex },
  ];

  const seq = await readSeq(userEoa, NONCE_KEY.registration);
  const signedBatchedCall: CaliburSignedBatchedCall = {
    batchedCall: { calls, revertOnFailure: true },
    nonce: packNonce(NONCE_KEY.registration, seq),
    keyHash: ROOT_KEY_HASH,
    executor: "0x0000000000000000000000000000000000000000",
    deadline: 0n,
  };

  const typedData = signedBatchedCallTypedData(userEoa, signedBatchedCall);

  return NextResponse.json({
    typedData: bigintToString(typedData),
    signedBatchedCall: bigintToString(signedBatchedCall),
    revokedKeyHash: agent.keyHash,
  });
}
