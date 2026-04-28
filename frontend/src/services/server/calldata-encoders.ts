import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  maxUint256,
  toHex,
} from "viem";

// Uniswap v4 Actions (from v4-periphery/src/libraries/Actions.sol).
// Wrong values here silently fail with `UnsupportedAction` /
// `CurrencyNotSettled` reverts inside PositionManager.unlockCallback.
const V4_ACTION_BURN_POSITION = 0x03;
const V4_ACTION_TAKE_PAIR = 0x11;
const V4_ACTION_SWEEP = 0x14;

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

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
  const isNativePool =
    args.currency0.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    args.currency1.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  // For native ETH pools the PoolManager keeps the dust delta unsettled
  // unless we SWEEP after TAKE_PAIR. Without SWEEP the unlockCallback
  // reverts with `CurrencyNotSettled`.
  const actions = isNativePool
    ? [V4_ACTION_BURN_POSITION, V4_ACTION_TAKE_PAIR, V4_ACTION_SWEEP]
    : [V4_ACTION_BURN_POSITION, V4_ACTION_TAKE_PAIR];

  const actionsBytes = toHex(new Uint8Array(actions));

  // BURN_POSITION(uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData)
  const burnParams = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [args.tokenId, 0n, 0n, "0x"],
  );

  // TAKE_PAIR(address currency0, address currency1, address recipient)
  const takePairParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [args.currency0, args.currency1, args.recipient],
  );

  const params: Hex[] = [burnParams, takePairParams];

  if (isNativePool) {
    // SWEEP(address currency, address recipient) — sweep the native side
    // explicitly. Other side is already handled by TAKE_PAIR.
    const nativeCurrency =
      args.currency0.toLowerCase() === ZERO_ADDRESS.toLowerCase()
        ? args.currency0
        : args.currency1;
    const sweepParams = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }],
      [nativeCurrency, args.recipient],
    );
    params.push(sweepParams);
  }

  const unlockData = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }],
    [actionsBytes, params],
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
