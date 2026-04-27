import type { Network, NetworkId } from "@/types";

const TW = (chain: string): string =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;

export const NETWORKS: Network[] = [
  {
    id: "all",
    label: "All networks",
    chainName: null,
    accent: "#ec4899",
    logoUrl: null,
  },
  {
    id: "ethereum",
    label: "Ethereum",
    chainName: "Ethereum",
    accent: "#627eea",
    logoUrl: TW("ethereum"),
  },
  {
    id: "unichain",
    label: "Unichain",
    chainName: "Unichain",
    accent: "#ff007a",
    logoUrl: "/Assets/Images/logo-defi/uniswap-logo.svg",
  },
  {
    id: "base",
    label: "Base",
    chainName: "Base",
    accent: "#0052ff",
    logoUrl: TW("base"),
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    chainName: "Arbitrum",
    accent: "#28a0f0",
    logoUrl: TW("arbitrum"),
  },
  {
    id: "polygon",
    label: "Polygon",
    chainName: "Polygon",
    accent: "#8247e5",
    logoUrl: TW("polygon"),
  },
  {
    id: "optimism",
    label: "Optimism",
    chainName: "Optimism",
    accent: "#ff0420",
    logoUrl: TW("optimism"),
  },
];

export function getNetwork(id: NetworkId): Network {
  return NETWORKS.find((n) => n.id === id) ?? NETWORKS[0];
}

export function networkInitial(label: string): string {
  return label.charAt(0).toUpperCase();
}
