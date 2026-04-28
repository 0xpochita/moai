import { type Address, getAddress } from "viem";
import type { DestinationVault, MigrationPlan } from "@/types";
import { APPROVE_MAX, encodeApproveCalldata } from "./calldata-encoders";
import { fetchComposerQuote } from "./lifi-composer";
import { fetchPortfolio } from "./lifi-earn";

const LIFI_DIAMOND = getAddress("0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae");

const USDC_BASE = getAddress("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");

function toAtomicAmount(humanAmount: string, decimals: number): bigint {
  if (!humanAmount || humanAmount === "0") return 0n;
  const [whole, fraction = ""] = humanAmount.split(".");
  const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole + padded);
}

function makeWithdrawDestination(toToken: {
  address: Address;
  symbol: string;
  decimals: number;
}): DestinationVault {
  return {
    id: `withdraw-${toToken.symbol.toLowerCase()}`,
    address: toToken.address,
    chainId: 8453,
    name: `${toToken.symbol} in wallet`,
    protocolName: "Wallet",
    protocolUrl: "",
    underlyingTokenAddress: toToken.address,
    underlyingTokenSymbol: toToken.symbol,
    underlyingTokenDecimals: toToken.decimals,
    apyBase: 0,
    apyTotal: 0,
    apy30d: 0,
    tvlUsd: 0,
    tags: [],
    isTransactional: true,
    vaultUrl: "",
  };
}

export async function buildWithdrawalPlan(
  ownerAddress: string,
  vaultAddress: string,
  signal?: AbortSignal,
): Promise<MigrationPlan> {
  const owner = getAddress(ownerAddress);
  const vault = getAddress(vaultAddress);

  const portfolio = await fetchPortfolio(owner, signal);
  const holding = portfolio.find(
    (p) => p.vaultAddress.toLowerCase() === vault.toLowerCase(),
  );
  if (!holding) {
    throw new Error("Vault holding not found for owner");
  }

  const valueUsd =
    holding.underlyingBalanceUsd > 0 ? holding.underlyingBalanceUsd : 0;
  const toToken = {
    address: USDC_BASE,
    symbol: "USDC",
    decimals: 6,
  };
  const destination = makeWithdrawDestination(toToken);

  const sharesAtomic = toAtomicAmount(
    holding.shares,
    holding.underlyingTokenDecimals,
  );
  const fromAmount = sharesAtomic > 0n ? sharesAtomic : 1n;

  const approveCalldata = encodeApproveCalldata(LIFI_DIAMOND, APPROVE_MAX);

  let composerCalldata: string | null = null;
  let composerValue = "0";
  let composerTo: Address = LIFI_DIAMOND;
  try {
    const quote = await fetchComposerQuote(
      {
        fromChain: 8453,
        toChain: 8453,
        fromToken: vault,
        toToken: toToken.address,
        fromAmount: fromAmount.toString(),
        fromAddress: owner,
        slippage: 0.005,
      },
      signal,
    );
    if (quote.transactionRequest) {
      composerCalldata = quote.transactionRequest.data;
      composerValue = quote.transactionRequest.value ?? "0";
      composerTo = getAddress(quote.transactionRequest.to);
    }
  } catch (err) {
    console.warn("[withdrawal-planner] composer quote failed:", err);
  }

  const pairLabel = `${holding.vaultName}`;
  const synthSource: MigrationPlan["source"] = {
    protocol: "v4",
    pair: pairLabel,
    chain: "base",
    valueUsd,
    feeTier: holding.apyTotal,
    poolAddress: vault,
    status: "in-range",
  };

  return {
    intent: "withdraw",
    positionTokenId: vault,
    positionId: `withdraw-${vault}`,
    source: synthSource,
    destination,
    legs: [
      {
        kind: "swap",
        target: `${holding.vaultName} (vault LP)`,
        targetAddress: vault,
        description: `Approve Li.Fi router to redeem ${holding.vaultName} shares.`,
        calldata: approveCalldata,
        value: "0",
      },
      {
        kind: "withdraw",
        target: "Li.Fi Composer",
        targetAddress: composerTo,
        description: composerCalldata
          ? `Redeem ${holding.vaultName} → ${toToken.symbol} via Li.Fi Composer.`
          : `Redeem ${holding.vaultName} → ${toToken.symbol} (composer call will be re-fetched at execute time).`,
        calldata: composerCalldata ?? undefined,
        value: composerValue,
      },
    ],
    yield: {
      perDayUsd: 0,
      perMonthUsd: 0,
      perYearUsd: 0,
      apyPercent: 0,
    },
    generatedAtSec: Math.floor(Date.now() / 1000),
  };
}
