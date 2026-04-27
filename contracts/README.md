# MOAI Contracts

Smart contracts that gate the AI agent's actions on user funds.

## GuardedExecutorHook

Immutable whitelist of `(target, selector)` pairs. The agent (or any caller)
hits `execute(Call[])`; the contract reverts if any inner call's
`(target, selector)` is not in the whitelist set at deploy time.

Selectors that are NOT whitelisted (notably `ERC20.transfer` and
`ERC20.transferFrom` to arbitrary recipients) cannot pass the validator,
so the agent has no on-chain path to siphon funds out of the user's EOA.

## Setup

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
cp .env.example .env  # if you make one
```

## Common commands

```bash
# build
forge build

# test
forge test -vv

# deploy to Base
forge script script/DeployHook.s.sol --rpc-url base --broadcast --verify
```

## Whitelist seeded at deploy

The `DeployHook.s.sol` script seeds Base mainnet defaults:

| Target                  | Address                                        | Selector                              |
| ----------------------- | ---------------------------------------------- | ------------------------------------- |
| Uniswap PositionManager | `0x7c5f5a4bbd8fd63184577525326123b519429bdc`   | `modifyLiquidities(bytes,uint256)`    |
| UniversalRouter         | `0x6ff5693b99212da76ad316178a184ab56d299b43`   | `execute(bytes,bytes[],uint256)`      |
| Permit2                 | `0x000000000022D473030F116dDEE9F6B43aC78BA3`   | `permitTransferFrom(...)`             |

Edit the script to add / remove entries before broadcasting.

## Required env vars

```
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...                # deployer
BASESCAN_API_KEY=...             # for verify
```
