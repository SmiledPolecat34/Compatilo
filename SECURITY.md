# Sécurité — Compatilo

Audit relatif à l'[OWASP Top 10 (2021)](https://owasp.org/Top10/), tenu à jour à chaque évolution sensible du code.

## A01 — Broken Access Control

- Trois niveaux d'accès stricts : public (`/api/public/*`), participant (`requireParticipant`), admin (`requireAdmin`). Aucune route ne mélange les niveaux.
- Un participant ne peut agir que sur **sa propre** session/ses propres réponses (le `sessionId`/`participantId` vient du JWT, jamais d'un paramètre client modifiable).
- Les coordonnées GPS ne sont jamais renvoyées par les routes publiques, uniquement par les routes admin.
- Une session `CLOSED` verrouille toute écriture participant (réponses, favoris, signature, nouveaux arrivants), indépendamment du réglage `reportAccessEnabled` qui ne gouverne que la lecture.
- Un questionnaire `PUBLISHED` n'est plus modifiable (seuls les brouillons le sont) : une session ne peut pas voir son contenu changer rétroactivement.

## A02 — Cryptographic Failures

- PIN et mots de passe hashés avec bcrypt (coût 12). Le PIN est de plus indexé via HMAC-SHA256 (`PIN_PEPPER`) pour permettre la recherche sans jamais le stocker en clair.
- JWT signés (`JWT_SECRET`, ≥ 16 caractères imposés par la validation d'environnement) ; secrets distincts pour signature (`JWT_SECRET`) et indexation du PIN (`PIN_PEPPER`).
- Jeton "appareil de confiance" : seul un hash SHA-256 est stocké côté serveur, jamais le jeton lui-même.
- HTTPS imposé en production par la plateforme d'hébergement (Render/Netlify) ; cookies `secure` en production.

## A03 — Injection

- 100 % des requêtes base de données passent par Prisma (requêtes paramétrées) — aucune requête SQL brute concaténée.
- Toutes les entrées HTTP sont validées par des schémas Zod avant tout traitement (`middleware/validate.ts`), avec rejet explicite (400) en cas d'échec.
- Upload de fichiers audio : liste blanche d'extensions/MIME (mp3/wav/ogg), taille plafonnée, nom de fichier généré côté serveur (jamais dérivé du nom fourni par le client) → pas de traversée de chemin possible.

## A04 — Insecure Design

- Versionnage immuable des questionnaires : une session pointe vers une version publiée figée, le rapport stocke un instantané complet.
- Verrouillage progressif après échecs répétés (PIN, mot de passe admin, code 2FA) avec fenêtres de temps dédiées, plus rate-limiting par IP en défense en profondeur.
- Statut de session `CLOSED` : mécanisme explicite empêchant toute altération d'un rapport une fois la session finalisée par l'admin.

## A05 — Security Misconfiguration

- `helmet()` actif sur toute l'API (en-têtes de sécurité par défaut).
- CORS restreint à `WEB_ORIGIN` (pas de wildcard `*`).
- Erreurs détaillées uniquement en développement (`NODE_ENV`) ; message générique en production (`middleware/errorHandler.ts`).
- Fichiers audio servis avec `Cross-Origin-Resource-Policy: cross-origin` explicite (nécessaire pour le cross-origin front/API), mais rien d'autre n'est exposé statiquement.

## A06 — Vulnerable and Outdated Components

- `multer` maintenu en v2 (la v1 comporte des CVE connues), `otplib` en v13 (v12 est dépréciée). Dépendances revues à chaque ajout.

## A07 — Identification and Authentication Failures

- 2FA obligatoire pour l'admin (code e-mail à 6 chiffres, 5 min, ou TOTP), verrouillage après 5 tentatives.
- Jetons **jamais stockés en cookie pour l'authentification** (voir A08) : uniquement in-memory / `sessionStorage` côté client, envoyés via `Authorization: Bearer`.
- `tokenVersion` sur `Admin` : une action « déconnexion de tous les appareils » invalide instantanément tous les jetons déjà émis (révocation), et un endpoint `/refresh` permet la rotation sans repasser par le mot de passe.

## A08 — Software and Data Integrity Failures / CSRF

- **CSRF** : l'ancien cookie d'authentification admin (`compatilo_admin`) a été supprimé. L'unique mécanisme d'authentification aux données est un jeton `Authorization: Bearer`, jamais attaché automatiquement par le navigateur à une requête cross-site forgée — immunité CSRF de fait pour toutes les routes de données.
- Le seul cookie restant (`compatilo_trusted_device`) ne fait que sauter le défi 2FA sur un login où le mot de passe a **déjà** été vérifié : une requête forgée exploitant ce cookie ne suffit donc jamais, seule, à accéder à des données.

## A09 — Security Logging and Monitoring Failures

- Timeline horodatée par session pour les actions fonctionnelles (création, réponses, signatures, ouverture/fermeture...).
- Logs serveur structurés (`pino`) avec identifiant de requête ; erreurs API journalisées avec contexte (route, méthode, statut).
- Erreurs front capturées (`ErrorBoundary` + gestionnaires globaux) et envoyées à `/api/public/client-errors` pour visibilité côté serveur.
- Endpoint et page `Health Check` exposant l'état de l'API et de la base de données.

## A10 — Server-Side Request Forgery (SSRF)

- Le seul appel réseau sortant piloté par une entrée utilisateur est la récupération de métadonnées YouTube (`services/music/youtube.ts`) : l'URL est d'abord réduite à un identifiant de vidéo par expression régulière, puis reconstruite intégralement côté serveur vers `www.youtube.com` uniquement — aucune URL arbitraire fournie par l'utilisateur n'est jamais transmise telle quelle à `fetch`.

## Limitations connues / axes d'amélioration

- Le stockage des fichiers audio est local au disque (éphémère sur Render gratuit) — voir `README.md`.
- Pas de WAF/anti-bot dédié en amont de l'API (au-delà du rate-limiting applicatif).
- Le secret TOTP est stocké en clair en base (chiffrement au repos recommandé avant une mise à l'échelle multi-admin).
