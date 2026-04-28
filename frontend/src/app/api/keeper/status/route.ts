import { NextResponse } from "next/server";
import {
  getSubscription,
  getTickStats,
  listSubscriptions,
} from "@/services/server";

export const dynamic = "force-dynamic";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address")?.trim();
  const stats = getTickStats();

  const hookConfigured = Boolean(process.env.NEXT_PUBLIC_GUARDED_HOOK_ADDRESS);
  const keeperWalletConfigured = Boolean(
    process.env.KEEPER_PRIVATE_KEY &&
      /^0x[0-9a-fA-F]{64}$/.test(process.env.KEEPER_PRIVATE_KEY),
  );
  const autoExecuteEnabled = hookConfigured && keeperWalletConfigured;

  if (address && ADDRESS_PATTERN.test(address)) {
    const subscription = getSubscription(address);
    return NextResponse.json({
      subscription,
      tickStats: stats,
      hookConfigured,
      keeperWalletConfigured,
      autoExecuteEnabled,
    });
  }

  return NextResponse.json({
    subscriptions: listSubscriptions().length,
    tickStats: stats,
    hookConfigured,
    keeperWalletConfigured,
    autoExecuteEnabled,
  });
}
