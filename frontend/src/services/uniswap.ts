const TRADING_API_BASE = "https://trade-api.gateway.uniswap.org/v1";

export interface CheckApprovalRequest {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
  tokenOut?: string;
  tokenOutChainId?: number;
  includeGasInfo?: boolean;
}

export interface ApprovalTransaction {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
}

export interface CheckApprovalResponse {
  approval: ApprovalTransaction | null;
  cancel?: ApprovalTransaction | null;
  gasFee?: string;
  gasFeeUSD?: string;
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const AMOUNT_PATTERN = /^[0-9]+$/;

function assertValidRequest(req: CheckApprovalRequest): void {
  if (!ADDRESS_PATTERN.test(req.walletAddress)) {
    throw new Error("walletAddress is not a valid EVM address");
  }
  if (!ADDRESS_PATTERN.test(req.token)) {
    throw new Error("token is not a valid EVM address");
  }
  if (!AMOUNT_PATTERN.test(req.amount) || req.amount === "0") {
    throw new Error("amount must be a positive integer in base units");
  }
  if (!Number.isInteger(req.chainId) || req.chainId <= 0) {
    throw new Error("chainId must be a positive integer");
  }
}

export async function checkApproval(
  req: CheckApprovalRequest,
  apiKey: string,
  signal?: AbortSignal,
): Promise<CheckApprovalResponse> {
  assertValidRequest(req);
  if (!apiKey) {
    throw new Error("Uniswap Trading API key is required");
  }

  const res = await fetch(`${TRADING_API_BASE}/check_approval`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-universal-router-version": "2.0",
    },
    body: JSON.stringify(req),
  });

  const data = (await res.json()) as CheckApprovalResponse & {
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(data.detail ?? `check_approval failed (${res.status})`);
  }
  return data;
}
