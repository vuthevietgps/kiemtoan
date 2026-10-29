#!/usr/bin/env bash
# Back up the PostgreSQL database of a compose.app.yml stack, keeping the last N days.
#   ./deploy/backup-db.sh <stack-dir> <compose-project> [keep-days=14]
# Nightly cron at 02:30:
#   30 2 * * * $HOME/vsademo-smarterp-vn/deploy/backup-db.sh $HOME/vsademo-smarterp-vn vsademo-smarterp-vn >> $HOME/vsademo-smarterp-vn/backups/backup.log 2>&1
set -euo pipefail

DIR=${1:?Missing stack dir}
PROJECT=${2:?Missing compose project}
KEEP=${3:-14}
DC=${DOCKER_COMPOSE:-/usr/local/bin/docker-compose}

mkdir -p "$DIR/backups"
cd "$DIR"
C=$($DC --env-file .env.app -p "$PROJECT" -f compose.app.yml ps -q database)
[ -n "$C" ] || { echo "$(date '+%F %T') database container of $PROJECT not found" >&2; exit 1; }

OUT="$DIR/backups/db-$(date +%F-%H%M).sql.gz"
docker exec "$C" pg_dump -U app appdb | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
find "$DIR/backups" -name 'db-*.sql.gz' -mtime +"$KEEP" -delete
echo "$(date '+%F %T') backed up $(du -h "$OUT" | cut -f1) -> $OUT"
