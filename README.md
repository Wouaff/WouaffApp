# <img src="https://wouaff.app/assets/logo/logo.png" alt="Wouaff Logo" width="30" height="30" align="left" style="margin-right: 9px; margin-top: 5px;"> Wouaff — t'as capté 🐺

*Le premier réseau social **français** et **souverain***  
*Conçu en France, hébergé en France, pour les Français.*

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-Custom-blue)

---

## 👥 Équipe

<table>
  <tr>
    <td align="center" width="140">
      <img src="https://github.com/imbiston.png" alt="Avatar" width="80" style="border-radius: 50%;" />
      <br />
      <strong>@imbiston</strong>
      <br />
      <sub>Fondateur & Dev</sub>
    </td>
    <td align="center" width="140">
      <img src="https://github.com/youtsuhodev.png" alt="Avatar" width="80" style="border-radius: 50%;" />
      <br />
      <strong>@youtsuhodev</strong>
      <br />
      <sub>Fondateur & Lead Dev</sub>
    </td>
  </tr>
</table>

---

## 🛡️ La souveraineté Wouaff

À l'origine une application de messagerie, **Wouaff** est devenu un réseau social souverain. Nos engagements sont clairs :

- 🇫🇷 **Hébergement 100 % français** — toutes les données restent sur le territoire national.
- ⚖️ **RGPD & lois européennes** — le droit français et européen s'appliquent, sans compromis.
- 🔒 **Confidentialité par défaut** — pas de traçage d'activité, pas de revente de données.

Le projet suit une approche **« privacy by design »** : la souveraineté numérique n'est pas une option, c'est le socle du produit.

---

## ✨ Fonctionnalités

- 🏠 **Fil** « Pour toi » (chronologique) et « Abonnements », scroll infini.
- ✍️ **Posts** de 280 caractères max avec image ou vidéo (30 Mo), reposts, likes, réponses, #hashtags, @mentions et liens cliquables.
- 🔎 **Explorer** : recherche de comptes et de posts, tendances, pages `#hashtag`.
- 👤 **Profils** : photo, bannière, bio, abonnés / abonnements, onglets Posts · Réponses · Reposts.
- 🔔 **Notifications** (likes, reposts, réponses, mentions, abonnements) avec badge de non-lus.
- 🛡️ **Modération** : blocage, signalement par catégorie avec retour au signaleur, file de modération (`/admin`), sanctions (avertissement, suppression, suspension, bannissement), journal des actions, décisions notifiées avec motif.
- 🔐 **Compte** : double authentification (appli TOTP), sessions visibles et révocables, codes de secours, mot de passe oublié, changement de pseudo et d'e-mail, confirmation d'e-mail (SMTP), captcha Cap auto-hébergé (optionnel), cookie de session `__Host-` en HTTPS.
- 🇪🇺 **RGPD** : export des données et suppression définitive du compte depuis Paramètres → Confidentialité.
- 🎨 Thème clair / sombre / automatique · 📱 PWA installable · 🖥️ appli de bureau (Electron).

### 🚧 Pas (encore) dans cette version

Messagerie privée, communautés, stories, appels. Elles existaient dans l'ancienne version et ont été retirées lors de la réécriture allégée (voir l'historique git).

---

## 🧱 Stack technique

| Couche       | Technologies                                                    |
|--------------|-----------------------------------------------------------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS                        |
| **Backend**  | Express 4, MySQL / MariaDB (mysql2), nodemailer                 |
| **Desktop**  | Electron, electron-builder                                      |
| **Sécurité** | bcrypt, sessions httpOnly, TOTP, rate-limit, CSP, validations   |

---

## 🚀 Démarrage

### Prérequis

- Node.js 20+ (testé sur 22)
- MySQL 8+ ou MariaDB 10.6+, avec une **base vide** (par défaut `wouaff`, jeu de caractères utf8mb4)

### Installation

```bash
git clone https://github.com/Wouaff/WouaffApp.git
cd WouaffApp
npm install                 # outils du dépôt (Biome)
npm --prefix server install
npm --prefix client install

cp server/.env.example server/.env
# éditer server/.env : identifiants MySQL, APP_URL, SMTP éventuel
# recommandé : TOTP_ENCRYPTION_KEY=$(openssl rand -hex 32) pour chiffrer les secrets 2FA en base
```

Premier administrateur (après une inscription normale) :

```bash
npm --prefix server run build
npm --prefix server run role -- ton_pseudo admin     # ou moderator / user
```

Les administrateurs nomment ensuite les modérateurs depuis `/admin` → Utilisateurs.

#### Captcha Cap (optionnel, auto-hébergé)

```bash
CAP_ADMIN_KEY=une-longue-valeur-secrète docker compose -f cap/docker-compose.yml up -d
```

Ouvre `http://127.0.0.1:3001`, connecte-toi avec `CAP_ADMIN_KEY`, crée une clé de site (laisse l'instrumentation désactivée), puis renseigne `CAP_URL`, `CAP_SITE_KEY` et `CAP_SECRET` dans `server/.env`. Cap ne doit pas être exposé publiquement : seul le serveur Wouaff le contacte.

Les tables sont créées automatiquement au démarrage du serveur (`server/src/migrations`).

> ⚠️ Utilise une base **neuve**. Une base issue de l'ancienne version (tables `profiles`, `post_likes`…) n'est pas compatible.

### Développement

```bash
npm run dev     # serveur Express + Vite (HMR) sur http://localhost:7285
```

Variante : `npm --prefix client run dev` lance Vite seul sur `:5173` et proxifie `/api` et `/uploads` vers `:7285`.

### Production

```bash
npm run build
NODE_ENV=production npm start     # `npm run start:build` = build puis démarrage
```

Derrière un reverse proxy, définis `TRUST_PROXY=1` pour que le rate-limit voie la vraie IP.

### Desktop (Electron)

```bash
cd client
npm run dev:electron      # développement
npm run build:electron    # installeur Windows (autres : :mac, :linux)
```

En production l'appli charge `https://wouaff.app` (changeable avec `WOUAFF_URL`) ; si le site est injoignable, elle affiche l'interface embarquée.

---

## 🏗️ Architecture

```
WouaffApp/
├── client/                 # SPA React (Vite + TypeScript) + Electron
│   ├── src/components/     # PostCard, ComposeBox, Sidebar, AppShell…
│   ├── src/pages/          # Feed, Explore, Post, Profile, Settings, Login…
│   ├── src/hooks/          # useAuth, useTheme, usePaged, useUnread
│   ├── src/services/       # client API
│   └── electron/           # processus principal Electron
└── server/                 # API Express (TypeScript)
    └── src/
        ├── config/         # base de données, migrations, captcha
        ├── middleware/     # auth, rate-limit, en-têtes de sécurité, erreurs
        ├── routes/         # auth, posts, profiles, social, notifications, trends, upload
        ├── services/       # accès données (rtdb.ts), requête du fil, e-mails
        └── migrations/     # 001_init.sql … 007_hardening.sql
```

---

## 🔐 Sécurité

- 🍪 Sessions par cookie `httpOnly` + `SameSite=Lax`, expirantes, révocables ; purge automatique des sessions expirées.
- 🔑 Mots de passe hachés (bcrypt), double authentification TOTP, réinitialisation par jeton à usage unique.
- 🚦 Rate-limit global et renforcé sur la connexion, l'inscription, les publications et les envois.
- 🧱 Requêtes SQL paramétrées, entrées validées côté serveur (pseudos réservés, URL http(s) uniquement, médias limités aux uploads).
- 📎 Uploads : type vérifié sur le contenu réel du fichier, EXIF/GPS retiré (`sharp`), `nosniff` et CSP restrictive sur `/uploads`, fichiers effacés avec le post ou le compte.
- 🔏 Sessions stockées sous forme de hash, secrets 2FA chiffrés (`TOTP_ENCRYPTION_KEY`), codes TOTP à usage unique, contrôle d'`Origin` anti-CSRF.
- 🕵️ Aucun suivi d'activité ; les journaux techniques restent sur le serveur.

Voir [SECURITY.md](SECURITY.md) pour signaler une faille.

---

## 🤝 Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 Licence

[Wouaff License](LICENSE) — Autorisé pour contributions et améliorations uniquement. Redistribution sous un autre nom ou branding interdite.

---

<p align="center">
  <sub>Fait avec ❤️ en France · <a href="https://wouaff.app">wouaff.app</a></sub>
</p>
