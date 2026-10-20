import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Startup kill switch loaded from flags.json. This is not the reader glass setting. */
export interface Flags {
  readonly readerEnabled: boolean;
}

export const defaultFlags: Flags = { readerEnabled: true };

function locateFlags(start = dirname(fileURLToPath(import.meta.url))): string | undefined {
  let dir = start;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, 'flags.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

function normalize(value: unknown): Flags {
  const record = value !== null && typeof value === 'object' ? value as { readerEnabled?: unknown } : {};
  return {
    readerEnabled: typeof record.readerEnabled === 'boolean' ? record.readerEnabled : defaultFlags.readerEnabled,
  };
}

export function loadFlags(source?: string | Flags): Flags {
  if (source !== undefined && typeof source !== 'string') return normalize(source);
  try {
    const path = typeof source === 'string' ? source : locateFlags();
    if (path === undefined || !existsSync(path)) return { ...defaultFlags };
    return normalize(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    return { ...defaultFlags };
  }
}
