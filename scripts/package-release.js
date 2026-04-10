const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(projectRoot, 'release');
const distDir = path.join(projectRoot, 'dist');
const serverDir = path.join(projectRoot, 'server');
const zipPath = path.join(projectRoot, 'release.zip');

function runBuild() {
  console.log('1/5 - compilo il client (npm run build)');
  execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
}

function ensureCleanRelease() {
  if (fs.existsSync(releaseRoot)) {
    fs.rmSync(releaseRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(releaseRoot, { recursive: true });
}

function copyRecursive(src, dst, skip = new Set()) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of entries) {
    if (skip.has(entry.name)) {
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(from, to, skip);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function writeReadme() {
  const lines = [
    '# LogiTrack release bundle',
    '',
    '## Contenuto',
    '- dist/ -> build del client Vite',
    '- server/ -> backend Node.js con database SQLite di esempio (vasche.db) e script di avvio',
    '',
    '## Istruzioni per il cliente',
    '1. Apri un terminale in `release/server` e installa solo le dipendenze di runtime con `npm install --production`.',
    '2. Imposta eventualmente `NODE_ENV=production` e avvia il server con `node index.js` (o `npm run start`).',
    '3. Il backend serve la UI gia compilata (`../dist`) e ascolta sulla porta 3001.',
    '4. Se il cliente ha bisogno di un nuovo database, sostituisci `vasche.db` con la copia fornita.',
    '',
    '## Verifica rapida',
    '1. Dopo l installazione, lancia `node index.js` e visita http://localhost:3001 per confermare l interfaccia di login.',
    '2. Controlla `server.log` per assicurarti che il database venga caricato.',
    '3. Comprimi `release/` con il comando preferito (zip, tar, ecc.) e invialo al cliente insieme a questo README.'
  ];
  fs.writeFileSync(path.join(releaseRoot, 'README.md'), lines.join('\n'), 'utf8');
}

function copyArtifacts() {
  console.log('2/5 - copio il dist compilato');
  copyRecursive(distDir, path.join(releaseRoot, 'dist'));
  console.log('3/5 - copio il backend (senza node_modules)');
  copyRecursive(serverDir, path.join(releaseRoot, 'server'), new Set(['node_modules']));
}

function cleanZip() {
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }
}

function compressRelease() {
  console.log('4/5 - comprimo release/ in release.zip');
  const archCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${releaseRoot}\\\\*' -DestinationPath '${zipPath}' -Force"`;
  execSync(archCmd, { stdio: 'inherit' });
}

function main() {
  runBuild();
  ensureCleanRelease();
  copyArtifacts();
  writeReadme();
  cleanZip();
  compressRelease();
  console.log('5/5 - bundle pronto in release/ e release.zip');
}

main();
