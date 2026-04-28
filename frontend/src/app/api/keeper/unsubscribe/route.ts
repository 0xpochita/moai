import { NextResponse } from "next/server";
import { unsubscribe } from "@/services/server";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

interface RequestBody {
  address?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.trim();
  if (!address || !ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const removed = unsubscribe(address);
  return NextResponse.json({ removed });
}
