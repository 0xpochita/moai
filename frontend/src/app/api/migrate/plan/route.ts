import { NextResponse } from "next/server";
import { buildMigrationPlan } from "@/services/server";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface RequestBody {
  owner?: string;
  tokenId?: string;
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

  try {
    const plan = await buildMigrationPlan(owner, tokenId, request.signal);
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
