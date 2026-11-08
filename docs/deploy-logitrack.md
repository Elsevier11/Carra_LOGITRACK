# Deploy e aggiornamento LogiTrack sul server cliente

Questa procedura raccoglie le indicazioni e le conferme degli scambi email con Paolo Andretta di APF. È il riferimento per preparare i prossimi rilasci del progetto CARRA LogiTrack. La ricostruzione documentale è stata effettuata l'8 novembre 2026; non comprende un'ispezione del server attuale.

## Ambiente verificato negli scambi

L'email di risposta del 28 maggio 2026, oggetto “Re: Aggiornamento Carra”, riporta questi dati effettivi dal server:

| Elemento | Evidenza del 28 maggio 2026 |
| --- | --- |
| Sistema | Linux, piattaforma immagine `linux/amd64` |
| Directory del progetto | `/opt/Carra_LOGITRACK` |
| Repository | `https://github.com/Elsevier11/Carra_LOGITRACK.git` |
| Branch | `feature/yard-manager-multi` |
| Container | `carra-logitrack` |
| Porta pubblicata | `3001:3001` |
| Stato dopo aggiornamento | Container `healthy`, SQLite connesso, schema inizializzato |
| Commit allora installato | `bf65cd7` — miglioramenti tablet |

Questi dati documentano una configurazione storica. Prima di un nuovo rilascio verificare checkout, branch, commit di destinazione, percorso del DB e configurazione realmente utilizzata dal servizio. Non riportare automaticamente il server al commit storico.

## Pubblicazione sui due repository

Per i prossimi rilasci pubblicare lo stesso commit su entrambi i repository quando il push è autorizzato:

| Remote nel checkout di sviluppo | Repository | Uso |
| --- | --- | --- |
| `origin` | `https://github.com/Elsevier11/Carra_LOGITRACK.git` | Riferimento da comunicare a Paolo Andretta per l'aggiornamento del server |
| `azienda` | `https://github.com/Zerobyte-SRL/Carra_LOGITRACK.git` | Repository aziendale da mantenere aggiornato allo stesso commit |

Il branch di rilascio attuale è `feature/yard-manager-multi`. Il fatto che il checkout segua `azienda/feature/yard-manager-multi` non sostituisce il push su Elsevier11. Per le modifiche alle solette dell'8 novembre 2026, il commit `e097dde` è stato pubblicato e verificato su entrambi.

Dopo i controlli locali e il commit, verificare gli URL dei remote e che il push sia fast-forward, quindi pubblicare e confrontare gli SHA:

```bash
git remote -v
git push origin HEAD:refs/heads/feature/yard-manager-multi
git push azienda HEAD:refs/heads/feature/yard-manager-multi
git rev-parse HEAD
git ls-remote origin refs/heads/feature/yard-manager-multi
git ls-remote azienda refs/heads/feature/yard-manager-multi
```

Eseguire i comandi uno alla volta, verificandone l'esito. Il rilascio è pubblicato su entrambi solo quando gli SHA dei due branch remoti coincidono con il commit previsto. Se un push fallisce o il remoto è divergente, non forzarlo e non dichiarare completata la pubblicazione su entrambi: segnalare l'esito parziale e risolvere la divergenza preservando il lavoro esistente. Il push non comprende l'esecuzione del deploy o l'invio della mail.

## Mail sintetica a Paolo Andretta

Ad Andretta indicare il repository Elsevier11 e richiamare la procedura già concordata. La mail deve contenere un breve riepilogo delle modifiche effettivamente incluse, branch e commit, richiesta di backup e preservazione DB e richiesta di conferma per organizzare la verifica con il cliente. Non riportare comandi e runbook completi salvo richiesta esplicita, cambio di procedura o un problema specifico che lo richieda. Non inviare la mail senza autorizzazione.

Traccia da adattare al rilascio:

> Oggetto: Aggiornamento LogiTrack – [area modificata]
>
> Ciao Paolo,
>
> ho pubblicato sul solito repository Elsevier11 la nuova versione di LogiTrack con queste modifiche:
>
> - [modifica concreta 1]
> - [modifica concreta 2]
> - [eventuale ulteriore modifica]
>
> Puoi procedere con l'aggiornamento con la solita modalità, facendo prima un backup e preservando il database esistente?
>
> Il branch rimane `feature/yard-manager-multi`; il nuovo commit è `[SHA verificato]`.
>
> Fammi sapere quando è aggiornato, così avvisiamo Nadia e Mirco per la verifica.
>
> Grazie,
> Paolo

## Persistenza e configurazione

Il `docker-compose.yml` del repository prevede:

- `LOGITRACK_DB_PATH=/app/runtime-data/vasche.db`;
- bind mount `./runtime-data:/app/runtime-data`;
- `LOGITRACK_SESSION_SECRET` fornito dall'ambiente del server;
- riavvio del container con `restart: unless-stopped`;
- health check su `/api/health`.

Il DB deve rimanere sullo storage persistente dell'host. Con il percorso storico del progetto e il mount sopra, il file host è `/opt/Carra_LOGITRACK/runtime-data/vasche.db`. Verificare il mount effettivo prima del backup: una configurazione locale o un override Compose possono cambiare il percorso.

Conservare il secret di sessione stabile e preservare le impostazioni locali, inclusi `.env`, eventuali override Compose e configurazioni CORS/cookie. Non riportare segreti nei log di verifica o nei documenti di consegna.

La consegna iniziale del 15 aprile prevedeva un repository senza dati cliente e il popolamento successivo da parte del cliente. Questo requisito iniziale non autorizza a sostituire il DB esistente durante gli aggiornamenti.

## Procedura di aggiornamento

Eseguire sul server di destinazione, con accesso autorizzato e finestra di manutenzione concordata. La sequenza integra i comandi concordati il 28 maggio con la preservazione del DB descritta nel documento locale “Aggiornamento release LogiTrack con preservazione DB.docx”.

### 1. Verificare ambiente e versione

```bash
cd /opt/Carra_LOGITRACK
git status --short
git remote -v
git branch --show-current
git log -1 --oneline
docker compose ps
docker inspect carra-logitrack --format '{{json .Mounts}}'
curl -fsS http://127.0.0.1:3001/api/health
```

Confermare repository e branch attesi per il rilascio. Annotare il commit precedente, il percorso DB effettivo e le eventuali personalizzazioni del server. Se il checkout è diverso da quello atteso o presenta modifiche locali, chiarire come preservarle prima di aggiornare; non usare reset o pulizie forzate.

### 2. Fermare l'applicazione e salvare il DB

Il seguente esempio assume che i controlli precedenti abbiano confermato il mount standard. Adattare i percorsi se il server usa una configurazione diversa.

```bash
DATA_DIR=/opt/Carra_LOGITRACK/runtime-data
DB_PATH="$DATA_DIR/vasche.db"
BACKUP_DIR="$DATA_DIR/backups"
test -f "$DB_PATH"
mkdir -p "$BACKUP_DIR"
docker compose stop
docker compose ps
```

Procedere solo dopo aver verificato l'esito dei comandi e che il servizio sia fermo, senza altri processi che scrivono sul DB. Copiare il DB e gli eventuali file SQLite associati nello stesso backup:

```bash
BACKUP_PATH="$BACKUP_DIR/pre-deploy-$(date +%F-%H%M%S)"
mkdir -p "$BACKUP_PATH"
cp -p "$DB_PATH" "$BACKUP_PATH/vasche.db"
for suffix in -wal -shm; do
  if [ -f "$DB_PATH$suffix" ]; then
    cp -p "$DB_PATH$suffix" "$BACKUP_PATH/vasche.db$suffix"
  fi
done
ls -lh "$BACKUP_PATH"
```

Verificare che ogni copia sia riuscita e che il backup sia leggibile prima di continuare. Non copiare semplicemente il solo file DB mentre l'applicazione scrive. Retention e copia fuori dal server devono seguire le policy concordate con cliente e sistemista; non risulta dalle email esaminate una retention finale confermata.

### 3. Aggiornare codice e container

Sul server usare il remote che punta a Elsevier11 e controllare di essere sul branch `feature/yard-manager-multi`. Nell'esempio questo remote si chiama `origin`: verificarne l'URL, senza presumere che i nomi coincidano con quelli del checkout di sviluppo.

```bash
RELEASE_REMOTE=origin
git fetch "$RELEASE_REMOTE"
git pull --ff-only "$RELEASE_REMOTE" feature/yard-manager-multi
docker compose build --no-cache
docker compose up -d --force-recreate
```

Eseguire un comando alla volta e fermarsi se fallisce. L'opzione `--ff-only` è una cautela aggiunta a questa procedura per evitare merge impliciti sul server; nella mail del 28 maggio il comando era `git pull origin feature/yard-manager-multi` sul repository Elsevier11, che resta il riferimento per Andretta. Se sul server manca un remote verso quel repository, chiarire la configurazione prima di aggiornare, senza sostituire automaticamente i remote esistenti.

Il solo `docker compose build --no-cache` non scarica il nuovo codice: senza aggiornamento Git ricostruisce la versione già presente. Non modificare `runtime-data` e non usare `docker compose down -v`. Preservare secret e configurazione locale anche dopo il pull.

### 4. Verificare e registrare l'esito

```bash
git log -1 --oneline
docker compose ps
docker compose images
docker compose logs --tail=100
curl -fsS http://127.0.0.1:3001/api/health
```

Confermare:

- versione installata corrispondente al rilascio atteso;
- container avviato e `healthy`, health endpoint HTTP 200 con `status: ok`;
- startup senza errori e migrazioni completate;
- login da un browser del cliente, dati preesistenti presenti;
- operazioni base pertinenti al rilascio, incluse creazione, duplicazione, spostamento e scarico, con dati di prova concordati.

Registrare commit precedente e nuovo, percorso e timestamp del backup, esito dei controlli ed eventuali anomalie. La sola risposta positiva dell'health endpoint non conferma il funzionamento del login o del percorso browser/rete.

### 5. Ripristino in caso di anomalia

Fermare il servizio e conservare una copia dello stato anomalo prima di intervenire. Ripristinare insieme la versione applicativa precedente e il backup SQLite corrispondente, compresi gli eventuali file associati. Evitare di lasciare file WAL della versione fallita accanto a un DB ripristinato. Riavviare e ripetere health check, login e verifica dati.

Il ripristino DB elimina le modifiche successive al backup: concordare l'intervento se gli utenti hanno già ripreso a lavorare. Non eseguire rollback distruttivi automaticamente.

## Accesso di test e pubblicazione HTTPS

Negli scambi del 15–17 aprile 2026 risultano due configurazioni distinte:

- **Test effettivamente confermato:** il 16 aprile Andretta comunica login funzionante su macchina pubblica direttamente sulla porta 3001, con accesso abilitato solo dagli IP del cliente. Il primo test in VM locale su `192.168.1.21:3001` aveva health positivo ma login bloccato da CORS.
- **Pubblicazione prevista nella consegna:** HTTPS tramite reverse proxy gestito dal sistemista, dominio/FQDN scelto da lui e `LOGITRACK_COOKIE_SECURE=true`. Non è stata trovata conferma finale dell'attivazione di questa configurazione o dell'URL definitivo.

Per risolvere il blocco CORS furono proposte nel Compose `LOGITRACK_ALLOWED_ORIGINS` con gli origin effettivi, oppure `LOGITRACK_CORS_ALLOW_ALL=true` solo per test. Le email non indicano quale opzione sia stata applicata sul server pubblico. Il Compose attuale del repository non espone queste due variabili: verificarne l'inserimento nella configurazione effettiva del container, senza presumere che basti definirle nel solo `.env`.

Il Compose del repository imposta `LOGITRACK_COOKIE_SECURE` a `false`; per HTTPS va adattato alla configurazione concordata. Non dedurre dalle sole email che il server attuale usi HTTP, HTTPS o uno specifico origin.

## Documentazione precedente e fonti

Le istruzioni Windows/PM2 e i bundle `release/`/ZIP descrivono altri percorsi di installazione. I primi scambi dell'8–9 aprile contenevano chiarimenti su PC client, share Samba e Windows Server; il successivo deploy Docker è documentato dalle email di aprile e maggio. `deploy-render.md` descrive un'alternativa Render, non la procedura cliente verificata con Andretta.

Fonti principali:

- Email “Consegna LogiTrack per pubblicazione su server cliente (Docker, repository senza dati)”, inviata il 15 aprile 2026; risposte di Andretta del 15 e 16 aprile e riscontro di Pedron del 17 aprile.
- Email “Aggiornamento Carra” e risposta “Re: Aggiornamento Carra”, 28 maggio 2026: comandi concordati e output effettivi del server.
- Email di Andretta “Re: Fwd: FILE CONSEGNE”, 22 giugno 2026: aggiornamento del programma vasche dichiarato eseguito, con richiesta di verifica agli utenti. Le parti sulla nuova gestione ordini riguardano un altro applicativo.
- [docker-compose.yml](../docker-compose.yml) e [Dockerfile](../Dockerfile).
- Documenti locali “Aggiornamento release LogiTrack con preservazione DB.docx” e “Runbook Aggiornamento Produzione.docx”, consultati come supporto e non inclusi in questo rilascio; la loro presenza non prova che ogni passaggio sia stato applicato sul server.
