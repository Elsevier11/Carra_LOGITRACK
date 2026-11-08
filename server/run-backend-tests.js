const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// Always test against a disposable DB and an OS-assigned port.
process.env.LOGITRACK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'logitrack-test-')), 'vasche.db');
process.env.PORT = '0';
const {
    buildPositionLabel,
    mutateArticleState,
    relevelSolettaPile,
    validateArticleTransition
} = require('./articleService');
const { server } = require('./index');

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
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
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

    const waiting = { id: 'new', tipo: 'SOLETTA', stato: 'CREATA' };
    const placed = { ...waiting, stato: 'IN_AREA', fila: 'P18', offsetInizio: 0 };
    const peers = Array.from({ length: 12 }, (_, i) => ({
        id: `stack-${i}`, tipo: 'SOLETTA', stato: 'IN_AREA', fila: 'P18', livello: i + 1
    }));
    for (const count of [10, 11]) {
        assert.equal(validateArticleTransition(waiting, placed, peers.slice(0, count)), null);
    }
    assert.equal(validateArticleTransition(waiting, placed, peers), 'Pila piena: massimo 12 solette');
    const buried = peers[0];
    assert.equal(validateArticleTransition(buried, { ...buried, fila: 'P17', offsetInizio: 0 }, peers.slice(1)),
        'Spostamento non consentito: la soletta non e in cima alla pila');
    logPass('solette allow levels 11/12, reject 13 and reject moving buried pieces');

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

    const headers = { cookie: authCookie, 'Content-Type': 'application/json' };
    const solettaIds = [];
    for (let i = 1; i <= 13; i += 1) {
        const id = `api-soletta-${uniqueSuffix}-${i}`;
        const created = await request('/api/articoli', {
            method: 'POST', headers,
            body: JSON.stringify({ id, codice: `S-${i}`, cliente: 'CLIENTE', commessa: 'COMM',
                lunghezza: 200, lunghezzaSolettaCm: 200, altezzaSolettaCm: 20,
                colore: '#0ea5e9', stato: 'CREATA', tipo: 'SOLETTA', dataCreazione: new Date().toISOString() })
        });
        assert.equal(created.response.status, 201);
        solettaIds.push(id);
        const positioned = await request(`/api/articoli/${id}/position`, {
            method: 'POST', headers, body: JSON.stringify({ fila: 'P18', offsetInizio: 0 })
        });
        assert.equal(positioned.response.status, i <= 12 ? 200 : 400);
        if (i <= 12) assert.equal(positioned.data.articolo.livello, i);
        else assert.match(positioned.data.error, /massimo 12 solette/);
    }
    logPass('API accepts P18 and twelve levels, rejects the thirteenth');

    const directCreateBody = { id: `direct-${uniqueSuffix}`, codice: 'DIRECT', cliente: 'CLIENTE', commessa: 'COMM',
        lunghezza: 200, colore: '#0ea5e9', tipo: 'SOLETTA', stato: 'IN_AREA', fila: 'P18', offsetInizio: 0,
        livello: 99, dataCreazione: new Date().toISOString() };
    const directOverflow = await request('/api/articoli', {
        method: 'POST', headers, body: JSON.stringify(directCreateBody)
    });
    assert.equal(directOverflow.response.status, 400, 'direct creation cannot bypass capacity');
    const invalidPile = await request(`/api/articoli/${solettaIds[12]}/position`, {
        method: 'POST', headers, body: JSON.stringify({ fila: 'P19', offsetInizio: 0 })
    });
    assert.equal(invalidPile.response.status, 400, 'nonexistent pile must be rejected');
    const directValid = await request('/api/articoli', {
        method: 'POST', headers, body: JSON.stringify({ ...directCreateBody, fila: 'P15' })
    });
    assert.equal(directValid.response.status, 201);
    logPass('direct creation obeys capacity and invalid piles are rejected');

    const snapshot = () => request('/api/articoli', { headers });
    const before = (await snapshot()).data;
    const directlyPlaced = before.find(a => a.id === directCreateBody.id);
    assert.equal(directlyPlaced.fila, 'P15');
    assert.equal(directlyPlaced.livello, 1);
    assert.equal(directlyPlaced.posizione, 'P15 @ Pila (L1)');
    const logsBefore = (await request('/api/registro', { headers })).data;
    const middleId = solettaIds[5];
    const edited = await request(`/api/articoli/${middleId}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ codice: 'S-CENTRALE', cliente: 'NUOVO CLIENTE', commessa: 'NUOVA COMM',
            note: 'Modificata senza movimentazione', lunghezzaSolettaCm: 250, altezzaSolettaCm: 25 })
    });
    assert.equal(edited.response.status, 200);
    const after = (await snapshot()).data;
    for (const oldArticle of before.filter(a => solettaIds.includes(a.id))) {
        const updated = after.find(a => a.id === oldArticle.id);
        for (const key of ['fila', 'livello', 'posizione', 'offsetInizio', 'stato']) {
            assert.deepEqual(updated[key], oldArticle[key], `${oldArticle.id}: ${key} unchanged after metadata edit`);
        }
    }
    const middle = after.find(a => a.id === middleId);
    assert.equal(middle.codice, 'S-CENTRALE');
    assert.equal(middle.lunghezzaSolettaCm, 250);
    assert.deepEqual((await request('/api/registro', { headers })).data, logsBefore);
    logPass('editing middle-piece metadata preserves all pile positions and movement history');

    for (const [route, method, body] of [
        ['/move', 'POST', { fila: 'P17', offsetInizio: 0 }],
        ['/position', 'POST', { fila: 'P17', offsetInizio: 0 }],
        ['/ship', 'POST', {}],
        ['', 'PUT', { fila: 'P17', offsetInizio: 0, stato: 'IN_AREA' }],
        ['', 'PUT', { fila: null, offsetInizio: null, stato: 'SPEDITA', livello: 0 }],
        ['', 'PUT', { fila: null, offsetInizio: null, stato: 'CREATA' }]
    ]) {
        const blocked = await request(`/api/articoli/${middleId}${route}`, {
            method, headers, body: JSON.stringify(body)
        });
        assert.equal(blocked.response.status, 400, `${method} ${route} must reject buried pieces`);
    }
    assert.deepEqual((await snapshot()).data, after);
    const movedTop = await request(`/api/articoli/${solettaIds[11]}/move`, {
        method: 'POST', headers, body: JSON.stringify({ fila: 'P17', offsetInizio: 0 })
    });
    assert.equal(movedTop.response.status, 200);
    assert.equal(movedTop.data.articolo.livello, 1);
    const shippedTop = await request(`/api/articoli/${solettaIds[10]}/ship`, { method: 'POST', headers });
    assert.equal(shippedTop.response.status, 200);
    logPass('API blocks buried-piece movements on all routes; top-piece move/ship still work');

    await request(`/api/articoli/${solettaIds[12]}/position`, {
        method: 'POST', headers, body: JSON.stringify({ fila: 'P18', offsetInizio: 0 })
    });
    const races = await Promise.all([1, 2].map(i => request('/api/articoli', {
        method: 'POST', headers,
        body: JSON.stringify({ ...directCreateBody, id: `race-${uniqueSuffix}-${i}` })
    })));
    assert.deepEqual(races.map(r => r.response.status).sort(), [201, 400]);
    const fullPile = (await snapshot()).data.filter(a => a.fila === 'P18' && a.stato === 'IN_AREA');
    assert.equal(fullPile.length, 12);
    assert.deepEqual(fullPile.map(a => a.livello).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
    logPass('concurrent creation cannot exceed twelve or duplicate levels');

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
