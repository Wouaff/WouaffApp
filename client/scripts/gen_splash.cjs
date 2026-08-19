/* Génère dist/splash.html — écran de démarrage affiché par electron/main.cjs. */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      background: #0b0b11;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Nunito", system-ui, sans-serif;
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }
    .wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; }
    img.logo { width: 84px; height: 84px; border-radius: 20px; }
    .word { color: #fff; font-size: 20px; font-weight: 900; letter-spacing: 0.02em; }
    .spin {
      width: 26px; height: 26px;
      border: 3px solid rgba(255,255,255,0.12);
      border-top-color: #f97b3b;
      border-radius: 50%;
      animation: rot 0.8s linear infinite;
    }
    @keyframes rot { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <img class="logo" src="/assets/logo/logo.png" alt="Wouaff" />
    <div class="word">Wouaff</div>
    <div class="spin"></div>
  </div>
</body>
</html>
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'splash.html'), html);
console.log('Splash généré : dist/splash.html');
