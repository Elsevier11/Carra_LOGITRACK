const SOLETTA_MAX_LEVELS = 10;
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

function getRowLength(rowName) {
    return ROW_LENGTHS[rowName] ?? null;
}

function buildPositionLabel(tipo, fila, offsetInizio, livello) {
    if (!fila) return null;
    if (tipo === 'SOLETTA') return `${fila} @ Pila (L${livello})`;
    return `${fila} @ ${Number(offsetInizio || 0).toFixed(2)}m (L${livello})`;
}

function validateArticleTransition(currentArticle, nextArticle, peerArticles) {
    if (nextArticle.stato === 'CREATA') {
        if (nextArticle.fila !== null || nextArticle.offsetInizio !== null) {
            return 'Un articolo in attesa non puo avere una posizione assegnata';
        }
        return null;
    }

    if (nextArticle.stato === 'SPEDITA') {
        if (currentArticle.tipo === 'SOLETTA') {
            const hasBlockingItems = peerArticles.some(peer =>
                peer.stato === 'IN_AREA' &&
                peer.fila === currentArticle.fila &&
                peer.id !== currentArticle.id &&
                peer.livello > currentArticle.livello
            );
            if (hasBlockingItems) {
                return 'Scarico non consentito: la soletta non e in cima alla pila';
            }
        }
        return null;
    }

    if (!nextArticle.fila) {
        return 'La fila e obbligatoria per gli articoli in piazzale';
    }

    if (nextArticle.tipo === 'SOLETTA') {
        if (nextArticle.offsetInizio !== 0) {
            return 'Le solette possono essere posizionate solo all offset 0 della pila';
        }

        const occupiedLevels = peerArticles.filter(peer =>
            peer.stato === 'IN_AREA' &&
            peer.tipo === 'SOLETTA' &&
            peer.fila === nextArticle.fila &&
            peer.id !== currentArticle.id
        ).length;

        if (occupiedLevels >= SOLETTA_MAX_LEVELS) {
            return `Pila piena: massimo ${SOLETTA_MAX_LEVELS} solette`;
        }

        return null;
    }

    if (typeof nextArticle.offsetInizio !== 'number' || Number.isNaN(nextArticle.offsetInizio) || nextArticle.offsetInizio < 0) {
        return 'Offset non valido per il posizionamento in piazzale';
    }

    const rowLength = getRowLength(nextArticle.fila);
    if (!rowLength) {
        return 'Fila non valida';
    }

    if (nextArticle.offsetInizio + nextArticle.lunghezza > rowLength) {
        return 'Spazio insufficiente nella fila selezionata';
    }

    const overlaps = peerArticles.some(peer => {
        if (peer.stato !== 'IN_AREA' || peer.fila !== nextArticle.fila || peer.id === currentArticle.id || peer.offset_inizio === null) {
            return false;
        }

        const start1 = nextArticle.offsetInizio;
        const end1 = start1 + nextArticle.lunghezza;
        const start2 = peer.offset_inizio;
        const end2 = peer.offset_inizio + peer.lunghezza;
        return start1 < end2 && end1 > start2;
    });

    if (overlaps) {
        return 'La posizione selezionata si sovrappone a un altro articolo';
    }

    return null;
}

function runAsync(db, sql, params = []) {
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

function getAsync(db, sql, params = []) {
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

function allAsync(db, sql, params = []) {
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

async function relevelSolettaPile(db, pile) {
    if (!pile) return [];

    const stack = await allAsync(
        db,
        `SELECT id, tipo, fila, livello, data_creazione
         FROM articoli
         WHERE tipo = 'SOLETTA' AND stato = 'IN_AREA' AND fila = ?
         ORDER BY livello ASC, data_creazione ASC`,
        [pile]
    );

    const updates = [];
    for (let index = 0; index < stack.length; index += 1) {
        const item = stack[index];
        const expectedLevel = index + 1;
        const expectedPosition = buildPositionLabel('SOLETTA', pile, 0, expectedLevel);
        if (item.livello !== expectedLevel) {
            await runAsync(
                db,
                'UPDATE articoli SET livello = ?, offset_inizio = 0, posizione = ? WHERE id = ?',
                [expectedLevel, expectedPosition, item.id]
            );
            updates.push({ id: item.id, livello: expectedLevel, posizione: expectedPosition });
        }
    }

    return updates;
}

async function mutateArticleState(db, articleId, patch) {
    const currentArticle = await getAsync(db, 'SELECT * FROM articoli WHERE id = ?', [articleId]);
    if (!currentArticle) {
        return { error: 'Articolo non trovato', status: 404 };
    }

    const nextArticle = {
        ...currentArticle,
        posizione: patch.posizione !== undefined ? patch.posizione : currentArticle.posizione,
        fila: patch.fila !== undefined ? patch.fila : currentArticle.fila,
        offsetInizio: patch.offsetInizio !== undefined ? patch.offsetInizio : currentArticle.offset_inizio,
        stato: patch.stato !== undefined ? patch.stato : currentArticle.stato,
        livello: patch.livello !== undefined ? patch.livello : currentArticle.livello
    };

    const peerArticles = await allAsync(db, 'SELECT * FROM articoli WHERE id != ?', [articleId]);
    const validationError = validateArticleTransition(currentArticle, nextArticle, peerArticles);
    if (validationError) {
        return { error: validationError, status: 400 };
    }

    const previousPile = currentArticle.tipo === 'SOLETTA' ? currentArticle.fila : null;
    const nextPile = nextArticle.tipo === 'SOLETTA' ? nextArticle.fila : null;
    const computedLevel = nextArticle.tipo === 'SOLETTA' && nextArticle.stato === 'IN_AREA'
        ? peerArticles.filter(peer => peer.stato === 'IN_AREA' && peer.tipo === 'SOLETTA' && peer.fila === nextArticle.fila).length + 1
        : nextArticle.livello;
    const computedPosition = patch.posizione !== undefined
        ? patch.posizione
        : buildPositionLabel(nextArticle.tipo, nextArticle.fila, nextArticle.offsetInizio, computedLevel);

    await runAsync(
        db,
        'UPDATE articoli SET posizione = ?, fila = ?, offset_inizio = ?, stato = ?, livello = ? WHERE id = ?',
        [
            computedPosition,
            nextArticle.fila ?? null,
            nextArticle.offsetInizio ?? null,
            nextArticle.stato,
            computedLevel ?? 0,
            articleId
        ]
    );

    if (previousPile && previousPile !== nextPile) {
        await relevelSolettaPile(db, previousPile);
    }
    if (nextPile) {
        await relevelSolettaPile(db, nextPile);
    }

    const updated = await getAsync(db, 'SELECT * FROM articoli WHERE id = ?', [articleId]);
    return { article: updated, status: 200 };
}

module.exports = {
    buildPositionLabel,
    mutateArticleState,
    relevelSolettaPile,
    validateArticleTransition
};
