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
  vaultName: string;
  protocolName: string;
  protocolUrl: string;
  underlyingTokenSymbol: string;
  shares: string;
  underlyingBalanceUsd: number;
  apyTotal: number;
  pnlUsd: number;
}
