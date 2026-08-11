# Instructions pour les agents IA (AGENTS.md)

Ces règles s'appliquent à toute modification de ce dépôt par un agent IA.

## 🚨 RÈGLE N°1 — JAMAIIS hardcoder des secrets / données du `.env`

- **Interdit** de mettre en dur dans le code source : clés API, tokens, URLs de webhooks, mots de passe, identifiants SMTP/Firebase/Discord, etc.
- Les secrets doivent être lus **uniquement** depuis les variables d'environnement (`process.env.X`) ou le fichier `.env` (qui est gitignoré).
- Pas de valeur de repli (fallback) en dur pour un secret : si la variable d'env n'est pas définie, le code doit se comporter sans le secret (retour anticipé, message clair), jamais l'inventer.
- Ne jamais logger, renvoyer dans une réponse API, ni committer une valeur secrète, même dans un commentaire.
- Si une valeur sensible apparaît dans une requête/réponse DTO, c'est un bug de sécurité — la retirer immédiatement (ex. `email`, `passwordHash`, `publicKey` ne doivent pas fuiter).

Référence : `server/src/services/discordWebhook.ts` (webhooks) — les URLs doivent venir de `process.env`, jamais du code.

## Règles générales

- Respecter les conventions du projet : React + TypeScript (client) / Express + MySQL (server), Tailwind + CSS variables, lucide-react.
- Toujours lancer après modification : `npm run lint` (repo root), `npx tsc -b` (client), `npx tsc --noEmit` (server).
- Ne pas supprimer de fonctionnalité existante ; préférer des changements ciblés et réutiliser les composants/hooks/services déjà présents.
- La version desktop et la version mobile web (Ionic, sous 768px) coexistent : ne pas casser le rendu desktop quand on modifie du mobile.
