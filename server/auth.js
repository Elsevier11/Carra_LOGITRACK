const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'logitrack_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8;
const SESSION_SECRET = process.env.LOGITRACK_SESSION_SECRET || 'logitrack-dev-secret-change-me';

function toBase64Url(value) {
    return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value) {
    return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function isPasswordHash(value) {
    return typeof value === 'string' && value.startsWith('scrypt$');
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, storedValue) {
    if (!storedValue || typeof storedValue !== 'string') return false;
    if (!isPasswordHash(storedValue)) return password === storedValue;

    const [, salt, expectedHash] = storedValue.split('$');
    if (!salt || !expectedHash) return false;

    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function createSessionToken(user) {
    const payload = {
        sub: user.id,
        username: user.username,
        ruolo: user.ruolo,
        exp: Date.now() + SESSION_DURATION_MS
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token) {
    if (!token || typeof token !== 'string') return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;
    if (sign(encodedPayload) !== signature) return null;

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload));
        if (!payload?.sub || !payload?.username || !payload?.ruolo || !payload?.exp) return null;
        if (payload.exp < Date.now()) return null;

        return {
            id: payload.sub,
            username: payload.username,
            ruolo: payload.ruolo
        };
    } catch (_err) {
        return null;
    }
}

function parseCookies(headerValue) {
    if (!headerValue) return {};

    return headerValue.split(';').reduce((acc, part) => {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (!rawKey) return acc;
        acc[rawKey] = decodeURIComponent(rawValue.join('=') || '');
        return acc;
    }, {});
}

function serializeSessionCookie(token) {
    const parts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`
    ];

    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function serializeClearedSessionCookie() {
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0'
    ];

    if (process.env.NODE_ENV === 'production') {
        parts.push('Secure');
    }

    return parts.join('; ');
}

module.exports = {
    SESSION_COOKIE_NAME,
    createSessionToken,
    hashPassword,
    isPasswordHash,
    parseCookies,
    serializeClearedSessionCookie,
    serializeSessionCookie,
    verifyPassword,
    verifySessionToken
};
