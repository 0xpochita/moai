"use client";

import { Wallet } from "lucide-react";
import { toast } from "sonner";

const MOCK_ADDRESS = "0xeb0000000000000000000000000000000000004179";

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function NavbarWallet() {
  const handleClick = () => {
    toast("Wallet not connected", {
      description: "Wallet connection is mocked for this demo.",
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="bg-brand hover:bg-brand-hover inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tracking-tight text-white transition-colors"
    >
      <Wallet className="h-3.5 w-3.5" aria-hidden />
      {shortenAddress(MOCK_ADDRESS)}
    </button>
  );
}
