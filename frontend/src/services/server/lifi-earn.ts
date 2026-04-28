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

/// Actual shape of `/v1/portfolio/:owner/positions`. Each entry is the
/// minimal vault holding info — no vault metadata (name, APY) is included,
/// so we enrich it ourselves by matching the vault address against the
/// vaults list.
interface RawPortfolioPosition {
  chainId: number;
  /// Vault contract address (the "lp token" the user holds).
  address: string;
  protocolName: string;
  asset: { address: string; name: string; symbol: string; decimals: number };
  balanceUsd: string | null;
  balanceNative: string;
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

function toPortfolio(
  raw: RawPortfolioPosition,
  enrichment?: RawVault,
): PortfolioPosition {
  const balanceUsd = Number(raw.balanceUsd ?? "0") || 0;
  const fallbackName = `${raw.asset.symbol} on ${raw.protocolName}`;
  return {
    vaultId: enrichment?.slug ?? raw.address.toLowerCase(),
    vaultAddress: raw.address,
    chainId: raw.chainId,
    vaultName: enrichment?.name ?? fallbackName,
    protocolName: raw.protocolName,
    protocolUrl: enrichment?.protocol.url ?? "",
    underlyingTokenAddress: raw.asset.address,
    underlyingTokenSymbol: raw.asset.symbol,
    underlyingTokenDecimals: raw.asset.decimals,
    shares: raw.balanceNative,
    underlyingBalance: raw.balanceNative,
    underlyingBalanceUsd: balanceUsd,
    apyTotal: enrichment?.analytics.apy.total ?? 0,
    pnlUsd: 0,
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

/// Fetch the raw vault rows for a list of (chainId, asset) pairs and
/// build an `address.toLowerCase() → RawVault` lookup. Used to enrich
/// portfolio positions with name + APY (the portfolio endpoint omits
/// those).
async function fetchVaultMetaByAddress(
  needs: Array<{ chainId: number; asset: string }>,
  signal?: AbortSignal,
): Promise<Map<string, RawVault>> {
  const seen = new Set<string>();
  const dedup = needs.filter((n) => {
    const key = `${n.chainId}:${n.asset.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const map = new Map<string, RawVault>();
  await Promise.all(
    dedup.map(async ({ chainId, asset }) => {
      const params = new URLSearchParams({
        chainId: String(chainId),
        asset,
        sortBy: "tvl",
        limit: "100",
      });
      try {
        const res = await fetch(`${EARN_BASE}/v1/vaults?${params.toString()}`, {
          signal,
          headers: {
            "x-lifi-api-key": getApiKey(),
            accept: "application/json",
          },
          next: { revalidate: 60 },
        });
        if (!res.ok) return;
        const json = (await res.json()) as RawVaultsResponse;
        for (const v of json.data ?? []) {
          map.set(v.address.toLowerCase(), v);
        }
      } catch {
        // best-effort enrichment
      }
    }),
  );
  return map;
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
  const positions = json.positions ?? [];
  if (positions.length === 0) return [];

  // Enrich with full vault metadata (name + APY) by querying /v1/vaults
  // for each (chainId, asset) we hold, then matching by address.
  const meta = await fetchVaultMetaByAddress(
    positions.map((p) => ({ chainId: p.chainId, asset: p.asset.symbol })),
    signal,
  );

  return positions.map((p) =>
    toPortfolio(p, meta.get(p.address.toLowerCase())),
  );
}

export { logoUrlForToken };
