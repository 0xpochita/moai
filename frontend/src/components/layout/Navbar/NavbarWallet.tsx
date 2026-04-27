"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, ChevronDown, Wallet } from "lucide-react";
import Image from "next/image";

export function NavbarWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            className="flex items-center gap-1.5"
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!connected && (
              <button
                type="button"
                onClick={openConnectModal}
                className="bg-brand hover:bg-brand-hover inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
              >
                <Wallet className="h-3.5 w-3.5" aria-hidden />
                Connect wallet
              </button>
            )}

            {connected && chain.unsupported && (
              <button
                type="button"
                onClick={openChainModal}
                className="bg-warning-soft text-warning inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tracking-tight transition-colors active:scale-[0.98]"
              >
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Wrong network
              </button>
            )}

            {connected && !chain.unsupported && (
              <>
                {(() => {
                  const chainName = chain.name ?? "Network";
                  const iconUrl = chain.iconUrl;
                  return (
                    <button
                      type="button"
                      onClick={openChainModal}
                      className="bg-elevated hover:bg-brand-soft text-main inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tracking-tight transition-colors"
                      aria-label={`Connected to ${chainName}, click to switch`}
                    >
                      {chain.hasIcon && iconUrl ? (
                        <Image
                          src={iconUrl}
                          alt={chainName}
                          width={16}
                          height={16}
                          className="rounded-full"
                          style={{ background: chain.iconBackground }}
                          unoptimized
                        />
                      ) : (
                        <span
                          style={{ background: chain.iconBackground }}
                          className="inline-flex h-4 w-4 shrink-0 rounded-full"
                        />
                      )}
                      <span className="hidden sm:inline">{chainName}</span>
                      <ChevronDown className="text-muted h-3 w-3" aria-hidden />
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={openAccountModal}
                  className="bg-brand hover:bg-brand-hover inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold tracking-tight text-white transition-colors active:scale-[0.98]"
                  aria-label="Open account menu"
                >
                  <Wallet className="h-3.5 w-3.5" aria-hidden />
                  <span>{account.displayName}</span>
                </button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
