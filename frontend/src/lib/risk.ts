import type { RiskTier } from "@/types";

export const RISK_LABEL: Record<RiskTier, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const RISK_TONE: Record<RiskTier, "success" | "outline" | "warning"> = {
  low: "success",
  medium: "outline",
  high: "warning",
};
