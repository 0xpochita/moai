import { NextResponse } from "next/server";
import type { Address } from "viem";
import { CALIBUR_SINGLETON } from "@/lib/calibur";
import { getAgentInfo, isAgentRegistered } from "@/services/server";
import { baseClient } from "@/services/server/viem-client";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function isCaliburCode(code: string | undefined): boolean {
  if (!code || code === "0x") return false;
  const expected =
    `0xef0100${CALIBUR_SINGLETON.slice(2).toLowerCase()}`.toLowerCase();
  return code.toLowerCase().startsWith(expected);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner")?.trim();
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

  let caliburDelegated = false;
  try {
    const code = await baseClient.getCode({ address: owner as Address });
    caliburDelegated = isCaliburCode(code);
  } catch {
    // ignore — treat as not delegated
  }

  const agentRegistered = caliburDelegated
    ? await isAgentRegistered(owner as Address)
    : false;

  return NextResponse.json({
    caliburDelegated,
    agentRegistered,
    agentAddress: agent.address,
    agentKeyHash: agent.keyHash,
  });
}
