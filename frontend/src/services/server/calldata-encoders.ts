import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  maxUint256,
  toHex,
} from "viem";

const V4_ACTION_BURN_POSITION = 0x03;
const V4_ACTION_TAKE_PAIR = 0x10;

const POSITION_MANAGER_V4_ABI = [
  {
    name: "modifyLiquidities",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "unlockData", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export interface BurnV4Args {
  tokenId: bigint;
  currency0: Address;
  currency1: Address;
  recipient: Address;
  deadlineSec: bigint;
}

export function encodeV4BurnCalldata(args: BurnV4Args): Hex {
  const actionsBytes = toHex(
    new Uint8Array([V4_ACTION_BURN_POSITION, V4_ACTION_TAKE_PAIR]),
  );

  const burnParams = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [args.tokenId, 0n, 0n, "0x"],
  );

  const takePairParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [args.currency0, args.currency1, args.recipient],
  );

  const unlockData = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actionsBytes, [burnParams, takePairParams]],
  );

  return encodeFunctionData({
    abi: POSITION_MANAGER_V4_ABI,
    functionName: "modifyLiquidities",
    args: [unlockData, args.deadlineSec],
  });
}

export function encodeApproveCalldata(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
}

export const APPROVE_MAX = maxUint256;
