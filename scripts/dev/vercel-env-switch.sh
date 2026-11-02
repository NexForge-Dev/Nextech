#!/usr/bin/env bash
# One-off: point the Vercel project (team nex-forge5) at the new Supabase project and the real site URL.
# Values come from ./.env.local; nothing is printed. Usage (from the nextech folder):
#   bash scripts/dev/vercel-env-switch.sh https://nextech-one-beta.vercel.app
set -euo pipefail
SITE_URL="${1:?usage: $0 <https://site-url-without-trailing-slash>}"
SCOPE="nex-forge5"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
( cd "$TMP" && npx vercel link --yes --project nextech --scope "$SCOPE" >/dev/null )

val() { grep -E "^$1=" .env.local | cut -d= -f2-; }

set_var() { # name value
  for env in production preview; do
    ( cd "$TMP" && npx vercel env rm "$1" "$env" --yes --scope "$SCOPE" >/dev/null 2>&1 || true )
    printf '%s' "$2" | ( cd "$TMP" && npx vercel env add "$1" "$env" --scope "$SCOPE" >/dev/null )
    echo "set $1 ($env)"
  done
}

set_var NEXT_PUBLIC_SUPABASE_URL "$(val NEXT_PUBLIC_SUPABASE_URL)"
set_var NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$(val NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
set_var SUPABASE_SERVICE_ROLE_KEY "$(val SUPABASE_SERVICE_ROLE_KEY)"
set_var NEXT_PUBLIC_SITE_URL "${SITE_URL%/}"
echo "Done. Takes effect on the next deployment."
