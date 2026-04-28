export interface DestinationVault {
  id: string;
  address: string;
  chainId: number;
  name: string;
  protocolName: string;
  protocolUrl: string;
  underlyingTokenAddress: string;
  underlyingTokenSymbol: string;
  underlyingTokenDecimals: number;
  apyBase: number;
  apyTotal: number;
  apy30d: number;
  tvlUsd: number;
  tags: string[];
  isTransactional: boolean;
  vaultUrl: string;
}

export interface PortfolioPosition {
  vaultId: string;
  vaultAddress: string;
  chainId: number;
  vaultName: string;
  protocolName: string;
  protocolUrl: string;
  underlyingTokenAddress: string;
  underlyingTokenSymbol: string;
  underlyingTokenDecimals: number;
  shares: string;
  underlyingBalance: string;
  underlyingBalanceUsd: number;
  apyTotal: number;
  pnlUsd: number;
}
