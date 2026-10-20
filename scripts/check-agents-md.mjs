import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUILTINS = new Set([
  'ci', 'install', 'uninstall', 'update', 'outdated', 'ping', 'config', 'cache',
  'explore', 'exec', 'x', 'dlx', 'init', 'create', 'pack', 'publish', 'login',
  'logout', 'whoami', 'view', 'search', 'access', 'audit', 'fund', 'explain',
  'prefix', 'root', 'bin', 'ls', 'version', 'help', 'doctor', 'diff', 'pkg',
  'sbom', 'rebuild', 'link', 'unlink', 'prune', 'dedupe', 'install-test',
]);

/** Script names referenced by fenced npm commands, or null when the command is a builtin. */
export function npmScriptName(rest) {
  if (rest.startsWith('run ')) {
    const name = rest.slice(4).trim().split(/\s+/)[0];
    return name && !name.startsWith('-') ? name : '';
  }
  const head = rest.split(/\s+/)[0];
  if (head === 'test' || head === 'start') return head;
  if (BUILTINS.has(head)) return null;
  return '';
}

export function missingNpmScripts(markdown, scriptNames) {
  const missing = new Set();
  for (const match of markdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    for (const rawLine of match[1].split('\n')) {
      for (const piece of rawLine.split(/&&|\|\||;/)) {
        let command = piece.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');
        if (command.startsWith('$ ')) command = command.slice(2).trim();
        if (!command.startsWith('npm ') && command !== 'npm') continue;
        const name = npmScriptName(command.slice(3).trim());
        if (name === null) continue;
        if (!name || !scriptNames.has(name)) missing.add(name || command);
      }
    }
  }
  return [...missing];
}

function selfTest() {
  const scripts = new Set(['build', 'test', 'typecheck']);
  const ok = missingNpmScripts('```sh\nnpm ci\nnpm run build\nnpm test\n```\n', scripts);
  const bad = missingNpmScripts('```sh\nnpm run nope\n```\nSee `npm run nope` outside.\n', scripts);
  const unfenced = missingNpmScripts('Run npm run nope in prose.\n', scripts);
  if (ok.length !== 0 || bad.join() !== 'nope' || unfenced.length !== 0) {
    console.error('check-agents-md self-test failed', { ok, bad, unfenced });
    process.exit(1);
  }
  console.log('check-agents-md self-test passed');
}

if (process.argv.includes('--self-test')) selfTest();

const root = resolve(import.meta.dirname, '..');
const markdown = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
if (!markdown.trim()) {
  console.error('AGENTS.md is empty');
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const missing = missingNpmScripts(markdown, new Set(Object.keys(pkg.scripts ?? {})));
if (missing.length > 0) {
  console.error(`AGENTS.md fenced npm commands are not package.json scripts: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('AGENTS.md fenced npm commands match package.json scripts');
