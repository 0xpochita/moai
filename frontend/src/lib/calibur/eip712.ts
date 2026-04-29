import type { Address, Hex, TypedDataDomain } from "viem";

const BASE_CHAIN_ID = 8453;

export interface CaliburCall {
  to: Address;
  value: bigint;
  data: Hex;
}

export interface CaliburBatchedCall {
  calls: CaliburCall[];
  revertOnFailure: boolean;
}

export interface CaliburSignedBatchedCall {
  batchedCall: CaliburBatchedCall;
  nonce: bigint;
  keyHash: Hex;
  /// `0x0000000000000000000000000000000000000000` allows anyone to relay.
  executor: Address;
  /// 0 = never expires.
  deadline: bigint;
}

/// Calibur singleton implementation address — packed into the EIP-712 salt.
const CALIBUR_IMPL: Address = "0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00";

/// Domain salt = (prefix << 160) | implementation. Default prefix is 0.
/// Matches PrefixedSaltLib.pack on-chain.
export const CALIBUR_DOMAIN_SALT: `0x${string}` = ("0x" +
  CALIBUR_IMPL.slice(2).toLowerCase().padStart(64, "0")) as `0x${string}`;

/// Calibur's EIP-712 domain. `verifyingContract` is the user's EOA because
/// Calibur runs as the EOA's bytecode (post-7702). Different per user.
/// `salt` includes the implementation address so two Calibur deployments
/// can't accept each other's signatures.
export function caliburDomain(
  userEoa: Address,
  chainId: number = BASE_CHAIN_ID,
): TypedDataDomain {
  return {
    name: "Calibur",
    version: "1.0.0",
    chainId,
    verifyingContract: userEoa,
    salt: CALIBUR_DOMAIN_SALT,
  };
}

/// Type definitions matching CallLib / BatchedCallLib / SignedBatchedCallLib
/// type strings verbatim (order matters for the typehash).
export const CALIBUR_TYPES = {
  Call: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
  BatchedCall: [
    { name: "calls", type: "Call[]" },
    { name: "revertOnFailure", type: "bool" },
  ],
  SignedBatchedCall: [
    { name: "batchedCall", type: "BatchedCall" },
    { name: "nonce", type: "uint256" },
    { name: "keyHash", type: "bytes32" },
    { name: "executor", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/// Returns the args you pass to `viem.signTypedData(...)` to sign the
/// SignedBatchedCall envelope.
export function signedBatchedCallTypedData(
  userEoa: Address,
  signedBatchedCall: CaliburSignedBatchedCall,
  chainId: number = BASE_CHAIN_ID,
) {
  return {
    domain: caliburDomain(userEoa, chainId),
    types: CALIBUR_TYPES,
    primaryType: "SignedBatchedCall" as const,
    message: signedBatchedCall,
  };
}

/// Pack a (key, sequence) pair into the uint256 nonce that Calibur's
/// INonceManager expects: `(key << 64) | seq`. `key` uses the upper 192
/// bits, `seq` the lower 64.
export function packNonce(nonceKey: bigint, seq: bigint): bigint {
  const KEY_MAX = (1n << 192n) - 1n;
  const SEQ_MAX = (1n << 64n) - 1n;
  if (nonceKey < 0n || nonceKey > KEY_MAX) {
    throw new Error(`packNonce: nonceKey out of 192-bit range (${nonceKey})`);
  }
  if (seq < 0n || seq > SEQ_MAX) {
    throw new Error(`packNonce: seq out of 64-bit range (${seq})`);
  }
  return (nonceKey << 64n) | seq;
}

/// Reasonable distinct nonce keys for our use cases.
export const NONCE_KEY = {
  registration: 1n,
  migration: 2n,
  withdrawal: 3n,
  rotation: 4n,
  harvest: 5n,
} as const;
