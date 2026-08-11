[25/06/2026]
- NOUVEAU : Feed vidéo TikTok-like (/feed)
  * Nouvel onglet "Feed" dans la barre de navigation (remplace Explorer)
  * Scroll vertical infini avec snap (une vidéo à la fois, lecture auto au scroll)
  * Upload vidéo (MP4/WebM, max 100 Mo) avec légende et localisation optionnelle
  * Like / unlike avec animation, compteur de likes
  * Commentaires (drawer coulissant en bas, temps réel)
  * Localisation via geolocation API + reverse geocoding Nominatim (affiché sur la vidéo)
  * Stockage disque (server/uploads/videos/ + thumbnails/)
  * Nouvelles tables : videos, video_likes, video_comments (MySQL)
  * Nouvelles routes API : POST/GET/DELETE /api/videos, like, comments
  * Socket events : video:new, video:liked, video:comment
- NOUVEAU : Affichage du nom de l'expéditeur dans les messages de groupe
  * Le nom/prénom (senderName) apparaît au-dessus du message quand c'est le premier d'un groupe
  * Clic sur le nom → ouvre le profil de la personne
  * Modification dans `ChatView.tsx` (composant msg-bubble)

[08/06/2026]
- NOUVEAU : Logs de la plateforme envoyés vers Discord (Webhook Logger)
  * Tous les console.log/warn/error du serveur sont redirigés vers un channel Discord
  * Nouveau service `server/src/services/logger.ts` : queue + batching + rate limiting
  * Embeds formatés : titre = niveau (LOG/WARN/ERROR), couleur associée, timestamp
  * Queue avec flush périodique (batch de 10, respect du Retry-After)
  * Importé en première ligne de `index.ts` → capture toute la vie du serveur
  * Configuration via variable d'environnement `LOGGER_WEBHOOK_URL` dans `.env`
  * Dégradation silencieuse si webhook indisponible (pas de crash)

[07/06/2026]
- NOUVEAU : Menu contextuel (clic droit) sur les conversations de la sidebar
  * 4 actions : Épingler/Désépingler, Supprimer, Bloquer, Signaler
  * Pin persisté dans localStorage (tri épinglés en tête de liste)
  * Routes API `POST /api/blocks/:uid/block`, `POST /api/blocks/:uid/report`
  * Tables MySQL `blocks` et `user_reports`
- NOUVEAU : Musique de fond sur les Stories
  * Ajout d'une musique dans le créateur de story (fichier audio/*, max 5 Mo)
  * Slider pour choisir le point de départ de l'extrait, prévisualisation jouable
  * 3 durées d'extrait : 5s, 15s, 30s → la story dure le temps de l'extrait
  * Découpage audio client-side (Web Audio API + WAV 16kHz mono) pour réduire la taille
  * Compression d'image en 800px / JPEG 70% avant upload (évite `max_allowed_packet`)
  * Indicateur musical animé dans le viewer avec barres de progression
  * Description textuelle (max 200 car.) affichée en superposition sur la story
  * Colonnes DB : audioData, audioName, audioStartTime, audioExtractDuration, description
- NOUVEAU : Anti-crash system (server + client)
  * Server : Express error middleware (4 paramètres), `process.on('uncaughtException')`, 
    `process.on('unhandledRejection')`, `SIGTERM`/`SIGINT` graceful shutdown
  * Server : `patchRouter()` auto-wrap tous les handlers asynchrones → `next(err)`
  * Server : Rate limiter IP (auth 20/min, contacts 60/min, messages 120/min)
  * Server : Request timeout 30s sur /api/*
  * Server : Pool MySQL keepAlive + auto-retry sur ECONNRESET
  * Client : React Error Boundary → fallback UI avec bouton Recharger
  * Client : `window.addEventListener('error')` + `unhandledrejection` (logs console)
  * Client : Socket.IO config explicite (reconnection infinie, backoff 1s→30s)
  * Client : Utilitaires `safeJsonParse`, `safeJsonStringify`, `safeCall`, `safeAsyncCall`
- NOUVEAU : Thème clair/sombre (data-theme, localStorage, transition CSS)
  * Provider `useTheme.tsx`, sélecteur dans Settings, variables CSS light mode
- NOUVEAU : Embed sociaux (OG tags) pour les liens dans les messages
  * Endpoint `POST /api/link-preview` (fetch + parse meta), cache mémoire
  * Rendu cliquable + carte de preview (image, site, titre, description)
- FIX : TURN server ajouté à ICE_SERVERS (WebRTC derrière NAT)
- FIX : toggleDeafen() mute bien l'audio distant (remoteStream)
- FIX : toggleCamera() ajoute/retire la vidéo track avec replaceTrack
- FIX : Timeout 30s sur les appels entrants → auto-reject
- FIX : ICE restart automatique sur perte de connexion WebRTC
- FIX : Bind params MySQL undefined → null (sanitize global dans query())
- FIX : Migration ALTER TABLE compatible MySQL < 8.0.16 (via information_schema)
- FIX : Dépassement max_allowed_packet MySQL (compression image + trimming audio)
- NOUVEAU : Liens sociaux sur le profil public (@username)
  * Éditeur dans les paramètres : sélecteur de plateforme + champ URL
  * Jusqu'à 3 liens sociaux sur le profil
  * 17 plateformes supportées (Twitter/X, Instagram, GitHub, YouTube, Discord, TikTok, LinkedIn, etc.)
  * Aperçu en direct dans le panneau latéral des paramètres
  * Affichage des liens cliquables sur la page publique `/@username`
  * Stockage JSON dans la colonne `social_links` de la table `profiles`
  * Migration MySQL conditionnelle via `information_schema`
- NOUVEAU : Stockage froid (Google Cloud Storage COLDLINE) pour les appels vocaux
  * Installation de `@google-cloud/storage` (serveur)
  * Nouveau service `coldStorage.ts` : init bucket, sauvegarde, archivage, consultation
  * Double écriture MySQL + GCS à la fin de chaque appel (`call:end`)
  * Archivage automatique des appels > 30 jours depuis MySQL vers GCS (toutes les 6h)
  * Route `GET /api/calls/history` : historique combiné MySQL (chaud) + GCS (froid)
  * Route `GET /api/calls/:id` : recherche d'abord MySQL, fallback GCS
  * Bucket GCS créé automatiquement avec classe `COLDLINE` et localisation `EUROPE-WEST9`
  * Configuration via variables d'environnement `GCS_BUCKET`, `GCS_KEY_FILE`, `GCS_CREDENTIALS`
  * Dégradation transparente si GCS indisponible (fonctionnement sans stockage froid)
- FIX : Autoplay audio bloqué par le navigateur (déclenché au premier clic/touch)
- FIX : Barre de progression des stories animée via CSS @keyframes (au lieu de transition)

[05/06/2026]
- NOUVEAU : Migration Firebase → MySQL complète (auth + données)
  * Firebase Admin SDK retiré du serveur, bundle client ↓ 475 kB → 307 kB
  * Auth par cookie `session_id` (httpOnly=false, sameSite=lax, 30 jours), table `sessions` en MySQL
  * Plus de JWT HMAC, plus de `Authorization: Bearer`, plus de localStorage token
  * `wouaffId = @pseudo` créé à l'inscription et indexé dans `wouaff_id_index`
  * Middleware `middleware/auth.ts` lit `req.cookies.session_id` → lookup sessions table
  * Socket.IO authentifié via cookie handshake (package `cookie`)
  * `routes/stories.ts`, `routes/messages.ts` etc. : requêtes MySQL au lieu de Firebase RTDB
  * Colonnes `media`, `avatar`, `banner`, `imageData` etc. en `LONGTEXT` (ALTER TABLE)
  * `getMessages`/`getGroupMessages` : mapping `fromUid` → `from`, `contactData` → `contact`
  * `getProfile` joint `user_badges` pour retourner `ownedBadges`
  * `seedBadges()` UPDATE les existants au lieu de INSERT (correction chemins icônes)
  * Fix JSX : `{msg.seen && ...}` → `{!!msg.seen && ...}` (évite render "0" depuis TINYINT)
- NOUVEAU : Layout mobile natif (inspiré ANCIEN/)
  * Bottom navigation bar 3 tabs (Discussions, Stories, Paramètres) — `MobileLayout.tsx`
  * Safe-area insets `env(safe-area-inset-*)` dans `app.css`
  * Touch targets `min-height: 48px` sur `.bnav-item`
  * Modales en drawers pleine écran sur mobile (media query ≤520px)
  * Support `color-scheme: dark` + `prefers-color-scheme: light`
  * Swipe-back gesture vers discussions sur pages non-chat
- NOUVEAU : Swipe-to-reveal actions sur conversations (delete/leave) — `SwipeableConv.tsx`
- FIX : Login page optimisée pour clavier mobile (inputMode, scrollIntoView)
- FIX : Avatars manquants dans les messages ChatView (chargement `/api/profiles/:uid`)
- FIX : Badges visibles dans la sidebar (liste des conversations)
- FIX : Badges admin — icônes `dieu_badge.png` au lieu de `dieu.png`
- FIX : Badges persistants dans le profil — `getProfile` joint `user_badges`
- FIX : Story viewer invisible — `#storyViewer{display:none}` remplacé par `display:flex` (conflit CSS avec `.story-viewer-overlay`)

[03/06/2026]
- NOUVEAU : Refonte complète de l'architecture (migration legacy → moderne)
  * Front-end migré de HTML/JS → React 18 + TypeScript + Vite
  * Back-end Node.js (Express + Socket.IO + Firebase Admin) créé
  * Toute la communication Firebase passe désormais par le backend (plus de SDK Firebase côté client sauf Auth)
  * API REST complète : messages, conversations, profils, groupes, contacts, stories, notifications, search, admin, status
  * WebSocket (Socket.IO) pour le temps réel : messages, typing, seen
  * E2EE (ECDH P-256 + AES-256-GCM) conservé côté client via l'API Web Crypto
  * CSS legacy conservé à l'identique (assets/css/app.css)
  * Routes : /auth, /settings, /admin, /* (chat)
  * Compilation TypeScript validée (client + server)
  * Clés Firebase et infos sensibles uniquement dans le backend (via variables d'environnement / service account)
- NOUVEAU : Système de Stories façon Instagram
  * Barre horizontale dans la sidebar avec bouton "+" pour créer une story
  * Halo orange autour des avatars des contacts ayant des stories non vues
  * Halo gris quand toutes les stories sont vues
  * Visualiseur plein écran avec barres de progression, tap gauche/droite pour naviguer
  * Auto-avance toutes les 5s, swipe vers le bas pour fermer
  * Les stories expirent automatiquement au bout de 12h
  * Nettoyage des stories expirées à la publication
  * Données stockées dans Firebase Realtime Database (nœud /stories/{uid})
- FIX : Messages en attente (pending) — scan filtré par champ pendingFrom + limite 30 jours
- FIX : Messages en attente — ajout d'un listener en temps réel pour détecter les nouveaux messages
- FIX : Refuser un message en attente ne supprime plus que les messages avec pendingFrom (conserve l'historique)
- FIX : Notifications push — les messages de non-contacts sont silencieux (data-only) au lieu d'une notification système
- RÈGLES Firebase : ajout du nœud /stories avec règles de sécurité
- FIX : session persistante après rafraîchissement et changement de page (Persistence.SESSION → LOCAL)
- FIX : page admin, settings, migration : attente du rétablissement Firebase Auth avant redirection
- Cache service worker : wouaff-v1 → wouaff-v2
- FIX : messages vocaux — micro rouge garde l'audio, coche verte envoie, croix annule
- Nouveau : panneau profil latéral droit (bouton à côté de la poubelle) — avatar, pseudo, statut, bio, badges, croquettes
- FIX : scroll en bas de la discussion après chargement initial (once('value') garanti)
- FIX : panneau profil — avatar plus chevauché par la bannière, fallback initiales quand image cassée
- Admin : gestion des badges (ajout/retrait) depuis la liste utilisateurs + règle staff pour écriture profils

[02/06/2026]
- Ajout du bouton "+" dans la zone de saisie pour attacher des médias (image, fichier, contact)
- Les images s'affichent directement dans le chat et s'ouvrent en grand au clic
- Les fichiers sont téléchargeables via un lien dans le message
- Partage de contacts via l'API Contact Picker (navigateurs supportés)
- Correction : l'Identifiant Wouaff (@id) est maintenant bien créé lors de l'inscription (email et Google)
- Correction : plus de redirection prématurée avant la création complète du profil
- Correction : fonctions média (toggleMediaMenu, sendImage, sendFile, sendContact) attachées à window pour compatibilité InfinityFree
- Ajout panneau utilisateur en bas de la barre latérale (avatar + pseudo + bouton déconnexion rouge)
- Ajout notifications push (FCM) : demande d'autorisation, notifications en temps réel même site fermé
- Service worker firebase-messaging-sw.js pour réception des notifications en arrière-plan
- Cloud Functions pour l'envoi des notifications push (voir functions/index.js)
- Alerte de sécurité avant téléchargement de fichier + option "ne plus demander pour cet expéditeur"
- Menu contextuel (répondre, réactions) : ouvert sur clic droit (plus sur clic gauche)
- Son propre profil : bouton "Modifier le profil" → redirection vers /settings/
- Messages vocaux : enregistrement et lecture directe dans le chat
