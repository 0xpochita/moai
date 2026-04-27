import type { Network, NetworkId } from "@/types";

export const NETWORKS: Network[] = [
  { id: "all", label: "All networks", chainName: null, accent: "#ec4899" },
  {
    id: "ethereum",
    label: "Ethereum",
    chainName: "Ethereum",
    accent: "#627eea",
  },
  {
    id: "unichain",
    label: "Unichain",
    chainName: "Unichain",
    accent: "#ff007a",
  },
  { id: "base", label: "Base", chainName: "Base", accent: "#0052ff" },
  {
    id: "arbitrum",
    label: "Arbitrum",
    chainName: "Arbitrum",
    accent: "#28a0f0",
  },
  { id: "polygon", label: "Polygon", chainName: "Polygon", accent: "#8247e5" },
  {
    id: "optimism",
    label: "Optimism",
    chainName: "Optimism",
    accent: "#ff0420",
  },
];

export function getNetwork(id: NetworkId): Network {
  return NETWORKS.find((n) => n.id === id) ?? NETWORKS[0];
}

export function networkInitial(label: string): string {
  return label.charAt(0).toUpperCase();
}
