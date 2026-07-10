#!/usr/bin/env bash
# Sauvegarde PostgreSQL (format custom pg_dump, compressé).
#
# Usage :
#   DATABASE_URL="postgresql://..." ./scripts/backup-db.sh [dossier_sortie]
#
# En développement (base dans Docker), sans DATABASE_URL fourni, le script
# se rabat automatiquement sur le conteneur `compatilo-db` du docker-compose.
set -euo pipefail

OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$OUT_DIR/compatilo-$STAMP.dump"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Sauvegarde via DATABASE_URL vers $FILE"
  pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$FILE"
else
  echo "DATABASE_URL absent : sauvegarde du conteneur Docker local vers $FILE"
  docker compose exec -T db pg_dump --format=custom --no-owner --no-privileges -U compatilo compatilo > "$FILE"
fi

echo "OK : $FILE ($(du -h "$FILE" | cut -f1))"

# Rétention : ne garde que les 14 dernières sauvegardes locales
ls -1t "$OUT_DIR"/compatilo-*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
