import { NextResponse } from "next/server";
import {
  type CheckApprovalRequest,
  checkApprovalUpstream,
} from "@/services/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: CheckApprovalRequest;
  try {
    body = (await request.json()) as CheckApprovalRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { status, data } = await checkApprovalUpstream(body, request.signal);
    return NextResponse.json(data, { status });
  } catch (err) {
    if (request.signal.aborted) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const message =
      err instanceof Error ? err.message : "check_approval failed";
    const status = message === "UNISWAP_API is not set" ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
