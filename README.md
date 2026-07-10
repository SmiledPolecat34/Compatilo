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
- **Sécurité** : PIN hashé (bcrypt) + HMAC indexé pour la recherche, verrouillage après 5 tentatives, rate-limit par IP, JWT (admin 12 h / participant 7 j), 2FA admin obligatoire (voir ci-dessous), Helmet, CORS restreint, validation backend systématique, identifiants non prévisibles (nanoid), Prisma (requêtes paramétrées).
- **2FA admin** : après le mot de passe, un code à 6 chiffres est requis (envoyé par e-mail, expire en 5 min, tentatives limitées, verrouillage 15 min). Une application TOTP (Google Authenticator, Authy...) peut remplacer l'e-mail. Un appareil peut être mémorisé (`TRUSTED_DEVICE_DAYS`, 30 jours par défaut) pour sauter le 2FA. Sans `SMTP_HOST` configuré, le code est journalisé dans les logs (pratique en développement).
- **Visibilité de l'identité** : chaque session choisit ce que l'invité voit de l'autre participant (prénom, surnom, les deux, ou anonyme) ; l'admin voit toujours les données réelles. Le calcul est fait côté serveur (`domain/identity.ts`), y compris le recalcul du résumé intelligent du rapport pour ne jamais laisser fuiter un nom masqué.
- **Musique** (`services/music/`) : module indépendant en pattern Provider — `storage.ts` (stockage des fichiers uploadés, abstrait pour migrer vers S3 en production), `youtube.ts` (métadonnées oEmbed officielles, aucune extraction de flux). Playlists, pistes, réglages globaux et affectation par session.
- **Versionnage des questionnaires** : une session pointe vers une version *publiée* immuable ; seuls les brouillons sont éditables. Le rapport stocke un instantané JSON complet → stable dans le temps.
- **Timeline** : chaque action importante est journalisée et horodatée par session.

### Frontend (`apps/web`)

- Mobile-first, compatible Safari iOS (dvh, `viewport-fit=cover`, `env(safe-area-inset-*)` sur toutes les zones fixes, inputs 16 px anti-zoom, `touch-action`).
- **Registre de types de questions** (`components/questions/registry.tsx`) : ajouter un type = un composant + une entrée, sans toucher au reste.
- Éditeur de questionnaire avec glisser-déposer (dnd-kit), sauvegarde automatique débouncée.
- Rapport premium : score animé, graphiques SVG, cartes de profil avec favoris, résumé intelligent, QR code, signatures tactiles (signature_pad), export PDF via impression native.
- **Module musique** (`src/music/`) : lecteur persistant monté hors des routes (jamais interrompu au changement de page), pattern Provider côté client aussi — `LocalAudioProvider` (élément `<audio>`) et `YouTubeProvider` (API IFrame officielle YouTube, lecteur visible conformément à l'usage prévu par la plateforme). File de lecture avec aléatoire/répétition, ajout de nouveaux providers (Spotify, Deezer...) sans toucher au reste de l'app.

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
- **Sauvegarde de la base** : stratégie et scripts documentés dans [`BACKUP.md`](BACKUP.md).
- **Sécurité** : audit OWASP Top 10 documenté dans [`SECURITY.md`](SECURITY.md).

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

## Thème clair / sombre

`src/theme/ThemeProvider.tsx` gère trois thèmes (`light`, `dark`, `custom` — un thème de démonstration "Coucher de soleil"), persistés en `localStorage` et appliqués via `[data-theme]` + variables CSS (`styles.css`). Le sélecteur est visible dans l'en-tête admin. Seule la coquille de l'app (fond, cartes, focus) est pilotée par ces variables ; les couleurs de contenu (Tailwind `text-slate-*`, `bg-brand-*`, etc.) restent fixes pour l'instant — étendre chaque composant au thème sombre est un travail de finition volontairement laissé pour plus tard.

## Monitoring & supervision

- **Health check** : `GET /api/health` (et `/health`) renvoie `{ status, database, version, uptimeSeconds }` ; teste la connexion PostgreSQL à chaque appel. Page dédiée : `/status`.
- **Logs serveur** : structurés via `pino` (JSON en production, lisible en développement), avec logs d'accès HTTP et erreurs API contextualisées (route, méthode, statut).
- **Erreurs front** : `ErrorBoundary` + gestionnaires `window.onerror`/`unhandledrejection` envoient les erreurs à `POST /api/public/client-errors`, journalisées côté serveur (pas de stockage en base).

## SEO & PWA

`index.html` inclut Open Graph, Twitter Card, et un `manifest.webmanifest` (icône, couleurs, mode `standalone`). **Avant mise en production**, remplacer les URLs relatives `og:image`/`twitter:image` par l'URL absolue du domaine final. Sur iPhone, l'app est installable depuis Safari (« Sur l'écran d'accueil ») en plein écran ; iOS génère automatiquement un écran de démarrage à partir de l'icône et de la couleur de thème (pas d'images de splash dédiées par appareil).

## Évolutions prévues par l'architecture

Nouveaux types de questions (registre frontend + `type`/`config` JSON en base), nouveaux questionnaires (multi-questionnaires natif), notifications temps réel (événements timeline déjà structurés), comparaison entre plusieurs rapports, thèmes supplémentaires (variables CSS déjà en place), nouveaux fournisseurs de musique (Spotify, Deezer, Apple Music, SoundCloud — pattern Provider déjà en place côté client et serveur).

## Limitations connues

- Le stockage des fichiers audio uploadés (`MUSIC_UPLOAD_DIR`) est local au disque du serveur. Sur le plan gratuit de Render, ce disque est **éphémère** (perdu au redéploiement). Pour la production, remplacer `LocalDiskStorage` (`apps/api/src/services/music/storage.ts`) par une implémentation S3/GCS respectant la même interface `StorageProvider` — aucun autre fichier n'a besoin de changer. Les pistes YouTube ne sont pas concernées (pas de fichier stocké).
- Le thème sombre ne couvre que la coquille de l'application (voir ci-dessus).
- Pas de service worker : l'app est installable (PWA « ready ») mais ne fonctionne pas hors ligne.
