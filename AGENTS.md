# Istruzioni per il progetto CARRA LogiTrack

## Deploy e aggiornamenti

- Prima di preparare un rilascio, modificare la configurazione di deploy o dare istruzioni al sistemista, leggere [docs/deploy-logitrack.md](docs/deploy-logitrack.md).
- Il riferimento operativo verificato negli scambi con Paolo Andretta (APF) è Git + Docker Compose su Linux, con database SQLite persistente su host e preservazione dei dati durante ogni aggiornamento.
- Quando è richiesto il push di un rilascio, pubblicare lo stesso commit su entrambi i repository: `origin` (Elsevier11/Carra_LOGITRACK) e `azienda` (Zerobyte-SRL/Carra_LOGITRACK), sul branch di rilascio concordato, attualmente `feature/yard-manager-multi`. Verificare lo SHA su entrambi i remoti e segnalare eventuali push parziali; non usare force push.
- Ad Andretta indicare Elsevier11 come repository di riferimento. Preparare una mail sintetica con il riepilogo concreto delle modifiche, branch e commit, richiesta di aggiornamento con la solita procedura, backup e preservazione del database, e richiesta di conferma per il collaudo cliente. Non ripetere il runbook completo salvo richiesta o cambiamenti della procedura.
- Non assumere che le istruzioni Windows/PM2, i bundle ZIP o il deploy Render descrivano l'ambiente del cliente. Usarli solo su richiesta esplicita o dopo verifica dell'ambiente di destinazione.
- Non sovrascrivere o eliminare `runtime-data`, il DB, i backup o la configurazione locale del server. Non usare `docker compose down -v` nella procedura di aggiornamento.
- Branch, percorso server e configurazione di rete riportati nel documento sono evidenze storiche: verificarli prima di un nuovo rilascio. HTTPS/reverse proxy erano previsti, ma la loro attivazione finale non è confermata dalle email esaminate.
- La preparazione di un rilascio non autorizza da sola l'esecuzione del deploy sul server o l'invio di email al sistemista.
