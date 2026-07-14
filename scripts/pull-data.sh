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
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE="$SYNC_USER@$SYNC_HOST"
SSH="ssh -p $SYNC_PORT"
RSYNC_RSH="ssh -p $SYNC_PORT"

mkdir -p "$(dirname "$DB_PATH")" "$MEDIA_DIR" "$BACKUP_DIR/$STAMP"

if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/$STAMP/wzt.db'"
fi

$SSH "$REMOTE" "mkdir -p '$SYNC_PATH/backups/$STAMP' && sqlite3 '$SYNC_PATH/data/wzt.db' \".backup '$SYNC_PATH/backups/$STAMP/wzt.db'\""
rsync -az --delete -e "$RSYNC_RSH" "$REMOTE:$SYNC_PATH/backups/$STAMP/wzt.db" "$DB_PATH"
rsync -az --delete -e "$RSYNC_RSH" "$REMOTE:$SYNC_PATH/data/media/" "$MEDIA_DIR/"

echo "Pulled data from $REMOTE:$SYNC_PATH"
