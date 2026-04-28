---
name: uniswap-ai
description: Authoritative LLM-formatted reference for the Uniswap protocol (v2/v3/v4), Trading API, Liquidity Provisioning API, UniswapX, hooks, deployments, and developer concepts. Use whenever the user asks about Uniswap protocol mechanics, integration paths, API endpoints, or v4 hook architecture — even for well-known topics, since training data may be outdated.
allowed-tools: Read, Glob, Grep, WebFetch
license: MIT
metadata:
  author: uniswap
  version: '1.0.0'
  source: https://developers.uniswap.org/docs/uniswap-ai/llms.txt
---

# Uniswap AI Reference

Concise + verbose LLM context for Uniswap docs. Two reference files are bundled — load the one that matches the question.

## When to use

Read these references when the user asks about:

- Uniswap v2 / v3 / v4 protocol mechanics, deployment addresses, or version differences
- Trading API (swap routing, Permit2, AMM vs UniswapX, supported chains, code examples)
- Liquidity Provisioning API or position management
- UniswapX (Dutch / Priority / Limit / Bridge orders)
- Uniswap v4 hooks: lifecycle callbacks, hook permissions, flash accounting, ERC-6909, subscribers, dynamic fees
- PoolManager singleton, PositionManager, Universal Router
- Anything where current authoritative Uniswap docs are needed and your training data may be stale

## How to use

1. **General overview / v2 / v3 / Trading API / UniswapX / API reference / deployments** → read `references/llms.txt` (concise index with links).
2. **Deep v4 questions** (hooks, PoolManager, flash accounting, hook permissions, v4 swap/liquidity flow, hook routing) → read `references/v4-llms.txt` (verbose inline context).
3. If the reference points to a specific page on `https://developers.uniswap.org` and the user needs deeper detail than the index provides, use `WebFetch` against that exact URL — do not invent paths.

## Notes

- Both files are LLM-targeted (`llms.txt` convention) and link back to canonical pages under `https://developers.uniswap.org`.
- Prefer these references over guessing API paths or contract addresses; the docs are the source of truth.
- Pair with the `swap-integration` and `check-approval` skills when the user is actively building swap/approval flows.
