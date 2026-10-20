/** Fail when a flags.json key never appears under src. FLAGS_JSON and FLAGS_SRC override paths. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const flagsPath = process.env.FLAGS_JSON ? resolve(process.env.FLAGS_JSON) : join(root, 'flags.json');
const srcDir = process.env.FLAGS_SRC ? resolve(process.env.FLAGS_SRC) : join(root, 'src');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'lib') continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.(?:[cm]?[jt]s|tsx|jsx)$/.test(entry)) found.push(path);
  }
  return found;
}

function referenced(haystack, key) {
  const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return pattern.test(haystack);
}

let flags;
try {
  flags = JSON.parse(readFileSync(flagsPath, 'utf8'));
} catch (err) {
  fail(`Cannot read feature flags from ${flagsPath}: ${err instanceof Error ? err.message : String(err)}`);
}

if (flags === null || typeof flags !== 'object' || Array.isArray(flags)) {
  fail('flags.json must be an object of feature flags');
}

const keys = Object.keys(flags);
if (keys.length === 0 || keys.some(key => key.trim() === '')) fail('flags.json has no usable keys');

let sources;
try {
  sources = sourceFiles(srcDir).map(path => readFileSync(path, 'utf8')).join('\n');
} catch (err) {
  fail(`Cannot scan ${srcDir} for feature flag usage: ${err instanceof Error ? err.message : String(err)}`);
}

const unused = keys.filter(key => !referenced(sources, key));
if (unused.length > 0) fail(`Unused feature flags: ${unused.join(', ')}`);

console.log(`All ${keys.length} flags.json keys are referenced under src.`);
