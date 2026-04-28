import {
  type Address,
  encodeFunctionData,
  type Hex,
  type WalletClient,
} from "viem";

const HOOK_EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

export interface HookCall {
  target: Address;
  value: bigint;
  data: Hex;
}

export function encodeHookExecuteCalldata(calls: HookCall[]): Hex {
  return encodeFunctionData({
    abi: HOOK_EXECUTE_ABI,
    functionName: "execute",
    args: [calls],
  });
}

export interface SubmitMigrationArgs {
  walletClient: WalletClient;
  calls: HookCall[];
  chainId: number;
}

export async function submitMigrationBatch({
  walletClient,
  calls,
  chainId,
}: SubmitMigrationArgs): Promise<Hex> {
  const account = walletClient.account;
  if (!account) throw new Error("Wallet client has no account");

  const calldata = encodeHookExecuteCalldata(calls);
  const totalValue = calls.reduce((sum, c) => sum + c.value, 0n);

  return walletClient.sendTransaction({
    account,
    chain: walletClient.chain,
    to: account.address,
    data: calldata,
    value: totalValue,
    chainId,
  });
}
