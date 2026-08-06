#!/usr/bin/env bash
# Cursor hook: before gh pr create / git push, run secret scan off main.
# Reads hook JSON on stdin; prints permission JSON on stdout.

set -euo pipefail

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command") or "")' 2>/dev/null || true)"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

# Only gate PR create and pushes that look like publishing a branch
if [[ ! "$COMMAND" =~ gh[[:space:]]+pr[[:space:]]+create ]] && [[ ! "$COMMAND" =~ git[[:space:]]+push ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

if ! bash scripts/check-secrets.sh; then
  printf '%s\n' '{"permission":"deny","user_message":"Secret scan failed on this branch. Fix leaks (or see scripts/check-secrets.sh) before PR/push."}'
  exit 0
fi

echo '{"permission":"allow"}'
exit 0
