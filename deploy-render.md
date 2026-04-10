# Deploy Unificato Su Render (Senza Vercel)

Questa configurazione pubblica frontend e backend nello stesso servizio Render.

## 1) Prerequisiti

- Branch aggiornato su GitHub.
- File dati `server/vasche.db` presente nel branch da consegnare.

## 2) Crea il servizio Render unico

1. Render -> `New +` -> `Blueprint`.
2. Seleziona il repo `Elsevier11/Carra_LOGITRACK`.
3. Render usera `render.yaml` automaticamente.
4. Inserisci `LOGITRACK_SESSION_SECRET` quando richiesto.
5. Deploy.

## 3) URL da usare

- App: `https://<nome-servizio>.onrender.com`
- Health check: `https://<nome-servizio>.onrender.com/api/health`

## 4) Credenziali iniziali (se DB vuoto)

- `admin` / `admin123`
- `operatore1` / `op123`

## 5) Note operative

- Con deploy unificato non serve `VITE_API_BASE_URL`.
- Se lasci Vercel attivo, disabilita i deploy o scollega il progetto per evitare confusione.
- Su piano free il servizio puo andare in sleep; il primo accesso puo essere lento.
- SQLite su filesystem del container non e una persistenza robusta per produzione: per consegna cliente valuta almeno backup periodico del file `server/vasche.db` o un DB gestito.
