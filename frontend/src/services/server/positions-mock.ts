import type { Position } from "@/types";

function sparkline(seed: number, trend: number): number[] {
  const points: number[] = [];
  let value = 50;
  let h = seed;
  for (let i = 0; i < 32; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const delta = ((h % 1000) / 1000 - 0.5) * 6 + trend * 0.2;
    value = Math.max(10, Math.min(90, value + delta));
    points.push(value);
  }
  return points;
}

const TOKENS = {
  ETH: {
    address: "0x0000000000000000000000000000000000000000",
    symbol: "ETH",
    decimals: 18,
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  USDC: {
    address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    symbol: "USDC",
    decimals: 6,
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png",
  },
  USDT: {
    address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
    symbol: "USDT",
    decimals: 6,
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  },
  CBBTC: {
    address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    symbol: "cbBTC",
    decimals: 8,
    logoUrl:
      "https://dd.dexscreener.com/ds-data/tokens/base/0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf.png",
  },
  WBTC: {
    address: "0x0555e30da8f98308edb960aa94c0db47230d2b9c",
    symbol: "WBTC",
    decimals: 8,
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png",
  },
};

export function mockPositions(owner: string): Position[] {
  const ownerLower = owner.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: `${ownerLower}#mock-1`,
      tokenId: "2118308",
      owner: ownerLower,
      network: "base",
      protocol: "v3",
      feeTier: 0.05,
      status: "in-range",
      delegated: true,
      valueUsd: 4.13,
      poolTvlUsd: 723_130,
      uncollectedFeesUsd: 0.04,
      yieldDayUsd: 0.04,
      token0: TOKENS.ETH,
      token1: TOKENS.USDT,
      tokenLongName0: "Ethereum",
      tokenLongName1: "Tether USD",
      tickLower: -887272,
      tickUpper: 887272,
      currentTick: 0,
      sparkline: sparkline(2118308, 1),
      poolAddress: "0xd0b53d9277642d899df5c87a3966a349a798f224",
      createdAtSec: now - 86400 * 5,
      volume24hUsd: 687_890,
      aprMin: 0.35,
      aprMax: 82.15,
    },
    {
      id: `${ownerLower}#mock-2`,
      tokenId: "2118314",
      owner: ownerLower,
      network: "base",
      protocol: "v3",
      feeTier: 0.01,
      status: "in-range",
      delegated: true,
      valueUsd: 5.54,
      poolTvlUsd: 569_600,
      uncollectedFeesUsd: 0,
      yieldDayUsd: 0.04,
      token0: TOKENS.ETH,
      token1: TOKENS.USDT,
      tokenLongName0: "Ethereum",
      tokenLongName1: "Tether USD",
      tickLower: -887272,
      tickUpper: 887272,
      currentTick: 0,
      sparkline: sparkline(2118314, 1),
      poolAddress: "0x4c36388be6f416a29c8d8eee81c771ce6be14b18",
      createdAtSec: now - 86400 * 3,
      volume24hUsd: 532_510,
      aprMin: 0.21,
      aprMax: 53.5,
    },
    {
      id: `${ownerLower}#mock-3`,
      tokenId: "2118320",
      owner: ownerLower,
      network: "base",
      protocol: "v3",
      feeTier: 0.01,
      status: "in-range",
      delegated: false,
      valueUsd: 12.42,
      poolTvlUsd: 44.07,
      uncollectedFeesUsd: 0,
      yieldDayUsd: 0,
      token0: TOKENS.WBTC,
      token1: TOKENS.USDC,
      tokenLongName0: "Wrapped Bitcoin",
      tokenLongName1: "USD Coin",
      tickLower: -887272,
      tickUpper: 887272,
      currentTick: 0,
      sparkline: sparkline(2118320, 1),
      poolAddress: "0x0000000000000000000000000000000000000003",
      createdAtSec: now - 86400 * 2,
      volume24hUsd: 7.92,
      aprMin: 0.79,
      aprMax: 0.79,
    },
    {
      id: `${ownerLower}#mock-4`,
      tokenId: "2118321",
      owner: ownerLower,
      network: "base",
      protocol: "v3",
      feeTier: 0.01,
      status: "in-range",
      delegated: false,
      valueUsd: 8.7,
      poolTvlUsd: 17.1,
      uncollectedFeesUsd: 0,
      yieldDayUsd: 0,
      token0: TOKENS.WBTC,
      token1: TOKENS.USDT,
      tokenLongName0: "Wrapped Bitcoin",
      tokenLongName1: "Tether USD",
      tickLower: -887272,
      tickUpper: 887272,
      currentTick: 0,
      sparkline: sparkline(2118321, -1),
      poolAddress: "0x0000000000000000000000000000000000000004",
      createdAtSec: now - 86400 * 2,
      volume24hUsd: 0.99,
      aprMin: 0.21,
      aprMax: 0.21,
    },
    {
      id: `${ownerLower}#mock-5`,
      tokenId: "2118322",
      owner: ownerLower,
      network: "base",
      protocol: "v3",
      feeTier: 0.05,
      status: "in-range",
      delegated: false,
      valueUsd: 22.18,
      poolTvlUsd: 569_600,
      uncollectedFeesUsd: 0,
      yieldDayUsd: 0,
      token0: TOKENS.USDC,
      token1: TOKENS.USDT,
      tokenLongName0: "USD Coin",
      tokenLongName1: "Tether USD",
      tickLower: -887272,
      tickUpper: 887272,
      currentTick: 0,
      sparkline: sparkline(2118322, 0),
      poolAddress: "0x0000000000000000000000000000000000000005",
      createdAtSec: now - 86400,
      volume24hUsd: 532_510,
      aprMin: 211.62,
      aprMax: 211.62,
    },
  ];
}
