#!/usr/bin/env bash
set -euo pipefail

printf "New admin password (at least 12 characters): "
IFS= read -r -s password
printf "\nConfirm admin password: "
IFS= read -r -s confirmation
printf "\n"

if [[ "$password" != "$confirmation" ]]; then
  echo "Passwords do not match." >&2
  exit 1
fi

if (( ${#password} < 12 )); then
  echo "Password must contain at least 12 characters." >&2
  exit 1
fi

hash="$(printf "%s" "$password" | node ./scripts/hash-password.mjs --stdin)"
unset password confirmation
printf "%s" "$hash" | CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false ./node_modules/.bin/wrangler secret put ADMIN_PASSWORD_HASH
CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false ./node_modules/.bin/wrangler d1 execute DB --remote --command="UPDATE users SET password_hash = '$hash' WHERE username = 'admin'; DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username = 'admin');"
unset hash
