import { randomUUID } from 'node:crypto';
export const REDACTED = '[REDACTED]';
const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const SECRET_KEYS = new Set([
    'authorization',
    'proxyauthorization',
    'cookie',
    'setcookie',
    'token',
    'accesstoken',
    'refreshtoken',
    'idtoken',
    'apikey',
    'apisecret',
    'secret',
    'clientsecret',
    'password',
    'passwd',
    'credential',
    'credentials',
    'signature',
    'sig',
    'jwt',
    'bearer',
    'privatekey',
    'xapikey',
    'xauthtoken',
    'xaccesstoken',
    'auth',
]);
function normalizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function isSecretKey(key) {
    const normalized = normalizeKey(key);
    if (SECRET_KEYS.has(normalized))
        return true;
    if (normalized === 'requestid' || normalized === 'xrequestid')
        return false;
    return /(?:^|[^a-z])(?:token|secret|password|api[-_]?key)$/i.test(key);
}
function redactString(value) {
    const query = value.replace(/([?&#])([^&#=]+)=([^&#]*)/g, (match, sep, rawKey) => {
        let key;
        try {
            key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
        }
        catch {
            key = rawKey;
        }
        return isSecretKey(key) ? `${sep}${rawKey}=${REDACTED}` : match;
    });
    return query
        .replace(/\b(Bearer|Basic)\s+\S+/gi, `$1 ${REDACTED}`)
        .replace(/\b((?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|password|passwd|authorization|token|secret))(\s*[:=]\s*)([^\s&]+)/gi, `$1$2${REDACTED}`);
}
export function redact(value) {
    return redactValue(undefined, value, 0, new WeakSet());
}
function redactValue(key, value, depth, seen) {
    if (key !== undefined && isSecretKey(key))
        return REDACTED;
    if (depth > 8)
        return REDACTED;
    if (typeof value === 'string')
        return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined)
        return value;
    if (typeof value !== 'object')
        return REDACTED;
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Error) {
        return redactValue(undefined, { name: value.name, message: value.message }, depth + 1, seen);
    }
    if (seen.has(value))
        return REDACTED;
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map(item => redactValue(undefined, item, depth + 1, seen));
    }
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
        output[childKey] = redactValue(childKey, childValue, depth + 1, seen);
    }
    return output;
}
export function createLogger(options = {}) {
    const write = options.write ?? ((line) => {
        console.log(line);
    });
    const clock = options.clock ?? (() => new Date());
    const emit = (level, msg, fields) => {
        const details = redact({ ...options.base, ...fields });
        const record = {
            ...(details !== null && typeof details === 'object' ? details : {}),
            time: clock().toISOString(),
            level,
            msg: redactString(msg),
        };
        try {
            write(JSON.stringify(record));
        }
        catch {
            write(JSON.stringify({ time: record.time, level, msg: record.msg, error: 'log record was not serializable' }));
        }
    };
    return {
        info: (msg, fields) => emit('info', msg, fields),
        warn: (msg, fields) => emit('warn', msg, fields),
        error: (msg, fields) => emit('error', msg, fields),
    };
}
export function requestIdOf(req) {
    const raw = req.headers[REQUEST_ID_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value))
        return value;
    return randomUUID();
}
//# sourceMappingURL=log.js.map