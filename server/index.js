const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { mutateArticleState } = require('./articleService');
const {
    SESSION_COOKIE_NAME,
    createSessionToken,
    hashPassword,
    parseCookies,
    serializeClearedSessionCookie,
    serializeSessionCookie,
    verifyPassword,
    verifySessionToken
} = require('./auth');

const app = express();
const port = Number(process.env.PORT || 3001);
const distPath = path.resolve(__dirname, '..', 'dist');
const SUPPORTED_ARTICLE_TYPES = new Set(['VASCA', 'SOLETTA']);
const SUPPORTED_ARTICLE_STATES = new Set(['CREATA', 'IN_AREA', 'SPEDITA']);
const SUPPORTED_USER_ROLES = new Set(['ADMIN', 'OPERATORE']);
const defaultAllowedOrigins = [
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://192.168.1.88:3001',
];
const configuredAllowedOrigins = (process.env.LOGITRACK_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = new Set([
    ...defaultAllowedOrigins,
    ...configuredAllowedOrigins
]);

app.disable('x-powered-by');
app.use('/api', cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Origin non consentita'));
    },
    credentials: true
}));
app.use(bodyParser.json());

app.use((req, _res, next) => {
    if (req.path !== '/api/health') {
        console.info(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

app.use((req, _res, next) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionToken = cookies[SESSION_COOKIE_NAME];
    req.user = verifySessionToken(sessionToken);
    next();
});

function sanitizeUser(row) {
    return {
        id: row.id,
        username: row.username,
        ruolo: row.ruolo
    };
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeNullableString(value) {
    if (value === undefined || value === null || value === '') return null;
    return String(value);
}

function sendValidationError(res, message) {
    return res.status(400).json({ error: message });
}

function sendAuthError(res) {
    return res.status(401).json({ error: 'Autenticazione richiesta' });
}

function requireAuth(req, res, next) {
    if (!req.user) {
        return sendAuthError(res);
    }
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user) {
            return sendAuthError(res);
        }
        if (req.user.ruolo !== role) {
            return res.status(403).json({ error: 'Permessi insufficienti' });
        }
        next();
    };
}

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'logitrack-backend',
        timestamp: new Date().toISOString()
    });
});

// --- AUTH API ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return sendValidationError(res, 'Username e password sono obbligatori');
    }

    db.get('SELECT id, username, ruolo, password FROM utenti WHERE username = ?', [username.trim()], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row || !verifyPassword(password, row.password)) {
            res.status(401).json({ success: false, message: 'Credenziali non valide' });
            return;
        }

        const user = sanitizeUser(row);
        res.setHeader('Set-Cookie', serializeSessionCookie(createSessionToken(user)));
        res.json({ success: true, user });
    });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({ success: true, user: req.user });
});

app.post('/api/logout', requireAuth, (_req, res) => {
    res.setHeader('Set-Cookie', serializeClearedSessionCookie());
    res.json({ success: true });
});

// Get all users
app.get('/api/utenti', requireRole('ADMIN'), (_req, res) => {
    db.all('SELECT id, username, ruolo FROM utenti ORDER BY username ASC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new user
app.post('/api/utenti', requireRole('ADMIN'), (req, res) => {
    const { username, password, ruolo } = req.body;
    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return sendValidationError(res, 'Username e password sono obbligatori');
    }
    if (!SUPPORTED_USER_ROLES.has(ruolo)) {
        return sendValidationError(res, 'Ruolo non valido');
    }

    const id = uuidv4();
    const sql = 'INSERT INTO utenti (id, username, password, ruolo) VALUES (?, ?, ?, ?)';
    const params = [id, username.trim(), hashPassword(password), ruolo];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id, message: 'Utente creato correttamente' });
    });
});

// Delete a user
app.delete('/api/utenti/:id', requireRole('ADMIN'), (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM utenti WHERE id = ?', id, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Utente eliminato correttamente' });
    });
});

// --- API ARTICOLI ---

app.get('/api/articoli', requireAuth, (_req, res) => {
    db.all("SELECT * FROM articoli WHERE tipo IN ('VASCA', 'SOLETTA') OR tipo = 'COPERCHIO'", [], (err, rows) => {
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
            tipo: row.tipo === 'COPERCHIO' ? 'SOLETTA' : row.tipo,
            livello: row.livello,
            colore: row.colore,
            stato: row.stato,
            dataCreazione: row.data_creazione,
            altezzaVascaCm: row.altezza_vasca_cm,
            lunghezzaSolettaCm: row.lunghezza_soletta_cm,
            altezzaSolettaCm: row.altezza_soletta_cm
        })));
    });
});

app.post('/api/articoli', requireAuth, (req, res) => {
    const {
        id, codice, cliente, commessa, lunghezza, colore, stato, dataCreazione, fila, offsetInizio, tipo, livello,
        altezzaVascaCm, lunghezzaSolettaCm, altezzaSolettaCm
    } = req.body;
    const normalizedType = SUPPORTED_ARTICLE_TYPES.has(tipo) ? tipo : 'VASCA';
    const normalizedState = SUPPORTED_ARTICLE_STATES.has(stato) ? stato : 'CREATA';

    if (!isNonEmptyString(id)) return sendValidationError(res, 'ID mancante');
    if (!isNonEmptyString(codice) || !isNonEmptyString(cliente) || !isNonEmptyString(commessa)) {
        return sendValidationError(res, 'Campi articolo obbligatori mancanti');
    }
    if (typeof lunghezza !== 'number' || Number.isNaN(lunghezza) || lunghezza <= 0 || !Number.isInteger(lunghezza)) {
        return sendValidationError(res, 'Lunghezza non valida (usa centimetri interi)');
    }
    if (altezzaVascaCm !== undefined && altezzaVascaCm !== null && (!Number.isInteger(altezzaVascaCm) || altezzaVascaCm <= 0)) {
        return sendValidationError(res, 'Altezza vasca non valida');
    }
    if (lunghezzaSolettaCm !== undefined && lunghezzaSolettaCm !== null && (!Number.isInteger(lunghezzaSolettaCm) || lunghezzaSolettaCm <= 0)) {
        return sendValidationError(res, 'Lunghezza soletta non valida');
    }
    if (altezzaSolettaCm !== undefined && altezzaSolettaCm !== null && (!Number.isInteger(altezzaSolettaCm) || altezzaSolettaCm <= 0)) {
        return sendValidationError(res, 'Altezza soletta non valida');
    }
    if (!isNonEmptyString(colore) || !isNonEmptyString(dataCreazione)) {
        return sendValidationError(res, 'Colore o data creazione mancanti');
    }

    const sql = `INSERT INTO articoli (
        id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione,
        altezza_vasca_cm, lunghezza_soletta_cm, altezza_soletta_cm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        id,
        codice.trim(),
        cliente.trim(),
        commessa.trim(),
        lunghezza,
        null,
        normalizeNullableString(fila),
        offsetInizio ?? null,
        normalizedType,
        livello || 1,
        colore,
        normalizedState,
        dataCreazione,
        normalizedType === 'VASCA' ? (altezzaVascaCm ?? null) : null,
        normalizedType === 'SOLETTA' ? (lunghezzaSolettaCm ?? lunghezza) : null,
        normalizedType === 'SOLETTA' ? (altezzaSolettaCm ?? null) : null
    ];

    db.run(sql, params, function (insertErr) {
        if (insertErr) {
            res.status(500).json({ error: insertErr.message });
            return;
        }
        res.status(201).json({ id, message: 'Elemento creato correttamente' });
    });
});
app.put('/api/articoli/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const {
        posizione, fila, offsetInizio, stato, livello, codice, cliente, commessa,
        altezzaVascaCm, lunghezzaSolettaCm, altezzaSolettaCm
    } = req.body;
    const metadataPatch = {};
    const hasStatePatch = posizione !== undefined || fila !== undefined || offsetInizio !== undefined || stato !== undefined || livello !== undefined;
    const hasMetadataPatch =
        codice !== undefined || cliente !== undefined || commessa !== undefined ||
        altezzaVascaCm !== undefined || lunghezzaSolettaCm !== undefined || altezzaSolettaCm !== undefined;

    if (stato !== undefined && !SUPPORTED_ARTICLE_STATES.has(stato)) {
        return sendValidationError(res, 'Stato non valido');
    }
    if (offsetInizio !== undefined && offsetInizio !== null && (typeof offsetInizio !== 'number' || Number.isNaN(offsetInizio) || offsetInizio < 0 || !Number.isInteger(offsetInizio))) {
        return sendValidationError(res, 'Offset non valido');
    }
    if (livello !== undefined && (typeof livello !== 'number' || Number.isNaN(livello) || livello < 0)) {
        return sendValidationError(res, 'Livello non valido');
    }
    if (codice !== undefined) {
        if (!isNonEmptyString(codice)) return sendValidationError(res, 'Codice non valido');
        metadataPatch.codice = codice.trim();
    }
    if (cliente !== undefined) {
        if (!isNonEmptyString(cliente)) return sendValidationError(res, 'Cliente non valido');
        metadataPatch.cliente = cliente.trim();
    }
    if (commessa !== undefined) {
        if (!isNonEmptyString(commessa)) return sendValidationError(res, 'Commessa non valida');
        metadataPatch.commessa = commessa.trim();
    }
    if (altezzaVascaCm !== undefined) {
        if (altezzaVascaCm !== null && (!Number.isInteger(altezzaVascaCm) || altezzaVascaCm <= 0)) return sendValidationError(res, 'Altezza vasca non valida');
        metadataPatch.altezza_vasca_cm = altezzaVascaCm;
    }
    if (lunghezzaSolettaCm !== undefined) {
        if (lunghezzaSolettaCm !== null && (!Number.isInteger(lunghezzaSolettaCm) || lunghezzaSolettaCm <= 0)) return sendValidationError(res, 'Lunghezza soletta non valida');
        metadataPatch.lunghezza_soletta_cm = lunghezzaSolettaCm;
    }
    if (altezzaSolettaCm !== undefined) {
        if (altezzaSolettaCm !== null && (!Number.isInteger(altezzaSolettaCm) || altezzaSolettaCm <= 0)) return sendValidationError(res, 'Altezza soletta non valida');
        metadataPatch.altezza_soletta_cm = altezzaSolettaCm;
    }

    if (!hasStatePatch && !hasMetadataPatch) {
        return sendValidationError(res, 'Nessun campo da aggiornare');
    }

    const sendUpdatedArticle = () => {
        db.get('SELECT * FROM articoli WHERE id = ?', [id], (getErr, row) => {
            if (getErr) {
                res.status(500).json({ error: getErr.message });
                return;
            }
            if (!row) {
                res.status(404).json({ error: 'Articolo non trovato' });
                return;
            }
            res.json({ message: 'Elemento aggiornato correttamente', articolo: row });
        });
    };

    const applyMetadataPatch = () => {
        const entries = Object.entries(metadataPatch);
        if (entries.length === 0) {
            sendUpdatedArticle();
            return;
        }

        const setClause = entries.map(([field]) => `${field} = ?`).join(', ');
        const values = entries.map(([, value]) => value);
        db.run(`UPDATE articoli SET ${setClause} WHERE id = ?`, [...values, id], function (updateErr) {
            if (updateErr) {
                res.status(500).json({ error: updateErr.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Articolo non trovato' });
                return;
            }
            sendUpdatedArticle();
        });
    };

    const runStatePatch = () => {
        if (!hasStatePatch) {
            applyMetadataPatch();
            return;
        }

        mutateArticleState(db, id, {
            posizione,
            fila: fila !== undefined ? normalizeNullableString(fila) : undefined,
            offsetInizio,
            stato,
            livello
        })
            .then((result) => {
                if (result.error) {
                    res.status(result.status || 400).json({ error: result.error });
                    return;
                }
                applyMetadataPatch();
            })
            .catch((err) => {
                res.status(500).json({ error: err.message });
            });
    };

    runStatePatch();
});
app.post('/api/articoli/:id/position', requireAuth, (req, res) => {
    const { id } = req.params;
    const { fila, offsetInizio } = req.body;
    if (!isNonEmptyString(fila)) return sendValidationError(res, 'Fila obbligatoria');
    if (typeof offsetInizio !== 'number' || Number.isNaN(offsetInizio) || offsetInizio < 0 || !Number.isInteger(offsetInizio)) {
        return sendValidationError(res, 'Offset non valido');
    }

    mutateArticleState(db, id, {
        fila,
        offsetInizio,
        stato: 'IN_AREA'
    })
        .then((result) => {
            if (result.error) {
                res.status(result.status || 400).json({ error: result.error });
                return;
            }
            res.json({ message: 'Articolo posizionato correttamente', articolo: result.article });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
});

app.post('/api/articoli/:id/move', requireAuth, (req, res) => {
    const { id } = req.params;
    const { fila, offsetInizio } = req.body;
    if (!isNonEmptyString(fila)) return sendValidationError(res, 'Fila obbligatoria');
    if (typeof offsetInizio !== 'number' || Number.isNaN(offsetInizio) || offsetInizio < 0 || !Number.isInteger(offsetInizio)) {
        return sendValidationError(res, 'Offset non valido');
    }

    mutateArticleState(db, id, {
        fila,
        offsetInizio,
        stato: 'IN_AREA'
    })
        .then((result) => {
            if (result.error) {
                res.status(result.status || 400).json({ error: result.error });
                return;
            }
            res.json({ message: 'Articolo spostato correttamente', articolo: result.article });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
});

app.post('/api/articoli/:id/ship', requireAuth, (req, res) => {
    const { id } = req.params;
    mutateArticleState(db, id, {
        posizione: null,
        fila: null,
        offsetInizio: null,
        stato: 'SPEDITA',
        livello: 0
    })
        .then((result) => {
            if (result.error) {
                res.status(result.status || 400).json({ error: result.error });
                return;
            }
            res.json({ message: 'Articolo scaricato correttamente', articolo: result.article });
        })
        .catch((err) => res.status(500).json({ error: err.message }));
});

app.delete('/api/articoli/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.get('SELECT id, codice, stato FROM articoli WHERE id = ?', [id], (getErr, article) => {
        if (getErr) {
            res.status(500).json({ error: getErr.message });
            return;
        }
        if (!article) {
            res.status(404).json({ error: 'Articolo non trovato' });
            return;
        }
        if (article.stato !== 'CREATA') {
            res.status(400).json({ error: 'Cancellazione consentita solo per articoli non ancora movimentati (stato CREATA)' });
            return;
        }

        db.get(
            `SELECT COUNT(*) AS total
             FROM registro
             WHERE vasca_id = ?
               AND tipo IN ('ENTRATA', 'SPOSTAMENTO', 'MOVIMENTAZIONE', 'USCITA', 'SPEDIZIONE')`,
            [id],
            (logErr, row) => {
                if (logErr) {
                    res.status(500).json({ error: logErr.message });
                    return;
                }
                if ((row?.total || 0) > 0) {
                    res.status(400).json({ error: 'Articolo gia movimentato: cancellazione non consentita' });
                    return;
                }

                db.run('DELETE FROM articoli WHERE id = ?', id, function (deleteErr) {
                    if (deleteErr) {
                        res.status(500).json({ error: deleteErr.message });
                        return;
                    }
                    res.json({ message: `Articolo ${article.codice} eliminato correttamente` });
                });
            }
        );
    });
});
// --- API REGISTRO ---

app.get('/api/registro', requireAuth, (_req, res) => {
    db.all('SELECT * FROM registro ORDER BY recorded_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.map(row => ({
            id: row.id,
            tipo: row.tipo,
            vascaId: row.vasca_id,
            vascaCodice: row.vasca_codice,
            vascaColore: row.vasca_colore,
            dettagli: row.dettagli,
            utenteNome: row.utente_nome,
            timestamp: row.recorded_at || row.timestamp,
            recordedAt: row.recorded_at || row.timestamp,
            eventAt: row.event_at || row.recorded_at || row.timestamp
        })));
    });
});

app.post('/api/registro', requireAuth, (req, res) => {
    const { id, tipo, vascaId, vascaCodice, vascaColore, dettagli, utenteNome, eventAt } = req.body;
    if (!isNonEmptyString(id) || !isNonEmptyString(tipo) || !isNonEmptyString(vascaCodice) || !isNonEmptyString(vascaColore) || !isNonEmptyString(dettagli)) {
        return sendValidationError(res, 'Dati log incompleti');
    }
    if (eventAt !== undefined && (typeof eventAt !== 'number' || Number.isNaN(eventAt))) {
        return sendValidationError(res, 'Data evento non valida');
    }

    const recordedAt = Date.now();
    const normalizedEventAt = eventAt !== undefined ? eventAt : recordedAt;
    const sql = `INSERT INTO registro (id, tipo, vasca_id, vasca_codice, vasca_colore, dettagli, utente_nome, timestamp, recorded_at, event_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        id,
        tipo,
        vascaId || null,
        vascaCodice,
        vascaColore,
        dettagli,
        req.user?.username || utenteNome || null,
        recordedAt,
        recordedAt,
        normalizedEventAt
    ];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id, message: 'Log creato correttamente' });
    });
});
app.delete('/api/registro', requireRole('ADMIN'), (_req, res) => {
    db.run('DELETE FROM registro', [], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Log svuotato correttamente' });
    });
});

app.use(express.static(distPath, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store');
            return;
        }

        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        next();
        return;
    }

    // Non servire l'SPA come "finto" JS/CSS: evita pagine bianche quando il browser
    // ha cache di vecchi asset hashed (riceverebbe HTML al posto di JS).
    if (req.path.startsWith('/assets/')) {
        res.status(404).end();
        return;
    }

    const accept = req.headers.accept || '';
    if (!accept.includes('text/html')) {
        res.status(404).end();
        return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server in ascolto su http://localhost:${port}`);
});

module.exports = {
    app,
    server
};





