import { NextResponse } from "next/server";
import { getAgentInfo, getCaliburHookAddress } from "@/services/server";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json({
    agentAddress: agent.address,
    agentKeyHash: agent.keyHash,
    hookAddress,
  });
}
