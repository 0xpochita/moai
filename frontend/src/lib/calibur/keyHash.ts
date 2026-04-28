import { type Address, encodeAbiParameters, type Hex, keccak256 } from "viem";
import { KeyType, type KeyTypeValue } from "./abi";

export interface CaliburKey {
  keyType: KeyTypeValue;
  publicKey: Hex;
}

/// Build a Secp256k1 key from an EOA address.
/// Matches KeyLib's `Key{Secp256k1, abi.encode(address)}` shape.
export function secp256k1KeyFromAddress(address: Address): CaliburKey {
  return {
    keyType: KeyType.Secp256k1,
    publicKey: encodeAbiParameters([{ type: "address" }], [address]),
  };
}

/// keyHash = keccak256(abi.encode(key.keyType, keccak256(key.publicKey)))
/// Matches KeyLib.hash on-chain.
export function computeKeyHash(key: CaliburKey): Hex {
  const publicKeyHash = keccak256(key.publicKey);
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint8" }, { type: "bytes32" }],
      [key.keyType, publicKeyHash],
    ),
  );
}

/// Convenience: derive keyHash for an agent EOA address.
export function agentKeyHashForAddress(address: Address): Hex {
  return computeKeyHash(secp256k1KeyFromAddress(address));
}
