import type { Address } from "viem";

/// Calibur Settings packs a key's metadata into a single uint256:
///
///   6 bytes UNUSED | 1 byte isAdmin | 5 bytes expiration | 20 bytes hook
///
/// Source: src/libraries/SettingsLib.sol
export interface PackedSettingsInput {
  /// Hook contract address (or zero for "no hook"). Lives in the low 20 bytes.
  hook?: Address;
  /// Unix timestamp (seconds) when the key expires. 0 = never. Stored as uint40.
  expirationSec?: bigint;
  /// True if this key has root/admin privileges.
  isAdmin?: boolean;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const UINT40_MAX = (1n << 40n) - 1n;

export function packSettings(input: PackedSettingsInput = {}): bigint {
  const hook = input.hook ?? ZERO_ADDRESS;
  const exp = input.expirationSec ?? 0n;
  if (exp < 0n || exp > UINT40_MAX) {
    throw new Error(`packSettings: expirationSec out of uint40 range (${exp})`);
  }
  const isAdmin = input.isAdmin ? 1n : 0n;

  const hookPart = BigInt(hook);
  const expPart = exp << 160n;
  const adminPart = isAdmin << 200n;

  return adminPart | expPart | hookPart;
}

/// 30 days from now in seconds (uint40-safe).
export function thirtyDaysFromNow(): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + 30n * 24n * 60n * 60n;
}
