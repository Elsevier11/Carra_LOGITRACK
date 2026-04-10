const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'vasche.db');
const db = new sqlite3.Database(dbPath);

console.log('Inizio migrazione articoli...');

db.serialize(() => {
    // 1. Rinomina tabella da vasche a articoli
    db.run("ALTER TABLE vasche RENAME TO articoli", (err) => {
        if (err) {
            if (err.message.includes('no such table: vasche')) {
                console.log('Tabella "vasche" già rinominata o assente.');
            } else {
                console.error('Errore rinomina tabella:', err.message);
            }
        } else {
            console.log('Tabella rinominata in "articoli".');
        }

        addColumns();
    });

    function addColumns() {
        db.run("ALTER TABLE articoli ADD COLUMN tipo TEXT DEFAULT 'VASCA'", (err) => {
            if (err && !err.message.includes('duplicate column')) console.error('Errore tipo:', err.message);
            else console.log('Colonna "tipo" pronta.');
        });

        db.run("ALTER TABLE articoli ADD COLUMN livello INTEGER DEFAULT 1", (err) => {
            if (err && !err.message.includes('duplicate column')) console.error('Errore livello:', err.message);
            else console.log('Colonna "livello" pronta.');
        });

        db.run("UPDATE articoli SET tipo = 'VASCA' WHERE tipo IS NULL", (err) => {
            if (err) console.error('Errore update tipo:', err.message);
            else console.log('Dati esistenti marcati come VASCA.');

            db.run("UPDATE articoli SET tipo = 'SOLETTA' WHERE tipo = 'COPERCHIO'", (legacyErr) => {
                if (legacyErr) console.error('Errore update COPERCHIO:', legacyErr.message);
            });

            db.run("UPDATE articoli SET tipo = 'VASCA', stato = 'SPEDITA', posizione = NULL, fila = NULL, offset_inizio = NULL, livello = 1 WHERE tipo NOT IN ('VASCA', 'SOLETTA')", (legacyErr) => {
                if (legacyErr) console.error('Errore update tipi legacy:', legacyErr.message);
            });

            db.close((err) => {
                if (err) console.error(err.message);
                console.log('Migrazione articoli completata.');
            });
        });
    }
});
