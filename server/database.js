const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { hashPassword, isPasswordHash } = require('./auth');

const dbPath = process.env.LOGITRACK_DB_PATH
    ? path.resolve(process.env.LOGITRACK_DB_PATH)
    : path.resolve(__dirname, 'vasche.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Errore durante la connessione al database SQLite:', err.message);
    } else {
        console.log('Connesso al database SQLite.');
        initializeSchema().catch((schemaErr) => {
            console.error('Errore inizializzazione schema:', schemaErr.message);
        });
    }
});

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(this);
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row || null);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows || []);
        });
    });
}

async function tableExists(tableName) {
    const row = await getAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]);
    return !!row;
}

async function getPendingMigrations(migrations) {
    const hasMigrationTable = await tableExists('schema_migrations');
    if (!hasMigrationTable) {
        return migrations;
    }
    const rows = await allAsync('SELECT id FROM schema_migrations ORDER BY id ASC');
    const done = new Set(rows.map((row) => row.id));
    return migrations.filter((migration) => !done.has(migration.id));
}

async function backupDatabaseFile() {
    if (!fs.existsSync(dbPath)) return;
    const backupDir = path.resolve(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const safeStamp = new Date().toISOString().replace(/[.:]/g, '-');
    const backupPath = path.join(backupDir, `vasche-${safeStamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backup DB creato: ${backupPath}`);
}

async function migrationNormalizeAndConvertToCm() {
    const hasVasche = await tableExists('vasche');
    const hasArticoli = await tableExists('articoli');

    if (hasVasche && !hasArticoli) {
        await runAsync('ALTER TABLE vasche RENAME TO articoli');
    }

    if (!await tableExists('articoli')) {
        await runAsync(`CREATE TABLE articoli (
          id TEXT PRIMARY KEY,
          codice TEXT NOT NULL,
          cliente TEXT NOT NULL,
          commessa TEXT NOT NULL,
          lunghezza INTEGER NOT NULL,
          posizione TEXT,
          fila TEXT,
          offset_inizio INTEGER,
          tipo TEXT NOT NULL DEFAULT 'VASCA',
          livello INTEGER DEFAULT 1,
          colore TEXT NOT NULL,
          stato TEXT NOT NULL,
          data_creazione TEXT NOT NULL,
          altezza_vasca_cm INTEGER,
          lunghezza_soletta_cm INTEGER,
          altezza_soletta_cm INTEGER
        )`);
        return;
    }

    const schemaRow = await getAsync("SELECT sql FROM sqlite_master WHERE type='table' AND name='articoli'");
    const tableSql = (schemaRow?.sql || '').toUpperCase();
    const hasUniqueCodice = tableSql.includes('CODICE TEXT UNIQUE');
    const info = await allAsync('PRAGMA table_info(articoli)');
    const hasAltezzaVasca = info.some((c) => c.name === 'altezza_vasca_cm');
    const hasLunghezzaSoletta = info.some((c) => c.name === 'lunghezza_soletta_cm');
    const hasAltezzaSoletta = info.some((c) => c.name === 'altezza_soletta_cm');

    const shouldRebuild = hasUniqueCodice || !hasAltezzaVasca || !hasLunghezzaSoletta || !hasAltezzaSoletta;
    if (!shouldRebuild) {
        // Conversione eventuale metri -> cm su installazioni gia' migrate a livello schema.
        const stats = await getAsync('SELECT MAX(ABS(lunghezza)) AS max_lunghezza FROM articoli');
        const unitFactor = (stats?.max_lunghezza || 0) <= 100 ? 100 : 1;
        if (unitFactor === 100) {
            await runAsync('UPDATE articoli SET lunghezza = CAST(ROUND(lunghezza * 100) AS INTEGER)');
            await runAsync('UPDATE articoli SET offset_inizio = CAST(ROUND(offset_inizio * 100) AS INTEGER) WHERE offset_inizio IS NOT NULL');
        }
        await runAsync("UPDATE articoli SET tipo = 'SOLETTA' WHERE tipo = 'COPERCHIO'");
        await runAsync(`UPDATE articoli
            SET tipo = 'VASCA',
                stato = 'SPEDITA',
                posizione = NULL,
                fila = NULL,
                offset_inizio = NULL,
                livello = 1
            WHERE tipo NOT IN ('VASCA', 'SOLETTA')`);
        await runAsync("UPDATE articoli SET lunghezza_soletta_cm = lunghezza WHERE tipo = 'SOLETTA' AND (lunghezza_soletta_cm IS NULL OR lunghezza_soletta_cm <= 0)");
        return;
    }

    const stats = await getAsync('SELECT MAX(ABS(lunghezza)) AS max_lunghezza FROM articoli');
    const unitFactor = (stats?.max_lunghezza || 0) <= 100 ? 100 : 1;

    await runAsync(`CREATE TABLE articoli_new (
      id TEXT PRIMARY KEY,
      codice TEXT NOT NULL,
      cliente TEXT NOT NULL,
      commessa TEXT NOT NULL,
      lunghezza INTEGER NOT NULL,
      posizione TEXT,
      fila TEXT,
      offset_inizio INTEGER,
      tipo TEXT NOT NULL DEFAULT 'VASCA',
      livello INTEGER DEFAULT 1,
      colore TEXT NOT NULL,
      stato TEXT NOT NULL,
      data_creazione TEXT NOT NULL,
      altezza_vasca_cm INTEGER,
      lunghezza_soletta_cm INTEGER,
      altezza_soletta_cm INTEGER
    )`);

    await runAsync(
        `INSERT INTO articoli_new (
            id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio,
            tipo, livello, colore, stato, data_creazione, altezza_vasca_cm,
            lunghezza_soletta_cm, altezza_soletta_cm
        )
        SELECT
            id,
            codice,
            cliente,
            commessa,
            CAST(ROUND(COALESCE(lunghezza, 0) * ?) AS INTEGER) AS lunghezza_cm,
            posizione,
            fila,
            CASE WHEN offset_inizio IS NULL THEN NULL ELSE CAST(ROUND(offset_inizio * ?) AS INTEGER) END,
            CASE
                WHEN tipo = 'COPERCHIO' THEN 'SOLETTA'
                WHEN tipo IN ('VASCA', 'SOLETTA') THEN tipo
                ELSE 'VASCA'
            END,
            COALESCE(livello, 1),
            colore,
            CASE
                WHEN tipo IN ('VASCA', 'SOLETTA', 'COPERCHIO') THEN stato
                ELSE 'SPEDITA'
            END,
            data_creazione,
            NULL,
            CASE WHEN (tipo = 'SOLETTA' OR tipo = 'COPERCHIO') THEN CAST(ROUND(COALESCE(lunghezza, 0) * ?) AS INTEGER) ELSE NULL END,
            NULL
        FROM articoli`,
        [unitFactor, unitFactor, unitFactor]
    );

    await runAsync('DROP TABLE articoli');
    await runAsync('ALTER TABLE articoli_new RENAME TO articoli');
    await runAsync("UPDATE articoli SET lunghezza_soletta_cm = lunghezza WHERE tipo = 'SOLETTA' AND (lunghezza_soletta_cm IS NULL OR lunghezza_soletta_cm <= 0)");
    await runAsync(
        `UPDATE articoli
         SET posizione = CASE
             WHEN stato = 'IN_AREA' AND tipo = 'SOLETTA' AND fila IS NOT NULL THEN fila || ' @ Pila (L' || livello || ')'
             WHEN stato = 'IN_AREA' AND tipo = 'VASCA' AND fila IS NOT NULL AND offset_inizio IS NOT NULL THEN fila || ' @ ' || offset_inizio || 'cm (L' || livello || ')'
             ELSE posizione
         END`
    );
}

async function migrationRegistroDualDates() {
    if (!await tableExists('registro')) {
        await runAsync(`CREATE TABLE registro (
          id TEXT PRIMARY KEY,
          tipo TEXT NOT NULL,
          vasca_id TEXT,
          vasca_codice TEXT,
          vasca_colore TEXT,
          dettagli TEXT,
          utente_nome TEXT,
          timestamp INTEGER,
          recorded_at INTEGER NOT NULL,
          event_at INTEGER NOT NULL,
          FOREIGN KEY (vasca_id) REFERENCES articoli (id)
        )`);
        return;
    }

    const columns = await allAsync('PRAGMA table_info(registro)');
    const names = new Set(columns.map((col) => col.name));

    if (!names.has('timestamp')) {
        await runAsync('ALTER TABLE registro ADD COLUMN timestamp INTEGER');
    }
    if (!names.has('recorded_at')) {
        await runAsync('ALTER TABLE registro ADD COLUMN recorded_at INTEGER');
    }
    if (!names.has('event_at')) {
        await runAsync('ALTER TABLE registro ADD COLUMN event_at INTEGER');
    }

    await runAsync('UPDATE registro SET recorded_at = COALESCE(recorded_at, timestamp, CAST(strftime(\'%s\',\'now\') AS INTEGER) * 1000)');
    await runAsync('UPDATE registro SET event_at = COALESCE(event_at, recorded_at)');
    await runAsync('UPDATE registro SET timestamp = COALESCE(timestamp, recorded_at)');
}

async function ensureBaseTables() {
    await runAsync(`CREATE TABLE IF NOT EXISTS utenti (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      ruolo TEXT NOT NULL
    )`);

    await runAsync(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`);
}

async function seedDefaultUsers() {
    const row = await getAsync('SELECT count(*) as count FROM utenti');
    if (row && row.count === 0) {
        await runAsync('INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)', ['1', 'admin', hashPassword('admin123'), 'ADMIN']);
        await runAsync('INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)', ['2', 'operatore1', hashPassword('op123'), 'OPERATORE']);
        console.log('Utenti di default creati.');
    }
}

async function migrateLegacyPasswords() {
    const rows = await allAsync('SELECT id, username, password FROM utenti');
    for (const user of rows) {
        if (!user.password || isPasswordHash(user.password)) continue;
        await runAsync('UPDATE utenti SET password = ? WHERE id = ?', [hashPassword(user.password), user.id]);
    }
}

async function runMigrations() {
    const migrations = [
        { id: '2026-04-09-001-articoli-cm', up: migrationNormalizeAndConvertToCm },
        { id: '2026-04-09-002-registro-dual-dates', up: migrationRegistroDualDates }
    ];

    const pending = await getPendingMigrations(migrations);
    if (pending.length === 0) return;

    await backupDatabaseFile();

    for (const migration of pending) {
        await migration.up();
        await runAsync('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [migration.id, new Date().toISOString()]);
        console.log(`Migrazione completata: ${migration.id}`);
    }
}

async function initializeSchema() {
    try {
        await ensureBaseTables();
        await runMigrations();
        await seedDefaultUsers();
        await migrateLegacyPasswords();
        console.log('Schema del database inizializzato.');
    } catch (err) {
        console.error('Errore durante inizializzazione schema:', err.message);
    }
}

module.exports = db;
