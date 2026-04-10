const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { hashPassword } = require('./auth');

const DB_PATH = path.join(__dirname, 'vasche.db');

function usage() {
  console.error('Uso: node reset-admin-password.js <nuova-password> [username]');
  process.exit(1);
}

const newPassword = process.argv[2];
const username = (process.argv[3] || 'admin').trim();

if (!newPassword || !username) {
  usage();
}

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Impossibile aprire il database:', err.message);
    process.exit(1);
  }
});

const hashed = hashPassword(newPassword);

db.run(
  'UPDATE utenti SET password = ? WHERE username = ?',
  [hashed, username],
  function onUpdated(err) {
    if (err) {
      console.error('Errore durante aggiornamento password:', err.message);
      process.exit(1);
    }

    if (this.changes === 0) {
      console.warn(`Nessun utente trovato con username "${username}".`);
    } else {
      console.log(`Password aggiornata con successo per "${username}".`);
    }
    db.close();
  }
);
