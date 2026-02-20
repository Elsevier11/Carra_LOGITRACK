# Presentazione Progetto Aggiornato: LogiTrack - Gestione Piazzale, Vasche, Pozzetti e Solette

## 1. Premessa
Il presente documento aggiorna l'offerta precedente (`presentazione_progetto.docx`) e descrive l'evoluzione del progetto sulla base delle nuove esigenze operative emerse.

Obiettivo: trasformare la prima proposta in una soluzione più aderente al flusso reale di magazzino/piazzale, con regole di movimentazione più rigorose, tracciabilità completa e gestione multi-tipologia articoli.

## 2. Obiettivi Funzionali Aggiornati
- Gestire in modo unificato tre famiglie di articoli: `VASCA`, `POZZETTO`, `SOLETTA`.
- Rendere la planimetria vasche coerente con le misure reali delle file.
- Introdurre una gestione dedicata delle solette su 12 pile operative.
- Imporre regole fisiche di stoccaggio (gravità, capienza massima, assenza di "sospensioni").
- Mantenere audit completo di ogni operazione (creazione, entrata, spostamento, spedizione).
- Abilitare gestione utenti con ruoli (`ADMIN`, `OPERATORE`) e autenticazione.

## 3. Architettura della Soluzione
### Frontend
- Applicazione web React/Vite con planimetria interattiva e pannello inventario.
- Interazione guidata per posizionamento, movimentazione, ricerca e scarico.

### Backend
- API REST (`/api/login`, `/api/utenti`, `/api/articoli`, `/api/registro`).
- Persistenza su database SQLite (`server/vasche.db`).
- Tracciamento storico con timestamp e operatore associato.

## 4. Modifiche Rispetto al Progetto Originale
## 4.1 Da Persistenza Locale a Persistenza Centralizzata
- Prima: persistenza locale browser.
- Ora: persistenza centralizzata tramite backend + SQLite.
- Vantaggio: dati condivisi tra postazioni e continuità operativa multiutente.

## 4.2 Introduzione Gestione Utenti e Login
- Login applicativo con ruoli.
- Sezione gestione utenti disponibile per `ADMIN`.
- Maggiore controllo sugli accessi e sulle responsabilità operative.

## 4.3 Planimetria Vasche Riprogettata
Le file vasche sono state allineate alla configurazione richiesta, tutte orizzontali:
- `A, B, C, D`: 6338 cm
- `E, F, G, H, I`: 3722 cm
- `L, M`: 4878 cm

La fila più lunga scala a tutta larghezza disponibile; le altre sono proporzionali.

## 4.4 Nuovo Modello Operativo "Solette"
Terminologia aggiornata: il termine "coperchi" è stato sostituito da "solette".

Gestione attuale:
- 12 pile (`P1..P12`) affiancate orizzontalmente.
- Capienza massima per pila: 10 solette.
- Rappresentazione a livelli verticali (altezza minima per singola soletta).
- Indicatori di saturazione per ogni pila (`x/10`).

## 4.5 Regole Fisiche e Vincoli Operativi Solette
- Nessuna soletta può essere "sospesa": applicazione della gravità logica.
- Il livello assegnato è sempre `numero elementi già presenti nella pila + 1`.
- Dopo ogni movimentazione, i livelli sono ricompattati automaticamente (`L1..Ln`).
- Se la pila è piena, il posizionamento viene bloccato con messaggio esplicito.

## 4.6 Workflow Guidato per Scarico/Movimentazione Solette
In caso di prelievo/spostamento di una soletta non in cima:
- Il sistema identifica le solette sovrapposte.
- L'operatore viene guidato a riposizionarle una alla volta.
- Per ogni passaggio, l'operatore sceglie la pila di destinazione tra le 12 disponibili.
- Solo al termine del riposizionamento è consentita l'azione finale (scarico o spostamento target).

Questo flusso riduce errori e rende il processo allineato alla realtà operativa di piazzale.

## 5. Funzionalità Principali Disponibili Oggi
- Planimetria interattiva per vasche, pozzetti e solette.
- Ricerca e filtro per cliente/commessa/stato.
- Posizionamento assistito con validazione disponibilità spazio.
- Movimentazione con controlli anti-sovrapposizione.
- Scarico con verifiche di impilamento.
- Registro attività completo e ordinabile.
- Gestione utenti (creazione/eliminazione) per amministratori.

## 6. Benefici per il Cliente
- Maggiore aderenza ai processi reali di stoccaggio.
- Riduzione rischio errori in movimentazione e prelievo.
- Maggiore tracciabilità e accountability operativa.
- Migliore visibilità dello stato del piazzale in tempo reale.
- Scalabilità futura su ulteriori regole o integrazioni gestionali.

## 7. Conclusione
L'evoluzione del progetto trasforma la proposta iniziale in una piattaforma operativa più robusta, strutturata e allineata alle regole pratiche del sito produttivo.

Il sistema attuale non è solo una visualizzazione della planimetria, ma uno strumento decisionale e di controllo delle movimentazioni, con particolare attenzione alla nuova logica di gestione delle solette in pile.
