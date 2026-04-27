---
name: check-approval
description: Check and prepare ERC-20 token approvals for Uniswap Trading API swaps. Use when user says "check approval", "approve token", "permit2 approval", "uniswap check_approval", "is token approved", or before any Uniswap Trading API swap involving an ERC-20 token.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(curl:*), Bash(npm:*), Bash(npx:*), WebFetch
model: opus
license: MIT
metadata:
  author: moai
  version: '1.0.0'
  source: https://developers.uniswap.org/docs/api-reference/check_approval
---

# check_approval

Determine whether a wallet has sufficient token approval for a Uniswap swap, and return the approval transaction(s) the wallet must sign if not. This is **Step 1** of the Trading API 3-step flow (`check_approval` → `quote` → `swap`).

## Endpoint

```text
POST https://trade-api.gateway.uniswap.org/v1/check_approval
```

## Required Headers

```text
Content-Type: application/json
x-api-key: <your-api-key>
x-universal-router-version: 2.0
```

Optional:

```text
x-permit2-disabled: true   # opt out of the Permit2 flow
```

Get an API key at the [Uniswap Developer Portal](https://developers.uniswap.org/). Never hardcode the key — load it from an environment variable.

## Request Body

| Field             | Type    | Required | Default   | Description                                                                |
| ----------------- | ------- | -------- | --------- | -------------------------------------------------------------------------- |
| `walletAddress`   | string  | Yes      | —         | Wallet that will initiate the swap. Must match `^0x[a-fA-F0-9]{40}$`       |
| `token`           | string  | Yes      | —         | Contract address of the token being **sent** (input token)                 |
| `amount`          | string  | Yes      | —         | Amount in token base units (wei-style). Must be `> 0`                      |
| `chainId`         | enum    | Yes      | `1`       | Source chain ID (e.g. `1` Ethereum, `8453` Base, `42161` Arbitrum)         |
| `urgency`         | enum    | No       | `urgent`  | Gas pricing tier: `normal`, `fast`, `urgent`                               |
| `includeGasInfo`  | boolean | No       | `false`   | Include estimated gas fees in the response                                 |
| `tokenOut`        | string  | No       | —         | Output token address (used for cross-chain / Permit2-aware approval logic) |
| `tokenOutChainId` | enum    | No       | `chainId` | Destination chain ID for cross-chain swaps                                 |

### Example Request

```bash
curl -X POST https://trade-api.gateway.uniswap.org/v1/check_approval \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UNISWAP_API_KEY" \
  -H "x-universal-router-version: 2.0" \
  -d '{
    "walletAddress": "0xAAAA...",
    "token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "amount": "1000000000",
    "chainId": 1,
    "includeGasInfo": true
  }'
```

## Response

```ts
type CheckApprovalResponse = {
  approval: TransactionRequest | null;   // tx to grant approval, or null if already approved
  cancel?: TransactionRequest | null;    // optional reset-to-zero tx (USDT-style tokens)
  gasFee?: string;                       // wei, present only if includeGasInfo=true
  gasFeeUSD?: string;                    // USD, present only if includeGasInfo=true
};

type TransactionRequest = {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
};
```

### Already-Approved Response

```json
{ "approval": null }
```

When `approval` is `null`, skip ahead to `/quote`.

### Approval-Required Response

```json
{
  "approval": {
    "to": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "from": "0xAAAA...",
    "data": "0x095ea7b3...",
    "value": "0",
    "chainId": 1
  }
}
```

### Reset-Required Response (rare)

Some tokens (notably USDT) require setting allowance to `0` before a new non-zero allowance.

```json
{
  "cancel": { "to": "0x...", "from": "0x...", "data": "0x...", "value": "0", "chainId": 1 },
  "approval": { "to": "0x...", "from": "0x...", "data": "0x...", "value": "0", "chainId": 1 }
}
```

Submit `cancel` first, wait for confirmation, then submit `approval`.

## Decision Flow

```text
POST /check_approval
        │
        ▼
   approval == null ? ──Yes──► proceed to /quote
        │
        No
        │
        ▼
   cancel present ? ──Yes──► sign+send cancel → wait receipt
        │
        ▼
   sign+send approval → wait receipt → proceed to /quote
```

## TypeScript Helper (viem)

```typescript
import { isAddress, type Address, type Hex } from 'viem';

const API_URL = 'https://trade-api.gateway.uniswap.org/v1';

type ApprovalTx = { to: Address; from: Address; data: Hex; value: string; chainId: number };
type CheckApprovalResponse = {
  approval: ApprovalTx | null;
  cancel?: ApprovalTx | null;
  gasFee?: string;
  gasFeeUSD?: string;
};

export async function checkApproval(params: {
  walletAddress: Address;
  token: Address;
  amount: string;
  chainId: number;
  includeGasInfo?: boolean;
  tokenOut?: Address;
  tokenOutChainId?: number;
  urgency?: 'normal' | 'fast' | 'urgent';
}): Promise<CheckApprovalResponse> {
  if (!isAddress(params.walletAddress)) throw new Error('Invalid walletAddress');
  if (!isAddress(params.token)) throw new Error('Invalid token address');
  if (!/^[0-9]+$/.test(params.amount) || params.amount === '0') {
    throw new Error('amount must be a positive integer in base units');
  }

  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) throw new Error('UNISWAP_API_KEY env var not set');

  const res = await fetch(`${API_URL}/check_approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-universal-router-version': '2.0',
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `check_approval failed: ${res.status}`);
  return data as CheckApprovalResponse;
}

export async function ensureApproval(
  walletClient: { sendTransaction: (tx: ApprovalTx) => Promise<Hex> },
  publicClient: { waitForTransactionReceipt: (args: { hash: Hex }) => Promise<unknown> },
  resp: CheckApprovalResponse,
): Promise<void> {
  if (resp.cancel) {
    const hash = await walletClient.sendTransaction(resp.cancel);
    await publicClient.waitForTransactionReceipt({ hash });
  }
  if (resp.approval) {
    const hash = await walletClient.sendTransaction(resp.approval);
    await publicClient.waitForTransactionReceipt({ hash });
  }
}
```

## Input Validation Rules

Before sending user-provided values:

- `walletAddress`, `token`, `tokenOut` MUST match `^0x[a-fA-F0-9]{40}$`
- `amount` MUST match `^[0-9]+$` and be greater than `0`
- `chainId` / `tokenOutChainId` MUST be from the [official supported chains list](https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping)
- API key MUST come from an environment variable, never hardcoded
- REJECT any value containing shell metacharacters: `;`, `|`, `&`, `$`, `` ` ``, `(`, `)`, `>`, `<`, `\`, `'`, `"`, newlines

> **REQUIRED:** Any returned `approval` or `cancel` transaction spends gas. Before broadcasting, confirm with the user (display token, amount, chain, estimated gas) and get explicit approval. Never auto-execute approval transactions.

## Permit2 Notes

- The Trading API uses the **Permit2** approval flow by default. The `approval` tx returned typically grants the user's token to the **Permit2 contract** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`), not directly to the Universal Router.
- After this on-chain approval, each swap is authorized by an **EIP-712 signature** returned in `permitData` from `/quote` — no further on-chain approval needed.
- Send header `x-permit2-disabled: true` to fall back to legacy direct approval to the Universal Router. Use this for backend services or ERC-4337 smart accounts that cannot sign EIP-712 messages.

## Common Errors

| Status | Cause                              | Fix                                                          |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| 400    | Missing/invalid field              | Validate request body against the schema above               |
| 400    | `amount` is `"0"` or non-numeric   | Send a positive integer string in base units                 |
| 401    | Missing or invalid `x-api-key`     | Set the header from `UNISWAP_API_KEY` env var                |
| 404    | Unsupported `chainId` or token     | Cross-check against the supported chains list                |
| 429    | Rate limit exceeded                | Exponential backoff + cache approval results between calls   |
| 500    | Upstream error                     | Retry with backoff; report if persistent                     |

## When to Skip This Call

- Native asset swaps (e.g. `tokenIn === 0x0000...0000` for ETH) — native assets need no approval
- The wallet has already approved the token to Permit2 with `maxUint256` and the previous response returned `approval: null` — but **always** re-check before each swap if there's any doubt; allowances can be revoked

## Reference

- Official docs: <https://developers.uniswap.org/docs/api-reference/check_approval>
- Supported chains: <https://api-docs.uniswap.org/guides/supported_chains#supported-chains-for-swapping>
- Permit2 contract: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (same address on every chain)
- Related skill: `swap-integration` (full 3-step Trading API flow)
