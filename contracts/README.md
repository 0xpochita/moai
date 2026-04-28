# MOAI Contracts

Smart contracts that gate the AI agent's actions on user funds.

## GuardedExecutorHook

Immutable validator deployed once on Base mainnet. The agent (or any caller)
hits `execute(Call[])`; the contract reverts if any inner call doesn't pass
validation, so the user's EOA — which has the Hook bytecode via EIP-7702 —
cannot be made to do anything outside the rules below.

### Two parallel allow-lists

1. **`(target, selector)` whitelist** — for routine protocol calls
   (PositionManager.modifyLiquidities, UniversalRouter.execute,
   Permit2.permitTransferFrom, LiFiDiamond entrypoints).
2. **`spender` allow-list** — for `IERC20.approve(spender, amount)` and
   `Permit2.approve(token, spender, amount, expiration)`. Validates the
   *spender argument* parsed from calldata, not the target. Lets the
   agent approve any token to a known router (UniversalRouter / Permit2
   / Li.Fi diamond) without each token needing to be pre-listed, while
   blocking approvals to attacker-controlled spenders.

`ERC20.transfer` and `ERC20.transferFrom` selectors are NOT whitelisted,
so the agent has no on-chain path to siphon funds out of the user's EOA.

## Setup

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit  # one-time
```

## Common commands

```bash
forge build
forge test -vv
```

## Deployment runbook (Base mainnet)

### 1. Pre-flight

```bash
forge build && forge test               # all 13 tests must pass
git status                              # working tree clean
```

### 2. Set env

```bash
export PRIVATE_KEY=0x...                # deployer wallet — funded with ~0.005 ETH on Base
export BASE_RPC_URL=https://mainnet.base.org
export BASESCAN_API_KEY=...             # for --verify
```

`PRIVATE_KEY` should be a one-off deployer key, not your personal wallet.
Generate with `cast wallet new` and fund just enough for deployment gas.

### 3. Deploy + verify

```bash
forge script script/DeployHook.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Capture the line `GuardedExecutorHook deployed at: 0x...` from the output.

### 4. Pin the address everywhere

```bash
# in frontend/.env.local AND in Vercel project env (Production scope)
NEXT_PUBLIC_GUARDED_HOOK_ADDRESS=0x...
```

Also append the address + tx hash to `frontend/rules/research-notes.md` and
`frontend/rules/memory.md`.

### 5. Sanity-check on BaseScan

```bash
open https://basescan.org/address/0x...
```

Verify:
- Contract is verified (source visible).
- `deployer()` returns your deployer address.
- `allowed(POSITION_MANAGER_V4, MODIFY_LIQUIDITIES_SELECTOR)` returns `true`.
- `isAllowedSpender(PERMIT2)` returns `true`.

## Whitelist seeded at deploy

`(target, selector)` pairs:

| Target                  | Address                                        | Selector                                       |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Uniswap PositionManager | `0x7c5f5a4bbd8fd63184577525326123b519429bdc`   | `modifyLiquidities(bytes,uint256)`             |
| UniversalRouter         | `0x6ff5693b99212da76ad316178a184ab56d299b43`   | `execute(bytes,bytes[],uint256)` (with deadline) |
| UniversalRouter         | `0x6ff5693b99212da76ad316178a184ab56d299b43`   | `execute(bytes,bytes[])` (no deadline)         |
| Permit2                 | `0x000000000022D473030F116dDEE9F6B43aC78BA3`   | `permitTransferFrom(...)`                      |
| Li.Fi Diamond           | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`   | `swapTokensGeneric(...)`                       |
| Li.Fi Diamond           | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`   | `deposit(uint256,address)`                     |

Allowed `approve` spenders:

| Spender         | Address                                        |
| --------------- | ---------------------------------------------- |
| Permit2         | `0x000000000022D473030F116dDEE9F6B43aC78BA3`   |
| UniversalRouter | `0x6ff5693b99212da76ad316178a184ab56d299b43`   |
| Li.Fi Diamond   | `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`   |

Edit `DeployHook.s.sol` to add / remove entries before broadcasting.
The contract is **immutable** — to change the lists you must redeploy and
ask users to re-delegate.

## Required env vars

```
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...                # deployer
BASESCAN_API_KEY=...             # for verify
```
