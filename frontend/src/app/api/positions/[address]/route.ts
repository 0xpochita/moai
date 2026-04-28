import { NextResponse } from "next/server";
import { fetchPositionsOnChain } from "@/services/server";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!ADDRESS_PATTERN.test(address)) {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 },
    );
  }

  try {
    const positions = await fetchPositionsOnChain(address, request.signal);
    return NextResponse.json({
      positions,
      source: positions.length > 0 ? "onchain" : "empty",
    });
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const message = err instanceof Error ? err.message : "on-chain read failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
