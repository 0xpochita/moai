import type { Address, PublicClient, WalletClient } from "viem";

const DELEGATION_PREFIX = "0xef0100" as const;

export interface DelegationStatus {
  isDelegated: boolean;
  delegateAddress: Address | null;
}

export function getGuardedHookAddress(): Address | null {
  const raw = process.env.NEXT_PUBLIC_GUARDED_HOOK_ADDRESS;
  if (!raw) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw as Address;
}

export function parseDelegationCode(code: string): Address | null {
  if (!code || code === "0x") return null;
  const lower = code.toLowerCase();
  if (!lower.startsWith(DELEGATION_PREFIX)) return null;
  const tail = lower.slice(DELEGATION_PREFIX.length);
  if (tail.length < 40) return null;
  return `0x${tail.slice(0, 40)}` as Address;
}

export async function readDelegationStatus(
  client: PublicClient,
  address: Address,
): Promise<DelegationStatus> {
  const code = await client.getCode({ address });
  const delegate = parseDelegationCode(code ?? "0x");
  return {
    isDelegated: delegate !== null,
    delegateAddress: delegate,
  };
}

export interface DelegateInput {
  walletClient: WalletClient;
  delegate: Address;
  chainId: number;
}

export async function signDelegateAuthorization({
  walletClient,
  delegate,
  chainId,
}: DelegateInput) {
  if (!walletClient.account) {
    throw new Error("Wallet client has no account");
  }
  return walletClient.signAuthorization({
    account: walletClient.account,
    contractAddress: delegate,
    chainId,
  });
}

export async function submitSelfDelegationTx({
  walletClient,
  delegate,
  chainId,
}: DelegateInput): Promise<`0x${string}`> {
  const account = walletClient.account;
  if (!account) throw new Error("Wallet client has no account");

  const auth = await signDelegateAuthorization({
    walletClient,
    delegate,
    chainId,
  });

  return walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    to: account.address,
    value: 0n,
    data: "0x",
    authorizationList: [auth],
  });
}

export async function revokeDelegation(
  walletClient: WalletClient,
  chainId: number,
): Promise<`0x${string}`> {
  return submitSelfDelegationTx({
    walletClient,
    delegate: "0x0000000000000000000000000000000000000000",
    chainId,
  });
}
