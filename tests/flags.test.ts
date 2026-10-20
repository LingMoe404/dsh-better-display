import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { apply } from '../src/dsh-better-display.js';
import { defaultFlags, loadFlags } from '../src/flags.js';

test('readerEnabled defaults to true', () => {
  assert.equal(defaultFlags.readerEnabled, true);
  const file = JSON.parse(readFileSync(fileURLToPath(new URL('../flags.json', import.meta.url)), 'utf8')) as { readerEnabled: boolean };
  assert.equal(file.readerEnabled, true);
  assert.equal(loadFlags().readerEnabled, true);
  assert.equal(loadFlags({ readerEnabled: false }).readerEnabled, false);
  const dir = mkdtempSync(join(tmpdir(), 'bd-flags-'));
  try {
    const broken = join(dir, 'flags.json');
    writeFileSync(broken, '{ "readerEnabled": "yes" }');
    assert.equal(loadFlags(broken).readerEnabled, true);
    assert.equal(loadFlags(join(dir, 'missing.json')).readerEnabled, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('apply skips route registration when readerEnabled is false', () => {
  let registered = 0;
  let effects = 0;
  apply({
    webServer: {
      register() {
        registered += 1;
        return () => undefined;
      },
    },
    effect(run: () => void) {
      effects += 1;
      run();
    },
  } as never, { flags: { readerEnabled: false } });
  assert.equal(registered, 0);
  assert.equal(effects, 0);
  assert.doesNotThrow(() => apply({} as never, { flags: { readerEnabled: true } }));
});

test('check-dead-flags fails when a flags.json key is unused under src', () => {
  const script = fileURLToPath(new URL('../scripts/check-dead-flags.mjs', import.meta.url));
  const ok = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr || ok.stdout);
  const dir = mkdtempSync(join(tmpdir(), 'bd-dead-flags-'));
  try {
    const flags = join(dir, 'flags.json');
    writeFileSync(flags, JSON.stringify({ readerEnabled: true, unusedFlag: false }));
    const bad = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, FLAGS_JSON: flags },
    });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /unusedFlag/);
    assert.doesNotMatch(bad.stderr, /readerEnabled/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
