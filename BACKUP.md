# Sauvegarde & restauration — PostgreSQL

Stratégie de sauvegarde de la base Compatilo, en développement comme en production.

## Ce qui est sauvegardé vs versionné

| Élément | Où | Mécanisme |
| --- | --- | --- |
| Schéma de la base (structure des tables) | `apps/api/prisma/migrations/` | Versionné dans Git, rejoué avec `prisma migrate deploy` |
| Données (sessions, réponses, rapports, comptes...) | Base PostgreSQL | **Sauvegardes `pg_dump` décrites ici** |
| Fichiers audio uploadés | Disque local de l'API | Voir la limitation dans `README.md` — hors périmètre de ce document |

Ne jamais confondre les deux : rejouer les migrations ne restaure aucune donnée, et une sauvegarde de données ne remplace pas l'historique de migrations.

## Sauvegarde manuelle

```bash
# Développement (base dans Docker, via docker-compose.yml)
./scripts/backup-db.sh

# Production / staging (URL de connexion externe copiée depuis Render)
DATABASE_URL="postgresql://...@...render.com/compatilo" ./scripts/backup-db.sh
```

Produit un fichier `backups/compatilo-AAAAMMJJ-HHMMSS.dump` (format `pg_dump --format=custom`, compressé, indépendant de la plateforme). Les 14 sauvegardes locales les plus récentes sont conservées, les plus anciennes sont supprimées automatiquement par le script.

## Restauration

```bash
DATABASE_URL="postgresql://..." ./scripts/restore-db.sh backups/compatilo-20260710-120000.dump
```

**Avant de restaurer sur un environnement partagé :**
1. Vérifier la sauvegarde sur une base de test (`docker compose up -d` avec un volume vierge).
2. Confirmer que le fichier correspond bien à la date attendue.
3. Informer les personnes concernées : `--clean` supprime les données existantes avant de recréer.

## Automatisation recommandée

### Render (production)

- Les plans PostgreSQL payants de Render incluent des sauvegardes automatiques quotidiennes avec restauration point-in-time depuis le tableau de bord (Render Dashboard → base de données → *Backups*). C'est la première ligne de défense, sans configuration côté code.
- En complément (recommandé pour la portabilité et un site de secours hors Render), planifier `backup-db.sh` avec l'URL externe de la base et envoyer le résultat vers un stockage objet (S3, GCS...). Exemple de workflow GitHub Actions (à adapter, non activé par défaut dans ce dépôt) :

```yaml
# .github/workflows/backup-db.yml
name: Sauvegarde quotidienne
on:
  schedule:
    - cron: '0 3 * * *' # 03h00 UTC chaque jour
  workflow_dispatch: {}
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sauvegarde et upload S3
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          sudo apt-get install -y postgresql-client
          ./scripts/backup-db.sh
          aws s3 cp backups/*.dump s3://mon-bucket/compatilo/ --sse AES256
```

### Développement local

Un simple rappel périodique (aucune automatisation requise) : lancer `./scripts/backup-db.sh` avant toute opération risquée (migration destructive, script de nettoyage de données, montée de version majeure de Prisma).

## Objectifs de reprise

- **RPO (perte de données maximale tolérée)** : 24 h avec les sauvegardes quotidiennes Render ; réductible à quelques minutes avec la restauration point-in-time de Render sur les plans payants.
- **RTO (délai de restauration)** : de l'ordre de quelques minutes pour un `pg_restore` sur une base de taille modeste (le volume de données de Compatilo — sessions, réponses, rapports — reste léger).

## Procédure de test de restauration (à exécuter périodiquement)

1. `./scripts/backup-db.sh` sur la production (ou utiliser une sauvegarde Render existante).
2. Démarrer une base PostgreSQL vierge (`docker compose -f docker-compose.yml up -d` avec un nouveau volume, ou une base Render de staging).
3. `./scripts/restore-db.sh <fichier>` vers cette base de test.
4. Lancer l'API contre cette base (`DATABASE_URL` pointant vers le test) et vérifier `GET /api/health` → `database: "UP"`, puis contrôler que le tableau de bord admin affiche les sessions attendues.
5. Documenter la durée totale de l'exercice — c'est la mesure réelle du RTO.
