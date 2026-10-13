#!/usr/bin/env bash
# Run a subset of upstream vercel-labs/skills CI at the pinned SHA.
# Commands copied from vendor/skills/.github/workflows/ci.yml at
# 13e4063a1cf913f5606d57d42ab83a86f5001e04 (ubuntu-latest × Node 24 leg).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor/skills"
PIN="13e4063a1cf913f5606d57d42ab83a86f5001e04"

export DISABLE_TELEMETRY="${DISABLE_TELEMETRY:-1}"
export DO_NOT_TRACK="${DO_NOT_TRACK:-1}"
# pnpm may refuse to mutate node_modules without a TTY unless CI=true.
export CI="${CI:-true}"


if [[ ! -d "$VENDOR/.git" ]]; then
  bash "$ROOT/scripts/vendor-upstream.sh"
fi

HEAD="$(git -C "$VENDOR" rev-parse HEAD)"
if [[ "$HEAD" != "$PIN" ]]; then
  echo "vendor pin mismatch: expected $PIN got $HEAD" >&2
  exit 1
fi

cd "$VENDOR"

# Prefer a modern git on PATH (upstream tests need GIT_CONFIG_GLOBAL, Git ≥ 2.31).
if [[ -x /opt/homebrew/bin/git ]]; then
  export PATH="/opt/homebrew/bin:$PATH"
elif [[ -x /usr/local/opt/git/bin/git ]]; then
  export PATH="/usr/local/opt/git/bin:$PATH"
fi

GIT_VER="$(git --version | awk '{print $3}')"
echo "using $(command -v git) ($GIT_VER)"

# ci.yml L35
pnpm install --frozen-lockfile
# ci.yml L38
pnpm build
# ci.yml L42 (upstream runs format:check on ubuntu + Node 24 only)
pnpm format:check
# ci.yml L45
pnpm test
# ci.yml L67 (typecheck job, Node 24)
pnpm type-check

echo "upstream-skills.sh OK (Node $(node -v), pnpm $(pnpm -v), git $GIT_VER)"
