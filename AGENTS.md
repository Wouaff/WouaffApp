# Instructions pour les agents IA (AGENTS.md)

Ces règles s'appliquent à toute modification de ce dépôt par un agent IA.

## 🚨 RÈGLE N°1 — JAMAIIS hardcoder des secrets / données du `.env`

- **Interdit** de mettre en dur dans le code source : clés API, tokens, URLs de webhooks, mots de passe, identifiants SMTP/Firebase/Discord, etc.
- Les secrets doivent être lus **uniquement** depuis les variables d'environnement (`process.env.X`) ou le fichier `.env` (qui est gitignoré).
- Pas de valeur de repli (fallback) en dur pour un secret : si la variable d'env n'est pas définie, le code doit se comporter sans le secret (retour anticipé, message clair), jamais l'inventer.
- Ne jamais logger, renvoyer dans une réponse API, ni committer une valeur secrète, même dans un commentaire.
- Si une valeur sensible apparaît dans une requête/réponse DTO, c'est un bug de sécurité — la retirer immédiatement (ex. `email`, `passwordHash`, `publicKey` ne doivent pas fuiter).

Exemples de configuration par variables d'environnement : `server/src/services/mailer.ts` (SMTP_*) et `server/src/config/captcha.ts` (CAP_*). Voir `server/.env.example`.

## Règles générales

- Respecter les conventions du projet : React + TypeScript (client) / Express + MySQL (server), Tailwind + CSS variables, lucide-react.
- Toujours lancer après modification : `npm run lint` (repo root), `npx tsc -b` (client), `npx tsc --noEmit` (server).
- Ne pas supprimer de fonctionnalité existante ; préférer des changements ciblés et réutiliser les composants/hooks/services déjà présents.
- Le rendu desktop (colonnes, ≥ 768px) et le rendu mobile (barre de navigation basse, < 768px) coexistent : ne pas casser l'un en modifiant l'autre.
- Un chemin d'upload (`/uploads/...`) est la seule URL de média acceptée côté serveur ; une URL de site web n'est acceptée qu'en http(s). Ne pas assouplir ces validations.
