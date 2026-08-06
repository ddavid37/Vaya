#!/usr/bin/env bash
# Secret leak check for feature branches / before PRs. No-op on main.
# Usage: npm run check:secrets
#        ./scripts/check-secrets.sh
#        FORCE=1 ./scripts/check-secrets.sh   # run even on main (CI / debug)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [[ -z "$BRANCH" || "$BRANCH" == "HEAD" ]]; then
  BRANCH="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-}}"
fi

if [[ "${FORCE:-}" != "1" && ( "$BRANCH" == "main" || "$BRANCH" == "master" ) ]]; then
  echo "check-secrets: on ${BRANCH:-unknown} — skip (only runs off main)."
  exit 0
fi

echo "check-secrets: scanning branch '${BRANCH:-unknown}' (not main)…"

TRACKED_BAD=0
while IFS= read -r f; do
  case "$f" in
    .env|.env.*|*.pem|*.p12|credentials.json|service-account*.json)
      echo "FAIL: tracked secret-like path: $f"
      TRACKED_BAD=1
      ;;
  esac
done < <(git ls-files)

if [[ "$TRACKED_BAD" -ne 0 ]]; then
  exit 1
fi

BASE="main"
if git rev-parse --verify "origin/main" >/dev/null 2>&1; then
  BASE="origin/main"
elif ! git rev-parse --verify "main" >/dev/null 2>&1; then
  BASE=""
fi

FILES=()
if [[ -n "$BASE" ]]; then
  while IFS= read -r f; do
    [[ -n "$f" ]] && FILES+=("$f")
  done < <(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" HEAD)
else
  while IFS= read -r f; do
    [[ -n "$f" ]] && FILES+=("$f")
  done < <(git ls-files)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "check-secrets: no changed files vs ${BASE:-tree} — ok."
  exit 0
fi

PATTERNS=(
  'BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY'
  'AKIA[0-9A-Z]{16}'
  'ASIA[0-9A-Z]{16}'
  'sk-[a-zA-Z0-9]{20,}'
  'sk-proj-[a-zA-Z0-9_-]{20,}'
  'ghp_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9_]{20,}'
  'xox[baprs]-[a-zA-Z0-9-]{10,}'
  'AIza[0-9A-Za-z_-]{35}'
  '-----BEGIN CERTIFICATE-----'
  'postgres(ql)?://[^[:space:]]+:[^[:space:]]+@'
  'mysql://[^[:space:]]+:[^[:space:]]+@'
  'mongodb(\+srv)?://[^[:space:]]+:[^[:space:]]+@'
  'DATABASE_URL[[:space:]]*=[[:space:]]*["'\'']?postgres'
  'AUTH_SECRET[[:space:]]*=[[:space:]]*["'\''][^"'\'']{8,}'
  'OPENAI_API_KEY[[:space:]]*=[[:space:]]*["'\'']?sk-'
  'GOOGLE_CLIENT_SECRET[[:space:]]*=[[:space:]]*["'\''][^"'\'']{6,}'
  'NEXTAUTH_SECRET[[:space:]]*=[[:space:]]*["'\''][^"'\'']{8,}'
)

HIT=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  case "$f" in
    package-lock.json|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.woff*|*.pdf|*.svg) continue ;;
  esac

  for pat in "${PATTERNS[@]}"; do
    if grep -EIn -- "$pat" "$f" >/dev/null 2>&1; then
      echo "FAIL: pattern /$pat/ in $f"
      grep -EIn -- "$pat" "$f" | head -n 5 | sed 's/^/  /'
      HIT=1
    fi
  done
done

if [[ "$HIT" -ne 0 ]]; then
  echo "check-secrets: potential secrets found. Remove them before opening a PR."
  exit 1
fi

echo "check-secrets: ok (${#FILES[@]} file(s) scanned)."
exit 0
