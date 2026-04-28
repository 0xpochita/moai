import {
  type Address,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  agentKeyHashForAddress,
  CALIBUR_ABI,
  type CaliburCall,
  type CaliburSignedBatchedCall,
  HOOK_DATA_EMPTY,
  NONCE_KEY,
  packNonce,
  packSettings,
  ROOT_KEY_HASH,
  secp256k1KeyFromAddress,
  signedBatchedCallTypedData,
  thirtyDaysFromNow,
} from "@/lib/calibur";
import { baseClient } from "./viem-client";

const BASE_CHAIN_ID = 8453;
const CALIBUR_HOOK_ENV = "NEXT_PUBLIC_CALIBUR_HOOK_ADDRESS";

/// Reads the deployed CaliburExecutionHook address (the per-key hook
/// pointer attached during registration). Falls back to the legacy
/// GuardedExecutorHook env var so existing setups don't break.
export function getCaliburHookAddress(): Address | null {
  const direct = process.env[CALIBUR_HOOK_ENV];
  if (direct && /^0x[0-9a-fA-F]{40}$/.test(direct)) return direct as Address;
  const legacy = process.env.NEXT_PUBLIC_GUARDED_HOOK_ADDRESS;
  if (legacy && /^0x[0-9a-fA-F]{40}$/.test(legacy)) return legacy as Address;
  return null;
}

/// Returns the wallet client used by the relayer (= keeper hot wallet).
export function getRelayerWallet() {
  const pk = process.env.KEEPER_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
  const account = privateKeyToAccount(pk as Hex);
  const transport = http(
    process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
  );
  return createWalletClient({ account, chain: base, transport });
}

/// The agent key (= keeper key) treated as a Secp256k1 Calibur key.
export function getAgentInfo(): { address: Address; keyHash: Hex } | null {
  const wallet = getRelayerWallet();
  if (!wallet) return null;
  const address = wallet.account.address;
  return { address, keyHash: agentKeyHashForAddress(address) };
}

// ─── Registration ceremony ─────────────────────────────────────────────

/// Inner calls for "register the agent key + set its hook + 30-day expiry".
/// The user signs an EIP-712 SignedBatchedCall containing these, with
/// keyHash = ROOT_KEY_HASH (the user is the root).
export function buildRegistrationCalls(
  userEoa: Address,
  agentAddress: Address,
  hookAddress: Address,
): CaliburCall[] {
  const agentKey = secp256k1KeyFromAddress(agentAddress);
  const agentKeyHash = agentKeyHashForAddress(agentAddress);
  const settings = packSettings({
    hook: hookAddress,
    expirationSec: thirtyDaysFromNow(),
    isAdmin: false,
  });

  const registerData = encodeFunctionData({
    abi: CALIBUR_ABI,
    functionName: "register",
    args: [{ keyType: agentKey.keyType, publicKey: agentKey.publicKey }],
  });

  const updateData = encodeFunctionData({
    abi: CALIBUR_ABI,
    functionName: "update",
    args: [agentKeyHash, settings],
  });

  // Both calls hit the user's own EOA (Calibur singleton bytecode).
  return [
    { to: userEoa, value: 0n, data: registerData },
    { to: userEoa, value: 0n, data: updateData },
  ];
}

export interface BuildRegistrationBatchResult {
  /// Typed-data envelope for the user to sign with `signTypedData_v4`.
  typedData: ReturnType<typeof signedBatchedCallTypedData>;
  /// Raw struct mirrors the typed data and is replayed when relaying.
  signedBatchedCall: CaliburSignedBatchedCall;
}

/// Build the full registration envelope (typed-data + struct) for the
/// frontend to sign. Pulls live nonce from chain.
export async function buildRegistrationBatch(args: {
  userEoa: Address;
  agentAddress: Address;
  hookAddress: Address;
  /// Defaults to address(0) = anyone can relay.
  executor?: Address;
  /// Defaults to no deadline.
  deadlineSec?: bigint;
}): Promise<BuildRegistrationBatchResult> {
  const calls = buildRegistrationCalls(
    args.userEoa,
    args.agentAddress,
    args.hookAddress,
  );

  const seq = await readSeq(args.userEoa, NONCE_KEY.registration);
  const signedBatchedCall: CaliburSignedBatchedCall = {
    batchedCall: { calls, revertOnFailure: true },
    nonce: packNonce(NONCE_KEY.registration, seq),
    keyHash: ROOT_KEY_HASH,
    executor: args.executor ?? "0x0000000000000000000000000000000000000000",
    deadline: args.deadlineSec ?? 0n,
  };

  return {
    typedData: signedBatchedCallTypedData(args.userEoa, signedBatchedCall),
    signedBatchedCall,
  };
}

// ─── Agent batch (migration / withdrawal / rotation) ───────────────────

export interface BuildAgentBatchResult {
  signedBatchedCall: CaliburSignedBatchedCall;
  /// EIP-712 typed data the agent will sign with KEEPER_PRIVATE_KEY.
  typedData: ReturnType<typeof signedBatchedCallTypedData>;
}

export async function buildAgentBatch(args: {
  userEoa: Address;
  /// Inner protocol calls (burn, approve, swap, deposit ...)
  calls: CaliburCall[];
  /// Distinguishes parallel sequences. Default = migration.
  nonceKey?: bigint;
  /// 0 = never expires.
  deadlineSec?: bigint;
}): Promise<BuildAgentBatchResult> {
  const agent = getAgentInfo();
  if (!agent) throw new Error("KEEPER_PRIVATE_KEY not configured");
  const nonceKey = args.nonceKey ?? NONCE_KEY.migration;
  const seq = await readSeq(args.userEoa, nonceKey);

  const signedBatchedCall: CaliburSignedBatchedCall = {
    batchedCall: { calls: args.calls, revertOnFailure: true },
    nonce: packNonce(nonceKey, seq),
    keyHash: agent.keyHash,
    executor: "0x0000000000000000000000000000000000000000",
    deadline: args.deadlineSec ?? 0n,
  };

  return {
    signedBatchedCall,
    typedData: signedBatchedCallTypedData(args.userEoa, signedBatchedCall),
  };
}

/// Sign a SignedBatchedCall as the agent (= keeper key).
export async function signAsAgent(
  typedData: ReturnType<typeof signedBatchedCallTypedData>,
): Promise<Hex> {
  const wallet = getRelayerWallet();
  if (!wallet) throw new Error("KEEPER_PRIVATE_KEY not configured");
  return wallet.signTypedData(typedData);
}

// ─── Relay ─────────────────────────────────────────────────────────────

/// Wrap a raw signature in `abi.encode(bytes signature, bytes hookData)`
/// as Calibur's relayed `execute` expects.
export function wrapSignature(signature: Hex): Hex {
  return encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes" }],
    [signature, HOOK_DATA_EMPTY],
  );
}

/// Submit a signed batch through the relayer wallet. `userEoa` is the
/// `to` of the transaction because Calibur's bytecode lives at the user's
/// EOA.
export async function relaySignedBatch(args: {
  userEoa: Address;
  signedBatchedCall: CaliburSignedBatchedCall;
  /// Either the user's signature (registration) or the agent's (action).
  signature: Hex;
}): Promise<Hex> {
  const wallet = getRelayerWallet();
  if (!wallet) throw new Error("KEEPER_PRIVATE_KEY not configured");

  const wrapped = wrapSignature(args.signature);
  const data = encodeFunctionData({
    abi: CALIBUR_ABI,
    functionName: "execute",
    args: [args.signedBatchedCall, wrapped],
  });

  // Total ETH value the inner calls will move.
  const totalValue = args.signedBatchedCall.batchedCall.calls.reduce(
    (sum, c) => sum + c.value,
    0n,
  );

  return wallet.sendTransaction({
    account: wallet.account,
    chain: wallet.chain,
    to: args.userEoa,
    data,
    value: totalValue,
    chainId: BASE_CHAIN_ID,
  });
}

// ─── On-chain reads ────────────────────────────────────────────────────

/// Read the next valid sequence number for a (userEoa, nonceKey) pair.
/// Returns 0 if reading fails (fresh nonce sequence).
async function readSeq(userEoa: Address, nonceKey: bigint): Promise<bigint> {
  try {
    const seq = await baseClient.readContract({
      address: userEoa,
      abi: CALIBUR_ABI,
      functionName: "getSeq",
      args: [nonceKey],
    });
    return BigInt(seq as bigint);
  } catch {
    return 0n;
  }
}

/// True if the agent key is currently registered on this user's Calibur
/// instance (and not expired).
export async function isAgentRegistered(userEoa: Address): Promise<boolean> {
  const agent = getAgentInfo();
  if (!agent) return false;
  try {
    const registered = await baseClient.readContract({
      address: userEoa,
      abi: CALIBUR_ABI,
      functionName: "isRegistered",
      args: [agent.keyHash],
    });
    if (!registered) return false;
    const settings = await baseClient.readContract({
      address: userEoa,
      abi: CALIBUR_ABI,
      functionName: "getKeySettings",
      args: [agent.keyHash],
    });
    const expiration =
      (BigInt(settings as bigint) >> 160n) & ((1n << 40n) - 1n);
    if (expiration === 0n) return true;
    return expiration > BigInt(Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}
