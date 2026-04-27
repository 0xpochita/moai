const COMPOSER_BASE = process.env.LIFI_COMPOSER_BASE_URL ?? "https://li.quest";

export interface ComposerQuoteRequest {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  slippage?: number;
}

export interface ComposerTransactionRequest {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  gasPrice?: string;
}

export interface ComposerQuoteResponse {
  type: string;
  id: string;
  tool: string;
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress?: string;
    executionDuration?: number;
  };
  transactionRequest?: ComposerTransactionRequest;
}

function getApiKey(): string {
  const key = process.env.LIFI_API_KEY;
  if (!key) throw new Error("LIFI_API_KEY is not set");
  return key;
}

export async function fetchComposerQuote(
  req: ComposerQuoteRequest,
  signal?: AbortSignal,
): Promise<ComposerQuoteResponse> {
  const params = new URLSearchParams({
    fromChain: String(req.fromChain),
    toChain: String(req.toChain),
    fromToken: req.fromToken,
    toToken: req.toToken,
    fromAmount: req.fromAmount,
    fromAddress: req.fromAddress,
  });
  if (req.slippage !== undefined) {
    params.set("slippage", String(req.slippage));
  }

  const res = await fetch(`${COMPOSER_BASE}/v1/quote?${params.toString()}`, {
    signal,
    headers: {
      "x-lifi-api-key": getApiKey(),
      accept: "application/json",
    },
  });

  const data = (await res.json()) as ComposerQuoteResponse & {
    message?: string;
    code?: number;
  };

  if (!res.ok) {
    throw new Error(data.message ?? `composer quote failed (${res.status})`);
  }

  return data;
}
