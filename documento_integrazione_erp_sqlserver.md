# Documento di Indirizzo Architetturale

## Oggetto

Valutazione della fattibilita' di integrazione tra la piattaforma LogiTrack e l'ERP aziendale, considerando la possibilita' di utilizzare direttamente `SQL Server` come base dati comune.

## Contesto

La piattaforma LogiTrack gestisce la movimentazione operativa di:

- `vasche`
- `solette`

L'ERP aziendale gestisce invece gli aspetti amministrativi e gestionali, inclusi:

- caricamento prodotto
- anagrafiche
- commesse
- documenti di trasporto

L'obiettivo futuro e' automatizzare almeno due eventi:

1. `Creazione automatica articolo`
   Quando il prodotto viene caricato in ERP, deve comparire automaticamente anche in LogiTrack.
2. `Scarico automatico articolo`
   Quando viene emesso il DDT al cliente, l'articolo deve essere aggiornato anche in LogiTrack.

## Domanda Architetturale

Ha senso portare tutto il progetto su `SQL Server`, usando lo stesso database dell'ERP?

## Risposta Sintetica

Si', e' una direzione sensata, ma con una precisazione fondamentale:

> Conviene usare lo stesso motore dati (`SQL Server`), ma non conviene far dipendere LogiTrack direttamente dalle tabelle operative dell'ERP.

La soluzione consigliata e':

- `stesso SQL Server`
- `schema separato per LogiTrack`
- `integrazione controllata con ERP`

## Raccomandazione

### Scelta consigliata

Adottare `SQL Server` come database unico infrastrutturale, ma mantenere una separazione logica tra:

- dominio `ERP`
- dominio `LogiTrack`

Esempio:

```text
ERP_DB
|- erp.*
|- logitrack.*
```

Oppure, se preferito:

```text
SQL Server
|- Database ERP
|- Database LogiTrack
```

La prima opzione e' generalmente piu' comoda se si vuole una forte integrazione operativa e un'amministrazione unificata.

## Perche' SQL Server e' una buona scelta

### Vantaggi

- maggiore robustezza rispetto a `SQLite`
- backup, sicurezza e gestione accessi centralizzati
- migliore supporto a concorrenza e multiutenza
- facilita' di integrazione con ERP
- possibilita' di costruire viste, procedure, report e controlli piu' evoluti
- migliore scalabilita' per evoluzioni future

## Perche' non conviene usare direttamente le tabelle ERP

Far leggere e scrivere LogiTrack direttamente sulle tabelle ERP principali sarebbe tecnicamente possibile, ma architetturalmente debole.

### Rischi principali

- forte accoppiamento tra i due sistemi
- ogni modifica al modello dati ERP puo' rompere LogiTrack
- il modello ERP raramente rappresenta bene il dominio fisico del piazzale
- regole operative come `LIFO`, `pile`, `livelli`, `gravita'`, `vincoli di movimentazione` non appartengono naturalmente all'ERP
- maggior difficolta' nel debugging e nell'assegnazione delle responsabilita'
- maggiore rischio di effetti collaterali sui processi amministrativi

## Principio corretto di separazione delle responsabilita'

La distinzione consigliata e' la seguente:

### ERP come sorgente autorevole di

- anagrafiche clienti
- commesse
- ordini
- produzione completata
- documenti di trasporto

### LogiTrack come sorgente autorevole di

- stato operativo del pezzo in piazzale
- posizione fisica
- livello nella pila
- movimenti
- log operativi
- workflow di scarico e movimentazione

## Modello Architetturale Consigliato

### Opzione consigliata

Usare `SQL Server` con schema dedicato `logitrack`.

Esempio:

```text
erp.articoli
erp.clienti
erp.commesse
erp.ddt

logitrack.articoli_operativi
logitrack.movimenti
logitrack.registro_eventi
logitrack.utenti
logitrack.integrazione_eventi
```

## Integrazione consigliata tra ERP e LogiTrack

### Creazione automatica articolo

Quando un prodotto viene creato o reso disponibile in ERP:

- ERP genera o aggiorna un record sorgente
- LogiTrack riceve l'evento o lo legge
- viene creato un articolo operativo con stato iniziale `CREATA`

Campi tipici:

- `erp_article_id`
- `codice`
- `tipo`
- `cliente`
- `commessa`
- `lunghezza`
- `stato_operativo = CREATA`

### Scarico articolo

Quando in ERP viene emesso il `DDT`:

- LogiTrack riceve una richiesta di scarico
- il backend verifica se il pezzo e' scaricabile secondo le regole fisiche
- se il pezzo e' scaricabile, lo stato passa a `SPEDITA`
- se non e' scaricabile, il sistema lo mette in stato intermedio o lo segnala all'operatore

## Punto importante sullo scarico automatico

Lo scarico automatico e' realizzabile, ma non dovrebbe essere pensato come evento cieco.

Nel caso delle `solette`, esistono vincoli reali di piazzale:

- presenza di elementi sopra il pezzo
- necessita' di riposizionamento
- capienza pile

Per questo motivo il modello migliore non e':

- `ERP dice scarica -> LogiTrack scarica sempre`

Ma piuttosto uno di questi:

### Modello A

- ERP invia richiesta di scarico
- LogiTrack esegue solo se il pezzo e' realmente scaricabile

### Modello B

- ERP marca il pezzo come `da scaricare`
- LogiTrack guida l'operatore fino al completamento

### Modello C

- ERP e LogiTrack condividono stati intermedi
  - `DA_PREPARARE`
  - `PRONTO_ALLO_SCARICO`
  - `SCARICATO`

Per il vostro contesto operativo, la scelta consigliata e':

- `Modello B` oppure `Modello C`

## Come implementarlo bene

L'integrazione dovrebbe passare da un backend applicativo, non da accessi diretti del frontend al database.

### Backend LogiTrack responsabile di

- regole di dominio
- validazioni
- controllo autorizzazioni
- audit
- gestione errori
- idempotenza sugli eventi ERP

## Idempotenza: requisito fondamentale

Se ERP invia due volte lo stesso evento:

- non devono essere creati duplicati
- non devono essere generati scarichi multipli

Per questo ogni evento ERP deve avere un identificativo univoco tracciato in una tabella tipo:

- `logitrack.integrazione_eventi`

Campi utili:

- `event_id`
- `event_type`
- `source_system`
- `payload_hash`
- `received_at`
- `processed_at`
- `status`
- `error_message`

## Cosa va evitato

### Da evitare

- frontend che legge direttamente SQL Server
- logica di movimentazione scritta in trigger ERP complessi e poco governabili
- scritture dirette sulle tabelle ERP principali per rappresentare lo stato fisico del piazzale
- dipendenza totale dal modello dati ERP

### Da preferire

- API backend dedicate
- servizi dominio backend
- schema separato `logitrack`
- integrazione tramite viste, stored procedure, job o eventi controllati

## Decisione consigliata

### Scelta raccomandata

`Migrare LogiTrack da SQLite a SQL Server`, mantenendo:

- `schema dedicato`
- `dominio applicativo separato`
- `integrazione forte ma controllata con ERP`

## Benefici della soluzione consigliata

- preparazione nativa all'automazione futura
- meno doppie registrazioni manuali
- miglior coerenza tra amministrazione e operativita'
- maggior robustezza tecnica
- minor rischio di accoppiamento pericoloso
- possibilita' di evolvere la piattaforma senza dipendere interamente dalla struttura ERP

## Conclusione

Portare LogiTrack su `SQL Server` e' una scelta corretta e consigliabile.

La scelta migliore non e' usare direttamente il modello ERP come base unica di tutta la logica operativa, ma:

- usare la stessa infrastruttura dati
- tenere separato il dominio LogiTrack
- integrare ERP e LogiTrack tramite regole e servizi ben definiti

In sintesi:

- `si' a SQL Server`
- `si' alla vicinanza con ERP`
- `no all'accoppiamento diretto alle tabelle ERP operative`

Questa e' la soluzione piu' solida sia per l'adozione interna sia per le evoluzioni future.
