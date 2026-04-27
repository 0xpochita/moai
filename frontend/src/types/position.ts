import type { NetworkId } from "./network";

export type FetchStatus = "idle" | "loading" | "success" | "error";

export type UniswapVersion = "v2" | "v3" | "v4";

export type PositionStatus = "in-range" | "out-of-range" | "closed";

export interface PositionToken {
  address: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
}

export interface Position {
  id: string;
  tokenId: string;
  owner: string;
  network: NetworkId;
  protocol: UniswapVersion;
  feeTier: number;
  status: PositionStatus;
  delegated: boolean;
  valueUsd: number;
  poolTvlUsd: number;
  uncollectedFeesUsd: number;
  yieldDayUsd: number;
  token0: PositionToken;
  token1: PositionToken;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  sparkline: number[];
  poolAddress: string;
  createdAtSec: number;
  volume24hUsd: number;
  aprMin: number;
  aprMax: number;
  tokenLongName0?: string;
  tokenLongName1?: string;
}
