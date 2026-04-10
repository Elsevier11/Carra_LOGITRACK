require('./index.js');

const BASE_URL = 'http://127.0.0.1:3001';
const ROW_LENGTHS = {
    A: 63.38,
    B: 63.38,
    C: 63.38,
    D: 63.38,
    E: 37.22,
    F: 37.22,
    G: 37.22,
    H: 37.22,
    I: 37.22,
    L: 48.78,
    M: 48.78
};
const SOLETTA_PILES = Array.from({ length: 12 }, (_, index) => `P${index + 1}`);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
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

function findAvailableRowOffset(articles, lunghezza) {
    for (const [row, rowLength] of Object.entries(ROW_LENGTHS)) {
        const occupied = articles
            .filter(article => article.stato === 'IN_AREA' && article.tipo === 'VASCA' && article.fila === row && article.offsetInizio !== null)
            .sort((a, b) => a.offsetInizio - b.offsetInizio);

        let cursor = 0;
        for (const article of occupied) {
            if (article.offsetInizio - cursor >= lunghezza) {
                return { fila: row, offsetInizio: Number(cursor.toFixed(2)) };
            }
            cursor = Math.max(cursor, article.offsetInizio + article.lunghezza);
        }

        if (rowLength - cursor >= lunghezza) {
            return { fila: row, offsetInizio: Number(cursor.toFixed(2)) };
        }
    }

    throw new Error('No free row available for smoke test vasca');
}

function findAvailablePile(articles) {
    for (const pile of SOLETTA_PILES) {
        const occupied = articles.filter(article => article.stato === 'IN_AREA' && article.tipo === 'SOLETTA' && article.fila === pile).length;
        if (occupied <= 7) {
            return pile;
        }
    }

    throw new Error('No free pile available for smoke test solette');
}

async function main() {
    await new Promise(resolve => setTimeout(resolve, 1400));

    const unauthorized = await request('/api/articoli');
    assert(unauthorized.response.status === 401, 'GET /api/articoli should require auth');

    const login = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert(login.response.status === 200, 'Login should succeed with admin credentials');
    const cookie = login.response.headers.get('set-cookie');
    assert(cookie, 'Login should return a session cookie');

    const authHeaders = { cookie };
    const uniqueSuffix = Date.now();
    const vascaCode = `SMOKE-V-${uniqueSuffix}`;
    const solettaLowCode = `SMOKE-SL1-${uniqueSuffix}`;
    const solettaTopCode = `SMOKE-SL2-${uniqueSuffix}`;
    const createdIds = [];
    const articlesSnapshot = await request('/api/articoli', { headers: authHeaders });
    assert(articlesSnapshot.response.status === 200, 'Fetching articoli should succeed after login');
    const vascaTarget = findAvailableRowOffset(articlesSnapshot.data || [], 6.2);
    const solettaPile = findAvailablePile(articlesSnapshot.data || []);

    try {
        const vasca = await request('/api/articoli', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `vasca-${uniqueSuffix}`,
                codice: vascaCode,
                cliente: 'TEST CLIENTE',
                commessa: 'COMM-TEST',
                lunghezza: 6.2,
                colore: '#3b82f6',
                stato: 'CREATA',
                dataCreazione: new Date().toISOString(),
                tipo: 'VASCA',
                livello: 1
            })
        });
        assert(vasca.response.status === 201, 'Create vasca should succeed');
        createdIds.push(`vasca-${uniqueSuffix}`);

        const vascaPosition = await request(`/api/articoli/vasca-${uniqueSuffix}/position`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(vascaTarget)
        });
        assert(vascaPosition.response.status === 200, 'Position vasca should succeed');

        const solettaLow = await request('/api/articoli', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `soletta-low-${uniqueSuffix}`,
                codice: solettaLowCode,
                cliente: 'TEST CLIENTE',
                commessa: 'COMM-TEST',
                lunghezza: 1,
                colore: '#10b981',
                stato: 'CREATA',
                dataCreazione: new Date().toISOString(),
                tipo: 'SOLETTA',
                livello: 1
            })
        });
        assert(solettaLow.response.status === 201, 'Create lower soletta should succeed');
        createdIds.push(`soletta-low-${uniqueSuffix}`);

        const solettaTop = await request('/api/articoli', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: `soletta-top-${uniqueSuffix}`,
                codice: solettaTopCode,
                cliente: 'TEST CLIENTE',
                commessa: 'COMM-TEST',
                lunghezza: 1,
                colore: '#f59e0b',
                stato: 'CREATA',
                dataCreazione: new Date().toISOString(),
                tipo: 'SOLETTA',
                livello: 1
            })
        });
        assert(solettaTop.response.status === 201, 'Create top soletta should succeed');
        createdIds.push(`soletta-top-${uniqueSuffix}`);

        const lowPosition = await request(`/api/articoli/soletta-low-${uniqueSuffix}/position`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fila: solettaPile, offsetInizio: 0 })
        });
        assert(lowPosition.response.status === 200, 'Position lower soletta should succeed');

        const topPosition = await request(`/api/articoli/soletta-top-${uniqueSuffix}/position`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fila: solettaPile, offsetInizio: 0 })
        });
        assert(topPosition.response.status === 200, 'Position top soletta should succeed');

        const blockedShip = await request(`/api/articoli/soletta-low-${uniqueSuffix}/ship`, {
            method: 'POST',
            headers: authHeaders
        });
        assert(blockedShip.response.status === 400, 'Shipping lower soletta should fail while blocked');

        const shipTop = await request(`/api/articoli/soletta-top-${uniqueSuffix}/ship`, {
            method: 'POST',
            headers: authHeaders
        });
        assert(shipTop.response.status === 200, 'Shipping top soletta should succeed');

        const shipLow = await request(`/api/articoli/soletta-low-${uniqueSuffix}/ship`, {
            method: 'POST',
            headers: authHeaders
        });
        assert(shipLow.response.status === 200, 'Shipping lower soletta should succeed once unblocked');

        const refreshedArticles = await request('/api/articoli', { headers: authHeaders });
        assert(refreshedArticles.response.status === 200, 'Refreshing articoli should succeed');
        const moveTarget = findAvailableRowOffset(
            (refreshedArticles.data || []).filter(article => article.id !== `vasca-${uniqueSuffix}`),
            6.2
        );

        const moveVasca = await request(`/api/articoli/vasca-${uniqueSuffix}/move`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(moveTarget)
        });
        assert(moveVasca.response.status === 200, 'Move vasca should succeed');

        console.log('Smoke test passed');
    } finally {
        for (const id of createdIds) {
            try {
                await request(`/api/articoli/${id}`, {
                    method: 'DELETE',
                    headers: authHeaders
                });
            } catch (_err) {
                // Best-effort cleanup only.
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
