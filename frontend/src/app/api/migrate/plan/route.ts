import { NextResponse } from "next/server";
import { buildMigrationPlan } from "@/services/server";

export const dynamic = "force-dynamic";

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

  try {
    const plan = await buildMigrationPlan(owner, tokenId, request.signal, {
      riskProfile,
    });
    return NextResponse.json({ plan });
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const message =
      err instanceof Error ? err.message : "Failed to build migration plan";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
