# LogiTrack release bundle

## Contenuto
- dist/ -> build del client Vite
- server/ -> backend Node.js con database SQLite di esempio (vasche.db) e script di avvio

## Istruzioni per il cliente
1. Apri un terminale in `release/server` e installa solo le dipendenze di runtime con `npm install --production`.
2. Imposta eventualmente `NODE_ENV=production` e avvia il server con `node index.js` (o `npm run start`).
3. Il backend serve la UI gia compilata (`../dist`) e ascolta sulla porta 3001.
4. Se il cliente ha bisogno di un nuovo database, sostituisci `vasche.db` con la copia fornita.

## Verifica rapida
1. Dopo l installazione, lancia `node index.js` e visita http://localhost:3001 per confermare l interfaccia di login.
2. Controlla `server.log` per assicurarti che il database venga caricato.
3. Comprimi `release/` con il comando preferito (zip, tar, ecc.) e invialo al cliente insieme a questo README.