"use client";

import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { formatUsd, safeParseAmount } from "@/lib";
import { useSupplyStore } from "@/store";

const TOKENS = ["USDC", "USDT", "DAI", "WETH"] as const;

export function SupplyAmountInput() {
  const amount = useSupplyStore((s) => s.amount);
  const token = useSupplyStore((s) => s.token);
  const setAmount = useSupplyStore((s) => s.setAmount);
  const setToken = useSupplyStore((s) => s.setToken);

  const usdValue = useMemo(() => formatUsd(safeParseAmount(amount)), [amount]);

  return (
    <div className="bg-elevated rounded-xl p-3">
      <div className="text-muted flex items-center justify-between text-[10px] font-medium tracking-wide uppercase">
        <span>You supply</span>
        <span>on Ethereum</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="text-main placeholder:text-muted-soft flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none"
          placeholder="0"
          aria-label="Supply amount"
        />
        <label className="bg-surface ring-soft hover:bg-brand-soft inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors">
          <span className="bg-brand inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white">
            $
          </span>
          <select
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="text-main appearance-none bg-transparent pr-0.5 text-xs font-semibold tracking-tight outline-none"
            aria-label="Supply token"
          >
            {TOKENS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown className="text-muted h-3 w-3" aria-hidden />
        </label>
      </div>
      <div className="text-muted mt-1 text-[11px]">{usdValue}</div>
    </div>
  );
}
