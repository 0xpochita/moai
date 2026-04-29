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
const V4_ACTION_DECREASE_LIQUIDITY = 0x01;
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

export interface HarvestV4Args {
  tokenId: bigint;
  currency0: Address;
  currency1: Address;
  recipient: Address;
  deadlineSec: bigint;
}

/// Encode a v4 fee-only harvest. Uses `DECREASE_LIQUIDITY(liquidity=0)` so
/// the position keeps its full liquidity but accrued fees are settled,
/// followed by `TAKE_PAIR` to pull both currencies. Native ETH pools also
/// need a trailing `SWEEP` to settle the native delta.
export function encodeV4HarvestCalldata(args: HarvestV4Args): Hex {
  const isNativePool =
    args.currency0.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
    args.currency1.toLowerCase() === ZERO_ADDRESS.toLowerCase();

  const actions = isNativePool
    ? [V4_ACTION_DECREASE_LIQUIDITY, V4_ACTION_TAKE_PAIR, V4_ACTION_SWEEP]
    : [V4_ACTION_DECREASE_LIQUIDITY, V4_ACTION_TAKE_PAIR];

  const actionsBytes = toHex(new Uint8Array(actions));

  // DECREASE_LIQUIDITY(uint256 tokenId, uint256 liquidity, uint128 amount0Min, uint128 amount1Min, bytes hookData)
  const decreaseParams = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint128" },
      { type: "uint128" },
      { type: "bytes" },
    ],
    [args.tokenId, 0n, 0n, 0n, "0x"],
  );

  const takePairParams = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }],
    [args.currency0, args.currency1, args.recipient],
  );

  const params: Hex[] = [decreaseParams, takePairParams];

  if (isNativePool) {
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

const V3_NPM_COLLECT_ABI = [
  {
    name: "collect",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount0Max", type: "uint128" },
          { name: "amount1Max", type: "uint128" },
        ],
      },
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
] as const;

const UINT128_MAX = (1n << 128n) - 1n;

export interface HarvestV3Args {
  tokenId: bigint;
  recipient: Address;
}

/// Encode a v3 NonfungiblePositionManager.collect() that pulls every
/// uncollected fee for the given tokenId to recipient.
export function encodeV3HarvestCalldata(args: HarvestV3Args): Hex {
  return encodeFunctionData({
    abi: V3_NPM_COLLECT_ABI,
    functionName: "collect",
    args: [
      {
        tokenId: args.tokenId,
        recipient: args.recipient,
        amount0Max: UINT128_MAX,
        amount1Max: UINT128_MAX,
      },
    ],
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
