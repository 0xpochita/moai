"use client";

import { toast } from "sonner";
import { explorerTxUrl } from "./networks";

interface ToastTxOptions {
  title: string;
  txHash?: string;
  description?: string;
}

/// Renders a tx-submitted toast in the web3 industry standard:
/// title on top, BaseScan link as a full-width pill below. No tx hash
/// is shown inline — the user clicks through to the explorer.
export function toastTx({ title, txHash, description }: ToastTxOptions) {
  toast.custom(
    (id) => (
      <div className="bg-surface ring-soft flex min-w-[300px] flex-col gap-2 rounded-2xl border p-4 shadow-[0_8px_24px_rgba(255,0,122,0.06)]">
        <div className="text-main text-sm font-semibold tracking-tight">
          {title}
        </div>
        {description && (
          <div className="text-muted text-[11px] leading-snug">
            {description}
          </div>
        )}
        {txHash && (
          <a
            href={explorerTxUrl("base", txHash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => toast.dismiss(id)}
            style={{
              backgroundColor: "var(--color-foreground)",
              color: "var(--color-surface)",
            }}
            className="hover:opacity-90 inline-flex h-9 items-center justify-center rounded-full text-xs font-semibold tracking-tight transition-opacity active:scale-[0.98]"
          >
            View on BaseScan
          </a>
        )}
      </div>
    ),
    { duration: 6000 },
  );
}
