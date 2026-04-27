import type { Network, NetworkId } from "@/types";

const TW = (chain: string): string =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;

export const NETWORKS: Network[] = [
  {
    id: "base",
    label: "Base",
    chainId: 8453,
    accent: "#0052ff",
    logoUrl: TW("base"),
    explorerUrl: "https://basescan.org",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    chainId: 1,
    accent: "#627eea",
    logoUrl: TW("ethereum"),
    explorerUrl: "https://etherscan.io",
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    chainId: 42161,
    accent: "#28a0f0",
    logoUrl: TW("arbitrum"),
    explorerUrl: "https://arbiscan.io",
  },
  {
    id: "optimism",
    label: "Optimism",
    chainId: 10,
    accent: "#ff0420",
    logoUrl: TW("optimism"),
    explorerUrl: "https://optimistic.etherscan.io",
  },
];

const NETWORK_BY_ID: Record<NetworkId, Network> = NETWORKS.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<NetworkId, Network>,
);

export function getNetwork(id: NetworkId): Network {
  return NETWORK_BY_ID[id] ?? NETWORKS[0];
}

export function explorerTxUrl(id: NetworkId, hash: string): string {
  return `${getNetwork(id).explorerUrl}/tx/${hash}`;
}

export function explorerAddressUrl(id: NetworkId, address: string): string {
  return `${getNetwork(id).explorerUrl}/address/${address}`;
}
