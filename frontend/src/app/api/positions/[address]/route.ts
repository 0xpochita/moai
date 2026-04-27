import { NextResponse } from "next/server";
import { fetchPositionsForOwner, mockPositions } from "@/services/server";

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

  const useMock =
    new URL(request.url).searchParams.get("demo") === "1" ||
    !process.env.THEGRAPH_API_KEY;

  if (useMock) {
    return NextResponse.json({
      positions: mockPositions(address),
      source: "mock",
    });
  }

  try {
    const positions = await fetchPositionsForOwner(address, request.signal);
    if (positions.length === 0) {
      return NextResponse.json({
        positions: mockPositions(address),
        source: "mock-fallback",
      });
    }
    return NextResponse.json({ positions, source: "subgraph" });
  } catch (err) {
    console.warn("[/api/positions] subgraph failed:", err);
    return NextResponse.json({
      positions: mockPositions(address),
      source: "mock-fallback",
    });
  }
}
