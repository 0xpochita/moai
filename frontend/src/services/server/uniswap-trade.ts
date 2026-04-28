const TRADE_API_BASE =
  process.env.UNISWAP_TRADE_API_BASE ??
  "https://trade-api.gateway.uniswap.org/v1";

function getApiKey(): string {
  const key = process.env.UNISWAP_API;
  if (!key) throw new Error("UNISWAP_API is not set");
  return key;
}

export interface CheckApprovalRequest {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: number;
}

export interface ApprovalCalldata {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
}

export interface CheckApprovalResponse {
  approval: ApprovalCalldata | null;
  cancel?: ApprovalCalldata | null;
}

export async function checkUniswapApproval(
  req: CheckApprovalRequest,
  signal?: AbortSignal,
): Promise<CheckApprovalResponse> {
  const res = await fetch(`${TRADE_API_BASE}/check_approval`, {
    method: "POST",
    signal,
    headers: {
      "x-api-key": getApiKey(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`uniswap check_approval failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as CheckApprovalResponse;
}

export interface QuoteRequest {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance?: number;
  routingPreference?: "BEST_PRICE" | "CLASSIC" | "FASTEST";
  protocols?: Array<"V2" | "V3" | "V4">;
}

export interface ClassicQuote {
  routing: "CLASSIC";
  quote: {
    input: { token: string; amount: string };
    output: { token: string; amount: string };
    slippage: number;
    route: unknown[];
    gasFee: string;
    gasFeeUSD?: string;
    gasUseEstimate?: string;
  };
  permitData: unknown;
}

export async function fetchUniswapQuote(
  req: QuoteRequest,
  signal?: AbortSignal,
): Promise<ClassicQuote> {
  const body = {
    ...req,
    tokenInChainId: String(req.tokenInChainId),
    tokenOutChainId: String(req.tokenOutChainId),
    slippageTolerance: req.slippageTolerance ?? 0.5,
    routingPreference: req.routingPreference ?? "CLASSIC",
    protocols: req.protocols ?? ["V3", "V4"],
  };

  const res = await fetch(`${TRADE_API_BASE}/quote`, {
    method: "POST",
    signal,
    headers: {
      "x-api-key": getApiKey(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`uniswap quote failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as ClassicQuote & { routing?: string };
  if (json.routing !== "CLASSIC") {
    throw new Error(
      `uniswap quote returned non-CLASSIC routing (${json.routing}); UniswapX requires off-chain submission and is not yet supported by the agent`,
    );
  }
  return json;
}

export interface SwapTransaction {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface SwapResponse {
  swap: SwapTransaction;
}

export async function fetchUniswapSwap(
  quote: ClassicQuote,
  signal?: AbortSignal,
): Promise<SwapResponse> {
  // Strip permitData (often null on CLASSIC) and any null fields the API rejects.
  const { permitData: _omit, ...cleanQuote } = quote;
  const body: Record<string, unknown> = { ...cleanQuote };

  const res = await fetch(`${TRADE_API_BASE}/swap`, {
    method: "POST",
    signal,
    headers: {
      "x-api-key": getApiKey(),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`uniswap swap failed (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as SwapResponse;
  if (
    !json.swap?.data ||
    json.swap.data === "0x" ||
    json.swap.data.length < 10
  ) {
    throw new Error("uniswap swap returned empty calldata (quote expired?)");
  }
  return json;
}
