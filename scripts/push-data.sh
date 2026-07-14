#!/bin/sh
set -eu

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

: "${SYNC_HOST:?SYNC_HOST is required}"
: "${SYNC_USER:?SYNC_USER is required}"
: "${SYNC_PATH:?SYNC_PATH is required}"

SYNC_PORT="${SYNC_PORT:-22}"
DB_PATH="${DB_PATH:-./data/wzt.db}"
MEDIA_DIR="${MEDIA_DIR:-./data/media}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE="$SYNC_USER@$SYNC_HOST"
SSH="ssh -p $SYNC_PORT"
RSYNC_RSH="ssh -p $SYNC_PORT"
TMP_DB="/tmp/wzt-$STAMP.db"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

sqlite3 "$DB_PATH" ".backup '$TMP_DB'"
$SSH "$REMOTE" "mkdir -p '$SYNC_PATH/data/media' '$SYNC_PATH/backups/$STAMP' && if [ -f '$SYNC_PATH/data/wzt.db' ]; then sqlite3 '$SYNC_PATH/data/wzt.db' \".backup '$SYNC_PATH/backups/$STAMP/wzt.db'\"; fi"
rsync -az -e "$RSYNC_RSH" "$TMP_DB" "$REMOTE:$SYNC_PATH/data/wzt.db"
rm -f "$TMP_DB"

if [ -d "$MEDIA_DIR" ]; then
  rsync -az --delete -e "$RSYNC_RSH" "$MEDIA_DIR/" "$REMOTE:$SYNC_PATH/data/media/"
fi

echo "Pushed data to $REMOTE:$SYNC_PATH"
