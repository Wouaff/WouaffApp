/* Wrapper pour electron-builder (publie l'installateur Windows sur GitHub Releases).
   Usage : node scripts/publish.cjs --win --config electron-builder.yml --publish always */
const { spawn } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
const builderCli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');

const child = spawn(process.execPath, [builderCli, ...args], { stdio: 'inherit' });

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('Impossible de lancer electron-builder :', err.message);
  process.exit(1);
});
