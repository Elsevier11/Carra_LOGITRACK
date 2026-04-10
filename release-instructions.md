# Istruzioni per testare LogiTrack in rete locale

1. **Assicurati che il backend sia attivo**
   - Sul server (quella macchina dove hai già installato `release/`) esegui `npm install --production` (solo la prima volta) e poi `node server/index.js`.
   - Il backend ascolta sulla porta `3001` e serve anche il frontend compilato (`release/dist/`).

2. **Apri il firewall solo per la rete locale**
   - Se stai usando Windows, apri “Windows Defender Firewall” e consenti il programma `node.exe` o apri direttamente la porta TCP `3001` per la rete privata.

3. **Trova l’indirizzo IP della macchina server**
   - Apri PowerShell/Prompt e esegui `ipconfig`. Cerca l’“Indirizzo IPv4” della scheda attiva (es. `192.168.1.10`).

4. **Accedi da un client della stessa rete**
   - Su un qualsiasi browser di un altro PC, digita `http://<IP-server>:3001` (es. `http://192.168.1.10:3001`).
   - Non serve installare nulla: il browser scarica la UI direttamente dal backend.

5. **Login e verifica**
   - Usa le credenziali `admin` + password aggiornata (`reset-admin-password.js` può cambiarla).
   - Se visualizzi la UI, il client è già connesso: tutte le chiamate API andranno al server remoto.

6. **Riepilogo**
   - Il backend serve sia le API sia i file statici → non servono server aggiuntivi sui client.
   - Apri solo `http://<IP-server>:3001`.
   - Se serve distribuire su più PC, basta aggiungere l’IP nella configurazione `allowedOrigins` di `server/index.js` e riavviare il backend.

Fammi sapere se vuoi lo stesso documento tradotto in DOCX/PDF o con screenshot passo passo.
