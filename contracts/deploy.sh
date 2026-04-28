#!/usr/bin/env bash
# Deploy GuardedExecutorHook to Base mainnet (or Sepolia with --sepolia).
#
# Usage:
#   ./deploy.sh              # deploy to Base mainnet
#   ./deploy.sh --sepolia    # deploy to Base Sepolia (testnet rehearsal)
#   ./deploy.sh --dry-run    # simulate without broadcasting (no funds spent)
#
# Reads PRIVATE_KEY, BASE_RPC_URL / BASE_SEPOLIA_RPC_URL, and BASESCAN_API_KEY
# from .env (gitignored). Will refuse to run if .env is missing.

set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=""
for candidate in .env.local .env; do
  if [ -f "$candidate" ]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [ -z "$ENV_FILE" ]; then
  echo "✗ contracts/.env or contracts/.env.local not found"
  echo "  Copy .env.example → .env.local and fill in your deployer key + RPC + Basescan API key."
  exit 1
fi

echo "→ Using env file: $ENV_FILE"

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [ -z "${PRIVATE_KEY:-}" ] || [ "$PRIVATE_KEY" = "0x_64_hex_chars_here" ]; then
  echo "✗ PRIVATE_KEY is empty or still the placeholder. Edit contracts/.env."
  exit 1
fi

NETWORK="base"
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"
BROADCAST="--broadcast"
VERIFY="--verify --etherscan-api-key ${BASESCAN_API_KEY:-}"

for arg in "$@"; do
  case "$arg" in
    --sepolia)
      NETWORK="base-sepolia"
      RPC="${BASE_SEPOLIA_RPC_URL:-https://sepolia.base.org}"
      ;;
    --dry-run)
      BROADCAST=""
      VERIFY=""
      ;;
    *)
      echo "✗ Unknown arg: $arg"
      echo "  Allowed: --sepolia, --dry-run"
      exit 1
      ;;
  esac
done

echo "→ Deploying GuardedExecutorHook"
echo "  network : $NETWORK"
echo "  rpc     : $RPC"
echo "  mode    : ${BROADCAST:+broadcast}${BROADCAST:-dry-run}${VERIFY:+ + verify}"
echo

# Pre-flight: tests must pass.
forge test >/dev/null
echo "✓ forge test passes"

# shellcheck disable=SC2086
forge script script/DeployHook.s.sol \
  --rpc-url "$RPC" \
  $BROADCAST \
  $VERIFY

echo
echo "✓ done. Copy the deployed address into:"
echo "    frontend/.env.local   →  NEXT_PUBLIC_GUARDED_HOOK_ADDRESS=0x..."
echo "    Vercel env (Production) →  same key, same value"
