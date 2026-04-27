export type RiskTier = "low" | "medium" | "high";

export type UniswapVersion = "v2" | "v3" | "v4";

export type FetchStatus = "idle" | "loading" | "success" | "error";

export type NetworkId =
  | "all"
  | "ethereum"
  | "unichain"
  | "base"
  | "arbitrum"
  | "polygon"
  | "optimism";

export interface Network {
  id: NetworkId;
  label: string;
  chainName: string | null;
  accent: string;
  logoUrl: string | null;
}

export interface PoolToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
}

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
  volumeUsd1d?: number;
  fees24hUsd?: number;
  token0?: PoolToken;
  token1?: PoolToken;
  source: "subgraph" | "defillama";
}

export interface PoolFilter {
  protocol: UniswapVersion | "all";
  risk: RiskTier | "all";
  network: NetworkId;
}

export type Timeframe = "1Y" | "1M" | "1W" | "1D";

export interface YieldProjection {
  timeframe: Timeframe;
  amount: number;
  delta: number;
}
