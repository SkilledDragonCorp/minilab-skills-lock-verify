#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS="${GITLEAKS_BIN:-}"

if [[ -z "$GITLEAKS" ]]; then
  if [[ -x "$ROOT/tools/gitleaks" ]]; then
    GITLEAKS="$ROOT/tools/gitleaks"
  elif command -v gitleaks >/dev/null 2>&1; then
    GITLEAKS="$(command -v gitleaks)"
  else
    echo "gitleaks not found; install to PATH or run CI. Skipping local gitleaks."
    exit 0
  fi
fi

exec "$GITLEAKS" detect --source "$ROOT" --redact --verbose --no-banner
