import type { Address } from "viem";

/// Calibur singleton — same address on every supported chain.
export const CALIBUR_SINGLETON: Address =
  "0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00";

/// Sentinel value Calibur uses for the EOA's own root key hash.
export const ROOT_KEY_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/// keyType enum values — must match KeyLib.KeyType.
export const KeyType = {
  P256: 0,
  WebAuthnP256: 1,
  Secp256k1: 2,
} as const;
export type KeyTypeValue = (typeof KeyType)[keyof typeof KeyType];

/// Minimal ABI for the calls we make from the agent / relayer.
/// Source: github.com/Uniswap/calibur (commit 35d80918e120d177a49d3d90bcd4dd011caedd32).
export const CALIBUR_ABI = [
  // ── Key management ──────────────────────────────────────────────────
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          { name: "keyType", type: "uint8" },
          { name: "publicKey", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "revoke",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "keyHash", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "update",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "keyHash", type: "bytes32" },
      { name: "keySettings", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "isRegistered",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "keyHash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getKeySettings",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "keyHash", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },

  // ── Nonces ──────────────────────────────────────────────────────────
  {
    name: "getSeq",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "key", type: "uint256" }],
    outputs: [{ name: "seq", type: "uint256" }],
  },

  // ── EIP-712 ─────────────────────────────────────────────────────────
  {
    name: "domainSeparator",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    name: "eip712Domain",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },

  // ── Execute (admin: only callable by self/root) ─────────────────────
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "batchedCall",
        type: "tuple",
        components: [
          {
            name: "calls",
            type: "tuple[]",
            components: [
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "data", type: "bytes" },
            ],
          },
          { name: "revertOnFailure", type: "bool" },
        ],
      },
    ],
    outputs: [],
  },

  // ── Execute (relayer entrypoint, signature-verified) ────────────────
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "signedBatchedCall",
        type: "tuple",
        components: [
          {
            name: "batchedCall",
            type: "tuple",
            components: [
              {
                name: "calls",
                type: "tuple[]",
                components: [
                  { name: "to", type: "address" },
                  { name: "value", type: "uint256" },
                  { name: "data", type: "bytes" },
                ],
              },
              { name: "revertOnFailure", type: "bool" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "keyHash", type: "bytes32" },
          { name: "executor", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "wrappedSignature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/// `wrappedSignature` for the relayed `execute` is `abi.encode(bytes signature, bytes hookData)`.
/// We don't currently pass hookData, so this just wraps the raw signature.
export const HOOK_DATA_EMPTY = "0x" as const;
