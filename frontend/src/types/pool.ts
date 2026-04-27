export type RiskTier = "low" | "medium" | "high";

export type UniswapVersion = "v2" | "v3" | "v4";

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface Pool {
  id: string;
  symbol: string;
  protocol: UniswapVersion;
  chain: string;
  tvlUsd: number;
  apy: number;
  apyMean30d: number;
  risk: RiskTier;
  feeTier?: number;
}

export interface PoolFilter {
  protocol: UniswapVersion | "all";
  risk: RiskTier | "all";
}

export type Timeframe = "1Y" | "1M" | "1W" | "1D";

export interface YieldProjection {
  timeframe: Timeframe;
  amount: number;
  delta: number;
}
