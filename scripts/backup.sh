#!/bin/sh
set -eu

DB_PATH="${DB_PATH:-./data/wzt.db}"
MEDIA_DIR="${MEDIA_DIR:-./data/media}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/$STAMP"

mkdir -p "$DEST"
sqlite3 "$DB_PATH" ".backup '$DEST/wzt.db'"
if [ -d "$MEDIA_DIR" ]; then
  tar -czf "$DEST/media.tar.gz" -C "$MEDIA_DIR" .
fi
echo "Backup written to $DEST"

