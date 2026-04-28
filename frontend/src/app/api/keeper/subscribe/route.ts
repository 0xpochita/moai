import { NextResponse } from "next/server";
import { getSubscription, subscribe } from "@/services/server";

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

  const record = subscribe(address);
  return NextResponse.json({ subscription: record });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address")?.trim();
  if (!address || !ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const record = getSubscription(address);
  return NextResponse.json({ subscription: record });
}
