# <img src="https://wouaff.app/assets/logo/logo.png" alt="Wouaff Logo" width="30" height="30" align="left" style="margin-right: 9px; margin-top: 5px;"> Wouaff — t'as capté 🐺

*Le premier réseau social **français** et **souverain***  
*Conçu en France, hébergé en France, pour les Français.*

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
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

À l'origine une application de messagerie, **Wouaff** se transforme en réseau social souverain, sans équivalent en France. Nos engagements sont clairs :

- 🇫🇷 **Hébergement 100 % français** — toutes les données restent sur le territoire national.
- ⚖️ **RGPD & lois européennes** — le droit français et européen s'appliquent, sans compromis.
- 🔒 **Confidentialité par défaut** — pas de traçage d'activité, pas de revente de données.

Le projet suit une approche **« privacy by design »** : la souveraineté numérique n'est pas une option, c'est le socle du produit.

---

## ✨ Fonctionnalités

### ✅ Actuelles

- 🏠 **Page d'accueil façon réseau social** (Twitter / Instagram / Mastodon) : fil d'actualité, boîte de publication, tendances en France, suggestions de comptes.
- 🔐 **Connexion & inscription** — email, mot de passe sécurisé, vérification d'email.
- 🎨 **Thèmes** clair / sombre.
- 📱 **Cross-platform** : Web (PWA), Desktop (Electron), Mobile (PWA).

### 🚀 À venir

- 💬 **Messagerie** — réintégrée au réseau social, comme sur Instagram ou Twitter (actuellement accessible sur `/chat`).
- 📡 **Fil d'actualité connecté au backend** — le front-end est en place, le back-end arrive.
- 📞 Appels, stories, groupes, etc.

---

## 🧱 Stack technique

| Couche       | Technologies                                                                |
|--------------|-----------------------------------------------------------------------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS                                    |
| **Backend**  | Express 4, Socket.IO, MySQL (mysql2)                                        |
| **Desktop**  | Electron 33, electron-builder                                               |
| **Security** | ECDH + AES-256-GCM (E2EE), bcrypt, sessions httpOnly                        |
| **Real-time**| Socket.IO (messagerie, appels, typing, présence)                            |

---

## 🚀 Getting Started

### 📋 Prérequis

- Node.js 18+
- MySQL 8+
- npm (ou pnpm)

### 📥 Installation

```bash
# Cloner le dépôt
git clone https://github.com/ton-username/wouaff.git
cd wouaff

# Installer les dépendances
cd client && npm install
cd ../server && npm install
cd ..

# Configurer l'environnement
cp server/.env.example server/.env
cp client/.env.example client/.env
# Éditez les fichiers .env avec votre configuration

# Lancer les migrations DB (auto au démarrage du server)
cd server && npm run dev
```

### 🛠️ Développement

```bash
# Terminal 1 — Serveur
cd server
npm run dev

# Terminal 2 — Client
cd client
npm run dev
```

Le client tourne sur `http://localhost:5173` et proxyfie les requêtes API vers le serveur sur `http://localhost:7285`. Une fois connecté, vous arrivez sur la page d'accueil ; l'ancienne messagerie reste accessible sur `/chat`.

### 📦 Build production

```bash
cd client && npm run build
cd ../server && npm run build
cd ..
npm run start:prod
```

### 🖥️ Desktop (Electron)

```bash
cd client
npm run electron:dev    # Mode développement
npm run electron:build  # Build production (Windows/Mac/Linux)
```

---

## 🏗️ Architecture

```
wouaff/
├── client/          # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/   # UI components
│   │   │   ├── Home/         # Page d'accueil (fil social)
│   │   │   ├── Auth/         # Connexion / inscription
│   │   │   ├── Chat/         # Messagerie (à réintégrer)
│   │   │   └── ...
│   │   ├── data/         # Données de démonstration (tendances, suggestions)
│   │   ├── hooks/        # React contexts (Auth, Call, Theme)
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API client, Socket.IO, E2EE, WebRTC
│   │   ├── types/        # TypeScript definitions
│   │   └── utils/        # Helpers
│   └── electron/         # Electron main process
├── server/          # Express API (TypeScript)
│   ├── src/
│   │   ├── config/       # Database, migrations
│   │   ├── middleware/    # Auth, rate limit, error handling
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic, storage
│   │   ├── socket/       # Socket.IO server
│   │   └── types/        # TypeScript definitions
│   └── migrations/       # SQL migration files
└── docs/            # Documentation
```


---

## 🔐 Sécurité

- 🍪 **Auth par session** : cookies httpOnly, sessions expirantes et révocables.
- 🚦 **Rate limiting** : protection par endpoint contre les abus.
- 🧱 **Requêtes SQL paramétrées** et validation des entrées sensibles côté serveur.
- 🛡️ **CSRF** : cookies SameSite.
- 🕵️ **Journalisation minimale** : pas de traçage d'activité dans l'application ; les journaux techniques et alertes de sécurité sont envoyés vers un canal privé de l'équipe.

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
