export function formatUsd(
  value: number,
  opts: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return "$0";
  if (opts.compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
      style: "currency",
      currency: "USD",
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(fractionDigits)}%`;
}

export function projectYield(
  amount: number,
  apy: number,
  days: number,
): number {
  if (!Number.isFinite(amount) || !Number.isFinite(apy)) return amount;
  const ratePerDay = apy / 100 / 365;
  return amount * (1 + ratePerDay) ** days;
}

export function safeParseAmount(input: string): number {
  const sanitized = input.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(sanitized);
  return Number.isFinite(value) ? value : 0;
}

export function formatRelativeTime(timestampSec: number): string {
  const nowSec = Date.now() / 1000;
  const diff = Math.max(0, Math.round(nowSec - timestampSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
