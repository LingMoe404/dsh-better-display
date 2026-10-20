import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const skipDirs = new Set([
  'node_modules',
  'lib',
  '.git',
  'artifacts',
  '.evidence',
  '.delivery',
  'coverage',
  'report',
  'dist'
]);
const extensions = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.js',
  '.jsx',
  '.md',
  '.yml',
  '.yaml',
  '.css',
  '.json',
  '.html'
]);

const marker = new RegExp(String.raw`\b(?:${'TO' + 'DO'}|${'FIX' + 'ME'})\b`);
const issueId = /#\d+/;

async function walk(directory, hits) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      await walk(path.join(directory, entry.name), hits);
      continue;
    }
    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
    const file = path.join(directory, entry.name);
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!marker.test(line) || issueId.test(line)) continue;
      hits.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
    }
  }
}

const hits = [];
await walk(root, hits);
if (hits.length > 0) {
  console.error(`TODO/FIXME without an issue id (#123): ${hits.length}`);
  for (const hit of hits) console.error(hit);
  process.exit(1);
}
console.log('todo debt: ok');
