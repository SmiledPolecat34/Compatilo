#!/usr/bin/env bash
# Restauration PostgreSQL depuis un fichier produit par backup-db.sh.
#
# Usage :
#   DATABASE_URL="postgresql://..." ./scripts/restore-db.sh backups/compatilo-XXXXXXXX-XXXXXX.dump
#
# ATTENTION : --clean supprime les objets existants avant de les recréer.
# À utiliser sur une base cible que l'on accepte de remplacer entièrement
# (jamais directement sur la production sans avoir vérifié la sauvegarde
# sur un environnement de test au préalable).
set -euo pipefail

FILE="${1:?Usage: restore-db.sh <fichier.dump>}"

if [ ! -f "$FILE" ]; then
  echo "Fichier introuvable : $FILE" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Restauration de $FILE via DATABASE_URL"
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$FILE"
else
  echo "DATABASE_URL absent : restauration dans le conteneur Docker local"
  docker compose exec -T db pg_restore --clean --if-exists --no-owner --no-privileges -U compatilo -d compatilo < "$FILE"
fi

echo "Restauration terminée."
