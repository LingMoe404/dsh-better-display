import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const defaultFlags = { readerEnabled: true };
function locateFlags(start = dirname(fileURLToPath(import.meta.url))) {
    let dir = start;
    for (let depth = 0; depth < 6; depth += 1) {
        const candidate = resolve(dir, 'flags.json');
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(dir);
        if (parent === dir)
            return undefined;
        dir = parent;
    }
    return undefined;
}
function normalize(value) {
    const record = value !== null && typeof value === 'object' ? value : {};
    return {
        readerEnabled: typeof record.readerEnabled === 'boolean' ? record.readerEnabled : defaultFlags.readerEnabled,
    };
}
export function loadFlags(source) {
    if (source !== undefined && typeof source !== 'string')
        return normalize(source);
    try {
        const path = typeof source === 'string' ? source : locateFlags();
        if (path === undefined || !existsSync(path))
            return { ...defaultFlags };
        return normalize(JSON.parse(readFileSync(path, 'utf8')));
    }
    catch {
        return { ...defaultFlags };
    }
}
//# sourceMappingURL=flags.js.map