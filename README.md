# Compatilo 💜

Application web permettant à deux personnes de répondre à un questionnaire privé, de découvrir leur compatibilité et de recevoir un rapport personnalisé exportable en PDF.

## Architecture

Monorepo npm workspaces :

```
apps/
  api/   Backend Node.js + Express + TypeScript + Prisma (PostgreSQL)
  web/   Frontend React + TypeScript + Vite + TailwindCSS
```

### Backend (`apps/api`)

- **Express** en couches : `routes/` (HTTP + validation Zod) → `services/` (logique métier) → `domain/` (règles pures, ex. calcul de compatibilité) → Prisma.
- **Sécurité** : PIN hashé (bcrypt) + HMAC indexé pour la recherche, verrouillage après 5 tentatives, rate-limit par IP, JWT (admin 12 h / participant 7 j), Helmet, CORS restreint, validation backend systématique, identifiants non prévisibles (nanoid), Prisma (requêtes paramétrées).
- **Versionnage des questionnaires** : une session pointe vers une version *publiée* immuable ; seuls les brouillons sont éditables. Le rapport stocke un instantané JSON complet → stable dans le temps.
- **Timeline** : chaque action importante est journalisée et horodatée par session.

### Frontend (`apps/web`)

- Mobile-first, compatible Safari iOS (dvh, `viewport-fit=cover`, inputs 16 px anti-zoom, `touch-action`).
- **Registre de types de questions** (`components/questions/registry.tsx`) : ajouter un type = un composant + une entrée, sans toucher au reste.
- Éditeur de questionnaire avec glisser-déposer (dnd-kit), sauvegarde automatique débouncée.
- Rapport premium : score animé, graphiques SVG, cartes de profil avec favoris, résumé intelligent, QR code, signatures tactiles (signature_pad), export PDF via impression native.

## Démarrage local

Prérequis : Node ≥ 20, Docker.

```bash
npm install
docker compose up -d                        # PostgreSQL 16
cp apps/api/.env.example apps/api/.env      # puis renseigner les valeurs
npm run db:migrate                          # migrations + seed (admin + questionnaire v1)
npm run dev:api                             # http://localhost:4000
npm run dev:web                             # http://localhost:5173 (proxy /api → 4000)
```

Panel admin : `http://localhost:5173/admin/login` (identifiants du `.env`).

## Tests de bout en bout

Un script E2E couvre tout le parcours (auth, sessions, PIN, réponses, favoris, rapport, signatures, timeline, recherche, éditeur, sécurité). Il est dans l'historique du projet et peut être rejoué contre une base jetable.

## Déploiement

- **Frontend → Netlify** : configuration dans `netlify.toml`. Définir `VITE_API_URL` (URL Render).
- **Backend → Render** : blueprint `render.yaml` (service web + PostgreSQL). Définir `WEB_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` ; `JWT_SECRET` et `PIN_PEPPER` sont générés. Les migrations s'appliquent au démarrage, l'admin et le questionnaire par défaut sont créés automatiquement (bootstrap idempotent).

## Modèle de compatibilité

| Réponses            | Résultat              |
| ------------------- | --------------------- |
| Oui / Oui           | Compatible            |
| Possible / Possible | Compatible            |
| Non / Non           | Compatible            |
| Oui / Possible      | Compatible partielle  |
| Non / Possible      | Compatible partielle  |
| Oui / Non           | Différence            |

Score = (compatibles × 1 + partielles × 0,5) / questions comparées.

## Évolutions prévues par l'architecture

Nouveaux types de questions (registre frontend + `type`/`config` JSON en base), nouveaux questionnaires (multi-questionnaires natif), notifications temps réel (événements timeline déjà structurés), statistiques (données normalisées), thèmes (design tokens Tailwind v4 dans `styles.css`).
