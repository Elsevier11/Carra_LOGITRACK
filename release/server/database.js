const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { hashPassword, isPasswordHash } = require('./auth');

const dbPath = path.resolve(__dirname, 'vasche.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Errore durante la connessione al database SQLite:', err.message);
    } else {
        console.log('Connesso al database SQLite.');
        initializeSchema();
    }
});

function initializeSchema() {
    db.serialize(() => {
        // Tabella Utenti
        db.run(`CREATE TABLE IF NOT EXISTS utenti (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      ruolo TEXT NOT NULL
    )`);

        // Inizializza utenti di default se la tabella è vuota
        db.get("SELECT count(*) as count FROM utenti", (err, row) => {
            if (row && row.count === 0) {
                db.run("INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)", ['1', 'admin', hashPassword('admin123'), 'ADMIN']);
                db.run("INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)", ['2', 'operatore1', hashPassword('op123'), 'OPERATORE']);
                console.log('Utenti di default creati.');
            }
        });

        // Tabella Articoli (Ex Vasche)
        db.run(`CREATE TABLE IF NOT EXISTS articoli (
      id TEXT PRIMARY KEY,
      codice TEXT UNIQUE NOT NULL,
      cliente TEXT NOT NULL,
      commessa TEXT NOT NULL,
      lunghezza REAL NOT NULL,
      posizione TEXT,
      fila TEXT,
      offset_inizio REAL,
      tipo TEXT NOT NULL DEFAULT 'VASCA',
      livello INTEGER DEFAULT 1,
      dim_base INTEGER,
      colore TEXT NOT NULL,
      stato TEXT NOT NULL,
      data_creazione TEXT NOT NULL
    )`);

        // Tabella Registro (con colonna utente_nome)
        db.run(`CREATE TABLE IF NOT EXISTS registro (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      vasca_id TEXT,
      vasca_codice TEXT,
      vasca_colore TEXT,
      dettagli TEXT,
      utente_nome TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (vasca_id) REFERENCES articoli (id)
    )`);

        ensureColumnExists('registro', 'utente_nome', 'TEXT');
        normalizeLegacyArticoli();
        migrateLegacyPasswords();

        console.log('Schema del database inizializzato.');
    });
}

function ensureColumnExists(tableName, columnName, columnDef) {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) {
            console.error(`Errore controllo schema ${tableName}:`, err.message);
            return;
        }

        const hasColumn = (columns || []).some(c => c.name === columnName);
        if (hasColumn) return;

        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (alterErr) => {
            if (alterErr) {
                console.error(`Errore migrazione ${tableName}.${columnName}:`, alterErr.message);
                return;
            }
            console.log(`Migrazione completata: aggiunta colonna ${tableName}.${columnName}`);
        });
    });
}

function normalizeLegacyArticoli() {
    db.run(
        `UPDATE articoli
         SET tipo = 'SOLETTA'
         WHERE tipo = 'COPERCHIO'`,
        (err) => {
            if (err) {
                console.error('Errore normalizzazione COPERCHIO:', err.message);
            }
        }
    );

    db.run(
        `UPDATE articoli
         SET tipo = 'VASCA',
             stato = 'SPEDITA',
             posizione = NULL,
             fila = NULL,
             offset_inizio = NULL,
             livello = 1,
             dim_base = NULL
         WHERE tipo NOT IN ('VASCA', 'SOLETTA')`,
        (err) => {
            if (err) {
                console.error('Errore archiviazione tipi legacy:', err.message);
            }
        }
    );
}

function migrateLegacyPasswords() {
    db.all('SELECT id, username, password FROM utenti', (err, rows) => {
        if (err) {
            console.error('Errore migrazione password utenti:', err.message);
            return;
        }

        (rows || []).forEach((user) => {
            if (!user.password || isPasswordHash(user.password)) return;

            db.run(
                'UPDATE utenti SET password = ? WHERE id = ?',
                [hashPassword(user.password), user.id],
                (updateErr) => {
                    if (updateErr) {
                        console.error(`Errore hashing password utente ${user.username}:`, updateErr.message);
                    }
                }
            );
        });
    });
}

module.exports = db;
