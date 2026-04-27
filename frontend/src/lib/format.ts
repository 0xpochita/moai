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
