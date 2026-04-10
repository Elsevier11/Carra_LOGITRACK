const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();
const {
    buildPositionLabel,
    mutateArticleState,
    relevelSolettaPile,
    validateArticleTransition
} = require('./articleService');
const { server } = require('./index');

const BASE_URL = 'http://127.0.0.1:3001';
let authCookie = null;
const createdUserIds = [];
const createdArticleIds = [];

function logSuite(title) {
    console.log(`\n[SUITE] ${title}`);
}

function logPass(message) {
    console.log(`  PASS ${message}`);
}

function openInMemoryDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(':memory:', (err) => {
            if (err) {
                reject(err);
                return;
            }

            db.run(`CREATE TABLE articoli (
                id TEXT PRIMARY KEY,
                codice TEXT NOT NULL,
                cliente TEXT NOT NULL,
                commessa TEXT NOT NULL,
                lunghezza REAL NOT NULL,
                posizione TEXT,
                fila TEXT,
                offset_inizio REAL,
                tipo TEXT NOT NULL,
                livello INTEGER DEFAULT 1,
                colore TEXT NOT NULL,
                stato TEXT NOT NULL,
                data_creazione TEXT NOT NULL
            )`, (schemaErr) => {
                if (schemaErr) {
                    reject(schemaErr);
                    return;
                }
                resolve(db);
            });
        });
    });
}

function run(db, sql, params = []) {
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

function get(db, sql, params = []) {
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

function closeDb(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch (_err) {
        return null;
    }
}

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await parseJsonSafe(response);
    return { response, data };
}

async function cleanupApiArtifacts() {
    for (const id of createdArticleIds.splice(0)) {
        try {
            await request(`/api/articoli/${id}`, {
                method: 'DELETE',
                headers: authCookie ? { cookie: authCookie } : {}
            });
        } catch (_err) {
            // best effort
        }
    }

    for (const id of createdUserIds.splice(0)) {
        try {
            await request(`/api/utenti/${id}`, {
                method: 'DELETE',
                headers: authCookie ? { cookie: authCookie } : {}
            });
        } catch (_err) {
            // best effort
        }
    }
}

async function runArticleServiceTests() {
    logSuite('articleService');

    assert.equal(buildPositionLabel('VASCA', 'A', 1234, 1), 'A @ 1234cm (L1)');
    assert.equal(buildPositionLabel('SOLETTA', 'P3', 0, 4), 'P3 @ Pila (L4)');
    assert.equal(buildPositionLabel('VASCA', null, 0, 1), null);
    logPass('buildPositionLabel formats labels correctly');

    const overlapError = validateArticleTransition(
        { id: 'v1', tipo: 'VASCA', stato: 'CREATA' },
        { id: 'v1', tipo: 'VASCA', stato: 'IN_AREA', fila: 'A', offsetInizio: 500, lunghezza: 400 },
        [{ id: 'v2', stato: 'IN_AREA', fila: 'A', offset_inizio: 700, lunghezza: 500 }]
    );
    assert.equal(overlapError, 'La posizione selezionata si sovrappone a un altro articolo');

    const blockedShipError = validateArticleTransition(
        { id: 's1', tipo: 'SOLETTA', stato: 'IN_AREA', fila: 'P1', livello: 1 },
        { id: 's1', tipo: 'SOLETTA', stato: 'SPEDITA', fila: null, offsetInizio: null, livello: 1 },
        [{ id: 's2', tipo: 'SOLETTA', stato: 'IN_AREA', fila: 'P1', livello: 2 }]
    );
    assert.equal(blockedShipError, 'Scarico non consentito: la soletta non e in cima alla pila');
    logPass('validateArticleTransition blocks overlaps and blocked shipping');

    let db = await openInMemoryDb();
    try {
        await run(
            db,
            `INSERT INTO articoli (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s-low', 'S-LOW', 'Cliente', 'Comm', 100, 'P1 @ Pila (L1)', 'P1', 0, 'SOLETTA', 1, '#111111', 'IN_AREA', '2026-01-01T00:00:00.000Z']
        );
        await run(
            db,
            `INSERT INTO articoli (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s-top', 'S-TOP', 'Cliente', 'Comm', 100, 'P1 @ Pila (L3)', 'P1', 0, 'SOLETTA', 3, '#222222', 'IN_AREA', '2026-01-02T00:00:00.000Z']
        );

        const updates = await relevelSolettaPile(db, 'P1');
        const topRow = await get(db, 'SELECT livello, posizione FROM articoli WHERE id = ?', ['s-top']);
        assert.equal(updates.length, 1);
        assert.equal(topRow.livello, 2);
        assert.equal(topRow.posizione, 'P1 @ Pila (L2)');
        logPass('relevelSolettaPile compacts pile levels');
    } finally {
        await closeDb(db);
    }

    db = await openInMemoryDb();
    try {
        await run(
            db,
            `INSERT INTO articoli (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s1', 'S1', 'Cliente', 'Comm', 100, null, null, null, 'SOLETTA', 1, '#111111', 'CREATA', '2026-01-01T00:00:00.000Z']
        );
        await run(
            db,
            `INSERT INTO articoli (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s2', 'S2', 'Cliente', 'Comm', 100, 'P4 @ Pila (L1)', 'P4', 0, 'SOLETTA', 1, '#222222', 'IN_AREA', '2026-01-02T00:00:00.000Z']
        );
        await run(
            db,
            `INSERT INTO articoli (id, codice, cliente, commessa, lunghezza, posizione, fila, offset_inizio, tipo, livello, colore, stato, data_creazione)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['s3', 'S3', 'Cliente', 'Comm', 100, 'P4 @ Pila (L2)', 'P4', 0, 'SOLETTA', 2, '#333333', 'IN_AREA', '2026-01-03T00:00:00.000Z']
        );

        const positioned = await mutateArticleState(db, 's1', {
            fila: 'P4',
            offsetInizio: 0,
            stato: 'IN_AREA'
        });
        assert.equal(positioned.status, 200);
        assert.equal(positioned.article.livello, 3);

        const blockedShip = await mutateArticleState(db, 's2', {
            fila: null,
            offsetInizio: null,
            stato: 'SPEDITA',
            livello: 1
        });
        assert.equal(blockedShip.status, 400);

        const shippedTop = await mutateArticleState(db, 's1', {
            fila: null,
            offsetInizio: null,
            stato: 'SPEDITA',
            livello: 3
        });
        assert.equal(shippedTop.status, 200);

        const nowTop = await get(db, 'SELECT livello, posizione FROM articoli WHERE id = ?', ['s3']);
        assert.equal(nowTop.livello, 2);
        assert.equal(nowTop.posizione, 'P4 @ Pila (L2)');
        logPass('mutateArticleState assigns levels and relevels source piles');
    } finally {
        await closeDb(db);
    }
}

async function runApiIntegrationTests() {
    logSuite('api integration');
    await new Promise(resolve => setTimeout(resolve, 1400));

    const health = await request('/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.data.status, 'ok');
    logPass('health endpoint is public');

    const unauthorized = await request('/api/articoli');
    assert.equal(unauthorized.response.status, 401);
    logPass('articoli endpoint requires authentication');

    const login = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(login.response.status, 200);
    authCookie = login.response.headers.get('set-cookie');
    assert.ok(authCookie);
    logPass('admin login succeeds');

    const uniqueSuffix = Date.now();
    const username = `user-${uniqueSuffix}`;
    const createdUser = await request('/api/utenti', {
        method: 'POST',
        headers: {
            cookie: authCookie,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password: 'TempPass123!',
            ruolo: 'OPERATORE'
        })
    });
    assert.equal(createdUser.response.status, 201);
    createdUserIds.push(createdUser.data.id);

    const operatorLogin = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'TempPass123!' })
    });
    assert.equal(operatorLogin.response.status, 200);
    const operatorCookie = operatorLogin.response.headers.get('set-cookie');
    assert.ok(operatorCookie);

    const forbiddenUsers = await request('/api/utenti', {
        headers: { cookie: operatorCookie }
    });
    assert.equal(forbiddenUsers.response.status, 403);
    logPass('role protection blocks operator access to user list');

    const articleId = `api-article-${uniqueSuffix}`;
    const codice = `API-V-${uniqueSuffix}`;
    const createdArticle = await request('/api/articoli', {
        method: 'POST',
        headers: {
            cookie: authCookie,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: articleId,
            codice,
            cliente: 'TEST CLIENTE',
            commessa: 'COMM-API',
            lunghezza: 420,
            colore: '#0ea5e9',
            stato: 'CREATA',
            dataCreazione: new Date().toISOString(),
            tipo: 'VASCA',
            livello: 1
        })
    });
    assert.equal(createdArticle.response.status, 201);
    createdArticleIds.push(articleId);

    const duplicate = await request('/api/articoli', {
        method: 'POST',
        headers: {
            cookie: authCookie,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: `${articleId}-dup`,
            codice,
            cliente: 'TEST CLIENTE',
            commessa: 'COMM-API',
            lunghezza: 420,
            colore: '#0ea5e9',
            stato: 'CREATA',
            dataCreazione: new Date().toISOString(),
            tipo: 'VASCA',
            livello: 1
        })
    });
    assert.equal(duplicate.response.status, 201);
    createdArticleIds.push(`${articleId}-dup`);
    logPass('article creation allows duplicate codes');

    const logout = await request('/api/logout', {
        method: 'POST',
        headers: { cookie: authCookie }
    });
    assert.equal(logout.response.status, 200);
    const clearedCookie = logout.response.headers.get('set-cookie');
    assert.ok(clearedCookie);

    const afterLogout = await request('/api/articoli', {
        headers: { cookie: clearedCookie }
    });
    assert.equal(afterLogout.response.status, 401);
    logPass('logout invalidates authenticated requests');

    const relogin = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.equal(relogin.response.status, 200);
    authCookie = relogin.response.headers.get('set-cookie');
    assert.ok(authCookie);

    const deletedUser = await request(`/api/utenti/${createdUser.data.id}`, {
        method: 'DELETE',
        headers: { cookie: authCookie }
    });
    assert.equal(deletedUser.response.status, 200);
    createdUserIds.splice(createdUserIds.indexOf(createdUser.data.id), 1);
    logPass('admin cleanup and delete user works');
}

async function shutdown() {
    await cleanupApiArtifacts();
    await new Promise((resolve, reject) => {
        server.close((err) => {
            if (err) {
                if (err.code === 'ERR_SERVER_NOT_RUNNING') {
                    resolve();
                    return;
                }
                reject(err);
                return;
            }
            resolve();
        });
    });
}

async function main() {
    try {
        await runArticleServiceTests();
        await runApiIntegrationTests();
        console.log('\nBackend test suite passed');
    } finally {
        await shutdown();
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nBackend test suite failed');
        console.error(err);
        process.exit(1);
    });
