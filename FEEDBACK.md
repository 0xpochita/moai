# Builder Feedback — MOAI × Uniswap API & Developer Platform

This is an honest write-up of what it felt like to build MOAI on top of the Uniswap stack during the hackathon. We integrated the **Trading API**, the **Public GraphQL endpoint**, the **Uniswap v3 subgraph (via The Graph)**, the **v4 PositionManager directly on-chain**, and **Calibur (Uniswap's EIP-7702 singleton)**. Below is the unvarnished version: what worked, what hurt, and what would have saved us hours.

---

## TL;DR

| Topic | Verdict |
|---|---|
| Trading API quote/swap quality | Excellent. Worked first try once approvals were sorted. |
| Trading API DX | Good for the basics. No official TS SDK for the gateway endpoint hurt. |
| v4 PositionManager actions | Powerful, but the action enum values aren't easy to find. |
| Calibur (EIP-7702) | The biggest unlock of the entire stack. Also the most under-documented. |
| Public GraphQL | Reliable, permissionless, but undiscoverable. |
| The Graph subgraph for positions | Works. Subgraph ID discovery was a treasure hunt. |
| Overall | Building on Uniswap feels like building on real infrastructure. The friction is concentrated in *finding* the right primitive, not in *using* it. |

---

## What Worked Well

### 1. The Trading API actually delivers production-grade calldata
We pass user address, token in/out, amount, and slippage to `/quote` and `/swap`, and we get calldata that works against the Universal Router on the first try. No surprise reverts. The CLASSIC routing across V3 + V4 pools means we don't have to think about which version owns the best path — the API picks. For an agent that needs deterministic outcomes, this is exactly the right level of abstraction.

### 2. `check_approval` is a small endpoint that solves a big problem
Detecting whether a user has enough Permit2 allowance is a real pain to do manually. `/check_approval` returns either nothing (you're good) or the exact ERC20 approve calldata to splice into the batch. It's the kind of API that respects the developer's time.

### 3. Calibur as an EIP-7702 singleton is a 10x primitive
Once we understood the model, Calibur unlocked everything: agentic execution with no smart-account migration, no proxy custody, no upgrade ceremony. The user signs an EIP-712 envelope, and our keeper key gets scoped, time-bound, hook-validated execution rights against the user's own EOA. Nothing else on the market gets close.

### 4. Public GraphQL `topV4Pools` is a perfect "just works" endpoint
We get TVL, 24h volume, fee tier, and pool ID with one query, no API key, no rate-limit drama. Powering position cards with this was a 30-minute win.

### 5. v4 native pool semantics (`SWEEP`)
Once we understood that `BURN_POSITION + TAKE_PAIR + SWEEP` is the correct triplet for ETH-native pools, the encoder logic became clean and reusable. The action enum is genuinely well-designed — composable and gas-efficient.

---

## What Didn't Work / What Hurt

### 1. v4 action enum values are scattered
We initially encoded `TAKE_PAIR` as `0x10`. The PoolManager replied with `UnsupportedAction(0x5cda29d7)`. After half a day of debugging we discovered `0x10` is `TAKE_PORTION`, and the correct `TAKE_PAIR` value is `0x11`. The action ID list lives inside `v4-periphery/src/libraries/Actions.sol` but is not surfaced in any developer-facing docs portal. **A single page on docs.uniswap.org listing the action enum with hex values would have saved us 4–6 hours.**

### 2. `unlockCallback` revert messages are opaque
When we got `CurrencyNotSettled` for a native ETH pool, there was no breadcrumb trail back to "you're missing a SWEEP action." Most v4 docs assume ERC20-only pools. **A "Common v4 pitfalls" doc — especially around native ETH and unsettled deltas — would prevent a lot of pain.**

### 3. Calibur registration flow is essentially undocumented for relayer + agent-key patterns
Calibur is brilliant but the docs treat it as a self-signed user account. Building the **agent-key + relayer + EIP-712 SignedBatchedCall** flow required reading Calibur source code directly:
- The EIP-712 domain requires a `salt` field computed as `(prefix << 160) | implementation` — not obvious.
- The `register()` + `update(keyHash, settings)` pair must both run inside a single SignedBatchedCall signed by ROOT. Not obvious from the contract docs.
- `getSeq(nonceKey)` returns the next-valid sequence, but the relationship between `nonceKey` and parallel-execution streams is buried.
- `Settings` is a packed `uint256` with bit-shifts for `(isAdmin << 200) | (expiration40 << 160) | hookAddress`. Discovered by reading the contract.

**A "Calibur cookbook" with end-to-end TypeScript examples — register agent key → relayer pays gas → agent signs a batched call → execute on user EOA — would be the highest-leverage doc Uniswap could ship.**

### 4. viem's `signAuthorization` rejects JSON-RPC accounts
We spent hours on EIP-7702 self-delegation before realizing viem 2.48 only allows `signAuthorization` from local accounts (private key in process), not from injected wallets. We ended up abandoning self-delegation and relying on **Smart Wallet auto-delegation** (Uniswap Wallet, Coinbase Smart Wallet) to inject Calibur on first tx. Worked beautifully, but the failure mode was completely silent — viem just throws a generic "Account type 'json-rpc' is not supported" with no link to alternative patterns.

### 5. `wallet_sendCalls` (EIP-5792) doesn't compose with EIP-7702
Tried `wallet_sendCalls` to bundle approve + swap + deposit. Got "External calls to internal accounts cannot include data" — turns out EIP-5792 doesn't permit calls *from* an EOA *to* the same EOA when that EOA has 7702 delegation. Had to abandon this path and roll our own SignedBatchedCall via Calibur. **A clear note in the docs about EIP-5792 + EIP-7702 interaction would have prevented this rabbit hole.**

### 6. No official TypeScript SDK for the gateway Trading API
We typed every request and response by hand. The endpoints work fine, but every consumer is reinventing the same wrapper. **An `@uniswap/trading-api-sdk` package mirroring the gateway endpoints would massively reduce boilerplate.** Bonus points if it's tree-shakeable and ships from the same monorepo as the API.

### 7. Subgraph ID discovery is a treasure hunt
We needed the Uniswap v3 Base subgraph ID (`HMuAwufqZ1YCRmzL2SfHTVkzZovC9VL2UAKhjvRqKiR1`) to query positions. The Graph hosts it but the canonical "this is the official Uniswap subgraph" pointer isn't on docs.uniswap.org — we found it by reading other repos. **Either publish a registry of official subgraph IDs per chain, or ship a thin REST proxy on the gateway that abstracts it away.**

### 8. The "Indexing API" is mentioned but not findable
The track briefing implies an Indexing API exists, but we couldn't find a stable URL, schema, or example. We fell back to the v3 subgraph for position discovery. **If the Indexing API is the future of position queries, document it like the Trading API.**

### 9. No batched `/quote` for multi-token swaps
For our swarm-coordination concept (multiple users migrating at once), we'd want to send N `(tokenIn, amount)` pairs and get back one optimized aggregate route. Today we have to make N separate `/quote` calls — fine for one user, painful for batched coordination. **A `/quote/batch` endpoint would unlock multi-agent execution patterns.**

### 10. Gas estimation isn't served by Trading API
We had to manually cap gas at `1_500_000` for relayed Calibur calls because `eth_estimateGas` misbehaves on 7702-delegated EOAs (some RPCs estimate against the delegate, some against the EOA bytecode, results vary 3x). **A Uniswap Gas API that returns realistic gas for `UniversalRouter.execute(calldata)` — including 7702-delegation context — would be a huge win for relayer-based agents.**

---

## Bugs / Surprises We Hit

| # | Symptom | Root cause | Fix time |
|---|---|---|---|
| 1 | `UnsupportedAction(0x5cda29d7)` on v4 burn | We used `0x10` (`TAKE_PORTION`) instead of `0x11` (`TAKE_PAIR`) | ~5h |
| 2 | `CurrencyNotSettled` revert on ETH/USDC pool | Native pools require `SWEEP` (0x14) after `TAKE_PAIR` | ~2h |
| 3 | "Wallet not yet delegated to Calibur" toast even though user clearly delegated | We trusted local Zustand state instead of reading on-chain `eth_getCode` | ~1h |
| 4 | Revoke tx reverted on `update(agentKeyHash, 0)` | We tried to revoke a key that was never registered (stale local state) | ~30min |
| 5 | Migration tx submitted but BaseScan showed `failed` | EIP-712 domain `salt` field was missing from our typed-data | ~3h |
| 6 | Keeper drained ETH on every batched call | Relayer was forwarding `value: totalValue` instead of `value: 0n`; ETH should come from user's EOA balance under 7702 | ~1h |
| 7 | Image 301 redirects on `dd.dexscreener.com` (not Uniswap, but related to UI) | Next.js Image needs both source and redirect target whitelisted | ~30min |

---

## Docs Gaps (Top 5)

1. **v4 action enum reference** — single page listing `BURN_POSITION`, `TAKE_PAIR`, `SWEEP`, `MINT_POSITION`, etc. with hex values and minimal calldata examples
2. **Calibur cookbook** — end-to-end relayer + agent-key + SignedBatchedCall TypeScript example. The contract is shipped, the docs aren't.
3. **EIP-7702 + Smart Wallet interaction guide** — when does the Smart Wallet auto-delegate? What does the EOA's `eth_getCode` return? How do dApps detect this?
4. **Trading API + relayer pattern** — the docs assume the swapper signs the tx. For agentic flows, the *agent* signs. A note + example would unblock a whole class of builders.
5. **Subgraph + Indexing API canonical URLs per chain** — a single registry page

---

## Things We Wish Existed

In rough order of impact:

1. **`@uniswap/trading-api-sdk`** — official TS package wrapping `/check_approval`, `/quote`, `/swap` with full types. Ship it.
2. **Calibur cookbook + reference repo** — even a single GitHub example (Next.js + viem + relayer) would 10x the addressable builder base.
3. **`/quote/batch` endpoint** — accept N intents, return one optimized route. Foundation for agent-coordination products.
4. **Uniswap Gas API for Universal Router + 7702 contexts** — accurate estimation for relayed calls.
5. **Indexing API for positions** — first-party portfolio discovery, no need for subgraph fallback.
6. **v4 hook gallery** — code examples of common patterns: rebalance hooks, fee redirection, oracle hooks, agent-trigger hooks. Would be a primitive accelerator.
7. **`UnlockCallback` revert decoder** — a small published lookup table mapping the 4-byte revert selectors back to error names. Right now we have to manually `keccak256("UnsupportedAction(uint256)")[:4]` everything.
8. **EIP-7702 detection helper** — a one-liner viem helper that returns `{ delegated: true, target: "0x000…f00" }` when an EOA has Calibur bytecode. We rolled our own via `eth_getCode` parsing.
9. **API status page** — when Trading API has a hiccup it's invisible to consumers. A status.uniswap.org would help debugging.
10. **Postman / curl recipe pack** for every endpoint, with realistic Base mainnet payloads. Faster than reading prose.

---

## Suggestions to Help the Uniswap Developer Platform Grow

1. **Treat Calibur as a flagship primitive, not a footnote.** It is the killer app for agentic finance. Promote it on the docs landing page, ship a hosted relayer reference, ship code examples in 2–3 frameworks (viem, ethers, Foundry).

2. **Publish an "Agentic Patterns" doc series.** Cover: session keys, intent broadcasting, multi-user batching, hook-validated execution. The track explicitly asks for agentic finance — meet builders where they are with concrete recipes.

3. **One-stop Builder Console.** A single dashboard for: Trading API key, rate limits, request logs, sample requests, subgraph IDs per chain. Today these live in 4 different places.

4. **First-party TypeScript SDKs.** Trading API, Public GraphQL, Indexing API — all under `@uniswap/*`. Match the Stripe / Linear bar for DX.

5. **Composable patterns library.** Real production-grade snippets: "swap then deposit," "burn then re-LP," "batch many users into one tx," "hook-triggered swap." Each one should be copy-paste-runnable.

6. **Better revert observability.** Either decode `UnsupportedAction` and friends server-side in the API, or publish the lookup table publicly. Today every team rediscovers the same selectors.

7. **Treat hackathons as a feedback funnel.** This FEEDBACK.md has 30 specific items in it. If even 5 land in next quarter's docs roadmap, that's enormous compounding value for the next cohort.

---

## Closing Thoughts

Building on Uniswap feels like building on a power grid. The lights work. When they don't, it's because we plugged into the wrong outlet — not because the grid is broken. The Trading API's calldata-first design philosophy is exactly right for agents. Calibur is the most exciting account primitive shipped this year. The v4 action system is the cleanest LP API in the ecosystem.

The single biggest opportunity is **closing the docs gap between what you've shipped and what builders can find.** Calibur deserves the documentation budget of a flagship product because it functionally is one. Once that gap closes, the agent ecosystem on Uniswap will compound fast.

Thanks for the runway, the rails, and the prize pool. We're shipping MOAI on top of all three.

— Team MOAI
