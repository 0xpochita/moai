export type NetworkId = "base" | "ethereum" | "arbitrum" | "optimism";

export interface Network {
  id: NetworkId;
  label: string;
  chainId: number;
  accent: string;
  logoUrl: string | null;
  explorerUrl: string;
}
