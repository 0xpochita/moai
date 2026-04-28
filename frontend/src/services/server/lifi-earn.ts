import type { DestinationVault, PortfolioPosition } from "@/types";

const EARN_BASE = process.env.LIFI_EARN_BASE_URL ?? "https://earn.li.fi";

const TRUSTED_PROTOCOLS = new Set([
  "morpho-v1",
  "aave-v3",
  "compound-v3",
  "euler-v2",
  "ethena",
  "yearn-v3",
  "pendle",
  "etherfi",
  "lido",
  "yo-protocol",
]);

const DEFAULT_MIN_TVL_USD = 1_000_000;

interface RawAnalytics {
  apy: { base: number; reward: number; total: number };
  apy1d?: number;
  apy7d?: number;
  apy30d?: number;
  tvl: { usd: string };
  updatedAt: string;
}

interface RawTokenRef {
  address: string;
  symbol: string;
  decimals: number;
}

interface RawVault {
  address: string;
  chainId: number;
  network: string;
  slug: string;
  name: string;
  description?: string;
  protocol: { name: string; url: string };
  underlyingTokens: RawTokenRef[];
  lpTokens: RawTokenRef[];
  tags: string[];
  analytics: RawAnalytics;
  isTransactional: boolean;
  isRedeemable: boolean;
  syncedAt: string;
}

interface RawVaultsResponse {
  data: RawVault[];
  nextCursor?: string | null;
  total?: number;
}

interface RawPortfolioPosition {
  vault: RawVault;
  shares: string;
  underlyingBalance: string;
  underlyingBalanceUsd: string;
  pnlUsd?: string;
}

interface RawPortfolioResponse {
  positions: RawPortfolioPosition[];
}

function logoUrlForToken(chainId: number, address: string): string {
  const slug = chainId === 8453 ? "base" : "ethereum";
  return `https://dd.dexscreener.com/ds-data/tokens/${slug}/${address.toLowerCase()}.png`;
}

function toDestination(raw: RawVault): DestinationVault {
  const underlying = raw.underlyingTokens[0];
  return {
    id: raw.slug,
    address: raw.address,
    chainId: raw.chainId,
    name: raw.name,
    protocolName: raw.protocol.name,
    protocolUrl: raw.protocol.url,
    underlyingTokenAddress: underlying?.address ?? "",
    underlyingTokenSymbol: underlying?.symbol ?? "?",
    underlyingTokenDecimals: underlying?.decimals ?? 18,
    apyBase: raw.analytics.apy.base ?? 0,
    apyTotal: raw.analytics.apy.total ?? 0,
    apy30d: raw.analytics.apy30d ?? 0,
    tvlUsd: Number(raw.analytics.tvl.usd) || 0,
    tags: raw.tags,
    isTransactional: raw.isTransactional,
    vaultUrl: raw.protocol.url,
  };
}

function toPortfolio(raw: RawPortfolioPosition): PortfolioPosition {
  const underlying = raw.vault.underlyingTokens[0];
  return {
    vaultId: raw.vault.slug,
    vaultAddress: raw.vault.address,
    chainId: raw.vault.chainId,
    vaultName: raw.vault.name,
    protocolName: raw.vault.protocol.name,
    protocolUrl: raw.vault.protocol.url,
    underlyingTokenAddress: underlying?.address ?? "",
    underlyingTokenSymbol: underlying?.symbol ?? "?",
    underlyingTokenDecimals: underlying?.decimals ?? 18,
    shares: raw.shares,
    underlyingBalance: raw.underlyingBalance,
    underlyingBalanceUsd: Number(raw.underlyingBalanceUsd) || 0,
    apyTotal: raw.vault.analytics.apy.total ?? 0,
    pnlUsd: raw.pnlUsd ? Number(raw.pnlUsd) : 0,
  };
}

function getApiKey(): string {
  const key = process.env.LIFI_API_KEY;
  if (!key) throw new Error("LIFI_API_KEY is not set");
  return key;
}

interface FetchVaultsOptions {
  chainId: number;
  asset?: string;
  sortBy?: "apy" | "tvl";
  limit?: number;
  trustedOnly?: boolean;
  minTvlUsd?: number;
}

export async function fetchVaults(
  opts: FetchVaultsOptions,
  signal?: AbortSignal,
): Promise<DestinationVault[]> {
  const params = new URLSearchParams({
    chainId: String(opts.chainId),
    sortBy: opts.sortBy ?? "apy",
    limit: String(opts.limit ?? 50),
  });
  if (opts.asset) params.set("asset", opts.asset);

  const res = await fetch(`${EARN_BASE}/v1/vaults?${params.toString()}`, {
    signal,
    headers: {
      "x-lifi-api-key": getApiKey(),
      accept: "application/json",
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`lifi vaults failed (${res.status})`);
  }

  const json = (await res.json()) as RawVaultsResponse;
  const result: DestinationVault[] = [];
  const trusted = opts.trustedOnly !== false;
  const minTvl = opts.minTvlUsd ?? DEFAULT_MIN_TVL_USD;

  for (const raw of json.data) {
    if (!raw.isTransactional) continue;
    if (trusted && !TRUSTED_PROTOCOLS.has(raw.protocol.name)) continue;
    const tvl = Number(raw.analytics.tvl.usd) || 0;
    if (tvl < minTvl) continue;
    result.push(toDestination(raw));
  }

  return result.sort((a, b) => b.apyTotal - a.apyTotal);
}

export async function fetchPortfolio(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<PortfolioPosition[]> {
  const res = await fetch(
    `${EARN_BASE}/v1/portfolio/${walletAddress.toLowerCase()}/positions`,
    {
      signal,
      headers: {
        "x-lifi-api-key": getApiKey(),
        accept: "application/json",
      },
      next: { revalidate: 30 },
    },
  );

  if (!res.ok) {
    throw new Error(`lifi portfolio failed (${res.status})`);
  }

  const json = (await res.json()) as RawPortfolioResponse;
  return (json.positions ?? []).map(toPortfolio);
}

export { logoUrlForToken };
