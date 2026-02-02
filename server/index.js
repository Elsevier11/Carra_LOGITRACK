const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// --- AUTH API ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT id, username, ruolo FROM utenti WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.json({ success: true, user: row });
        } else {
            res.status(401).json({ success: false, message: 'Credenziali non valide' });
        }
    });
});

// Get all users
app.get('/api/utenti', (req, res) => {
    db.all("SELECT id, username, ruolo, password FROM utenti", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new user
app.post('/api/utenti', (req, res) => {
    const { username, password, ruolo } = req.body;
    const id = uuidv4();
    const sql = `INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)`;
    const params = [id, username, password, ruolo];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id, message: 'Utente creato correttamente' });
    });
});

// Delete a user
app.delete('/api/utenti/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM utenti WHERE id = ?', id, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Utente eliminato correttamente' });
    });
});

// --- API VASCHE ---

// Get all vasche
app.get('/api/vasche', (req, res) => {
    db.all("SELECT * FROM vasche", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => ({
            id: row.id,
            codice: row.codice,
            cliente: row.cliente,
            commessa: row.commessa,
            lunghezza: row.lunghezza,
            posizione: row.posizione,
            fila: row.fila,
            offsetInizio: row.offset_inizio,
            colore: row.colore,
            stato: row.stato,
            dataCreazione: row.data_creazione
        })));
    });
});

// Create a new vasca
app.post('/api/vasche', (req, res) => {
    const { id, codice, cliente, commessa, lunghezza, colore, stato, dataCreazione } = req.body;

    // Check if codice already exists
    db.get("SELECT id FROM vasche WHERE codice = ?", [codice], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (row) {
            res.status(409).json({ error: `Il codice vasca '${codice}' esiste già.` });
            return;
        }

        const sql = `INSERT INTO vasche (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, colore, stato, data_creazione) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [id, codice, cliente, commessa, lunghezza, null, null, null, colore, stato, dataCreazione];

        db.run(sql, params, function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({ id: id, message: 'Vasca creata correttamente' });
        });
    });
});

// Update a vasca (position, state, etc)
app.put('/api/vasche/:id', (req, res) => {
    const { id } = req.params;
    const { posizione, fila, offsetInizio, stato } = req.body;

    // Build dynamic update query
    let sql = 'UPDATE vasche SET ';
    let params = [];

    if (posizione !== undefined) {
        sql += 'posizione = ?, ';
        params.push(posizione);
    }
    if (stato !== undefined) {
        sql += 'stato = ?, ';
        params.push(stato);
    }
    if (fila !== undefined) {
        sql += 'fila = ?, ';
        params.push(fila);
    }
    if (offsetInizio !== undefined) {
        sql += 'offset_inizio = ?, ';
        params.push(offsetInizio);
    }

    sql = sql.slice(0, -2); // Remove last comma
    sql += ' WHERE id = ?';
    params.push(id);

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Vasca aggiornata correttamente' });
    });
});

// Delete a vasca
app.delete('/api/vasche/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM vasche WHERE id = ?', id, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Vasca eliminata correttamente' });
    });
});

// --- API REGISTRO ---

// Get all logs
app.get('/api/registro', (req, res) => {
    db.all("SELECT * FROM registro ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // Convert underscore names to camelCase if needed, but let's keep them as is and adjust frontend
        res.json(rows.map(row => ({
            id: row.id,
            tipo: row.tipo,
            vascaId: row.vasca_id,
            vascaCodice: row.vasca_codice,
            vascaColore: row.vasca_colore,
            dettagli: row.dettagli,
            utenteNome: row.utente_nome,
            timestamp: row.timestamp
        })));
    });
});

// Create a log entry
app.post('/api/registro', (req, res) => {
    const { id, tipo, vascaId, vascaCodice, vascaColore, dettagli, utenteNome, timestamp } = req.body;
    const sql = `INSERT INTO registro (id, tipo, vasca_id, vasca_codice, vasca_colore, dettagli, utente_nome, timestamp) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [id, tipo, vascaId, vascaCodice, vascaColore, dettagli, utenteNome, timestamp];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id: id, message: 'Log creato correttamente' });
    });
});

// Clear log
app.delete('/api/registro', (req, res) => {
    db.run('DELETE FROM registro', [], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Log svuotato correttamente' });
    });
});

app.listen(port, () => {
    console.log(`Backend server in ascolto su http://localhost:${port}`);
});
