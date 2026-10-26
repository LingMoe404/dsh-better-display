import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { ensureStyles } from '../src/client/styles.js';

test('ensureStyles tolerates module evaluation without a document', () => {
  ensureStyles();
});

test('ensureStyles restores removed plugin CSS and remains idempotent', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.onTestFinished(() => {
    if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const reader = { dataset: { plugin: 'dsh-better-display', pluginCss: 'dsh-better-display/Reader.module.css' }, textContent: '.reader{height:auto}' };
  const fold = { dataset: { plugin: 'dsh-better-display', pluginCss: 'dsh-better-display/Fold.module.css' }, textContent: '.fold{overflow:hidden}' };
  const foreign = { dataset: { plugin: 'other', pluginCss: 'other/Fold.module.css' }, textContent: '.other{}' };
  const tags = [reader, fold, foreign];
  const document = {
    querySelectorAll: (selector: string) => {
      assert.equal(selector, 'style[data-plugin="dsh-better-display"][data-plugin-css]');
      return tags.filter(tag => tag.dataset.plugin === 'dsh-better-display');
    },
    createElement: (name: string) => { assert.equal(name, 'style'); return { dataset: {}, textContent: '' }; },
    head: { appendChild: (tag: typeof reader) => { tags.push(tag); } },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  ensureStyles();
  assert.equal(tags.length, 3);
  tags.splice(0, 2);
  ensureStyles();
  assert.deepEqual(tags, [foreign, reader, fold]);
  ensureStyles();
  assert.equal(tags.length, 3);
  tags[1].textContent = '.reader{height:100px}';
  ensureStyles();
  tags.splice(1, 1);
  ensureStyles();
  assert.equal(tags.find(tag => tag.dataset.pluginCss === reader.dataset.pluginCss)?.textContent, '.reader{height:100px}');
});

test('CSS is cached after module injection and restored before mount layout effects', () => {
  const index = readFileSync(new URL('../src/client/index.tsx', import.meta.url), 'utf8');
  const reader = readFileSync(new URL('../src/client/Reader.tsx', import.meta.url), 'utf8');
  assert.match(index, /\nensureStyles\(\);/);
  // Whitespace-tolerant: the source is formatted by the project's own toolchain,
  // which may break the effect body onto its own line.
  assert.match(reader, /useInsertionEffect\(\(\) => \{[\s\S]{0,40}?ensureStyles\(\);[\s\S]{0,20}?\}, \[\]\)/);
});

test('user cluster fills the column so the host cap resolves once', () => {
  const css = readFileSync(new URL('../src/client/Reader.module.css', import.meta.url), 'utf8');
  const cluster = css.match(/\.userCluster\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(cluster, /width:\s*100%/);
  assert.match(cluster, /max-width:\s*100%/);
  assert.doesNotMatch(cluster, /0\.702/);
  assert.doesNotMatch(cluster, /525px/);
  assert.doesNotMatch(css, /525px/);
  // A direct-child cap misses the display:contents slot. The host row is the
  // slot's child; capping that grandchild would replace .userStack's own 82%.
  assert.doesNotMatch(css, /\.userCluster\s*>\s*\*/);
  assert.doesNotMatch(css, /\[data-slot="conversation\.chat\.node"\]/);
  assert.match(css, /\.userCluster > \[data-slot\] > \* \{[^}]*align-self:\s*stretch/);
  assert.match(css, /\.userCluster > \[data-slot\] > \* \{[^}]*width:\s*100%/);
  assert.doesNotMatch(css, /\.userCluster > \[data-slot\] > \* > \*/);
  const user = css.match(/\.user\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(user, /max-width:\s*min\(calc\(var\(--dsh-chat-content-width,\s*748px\)\s*\*\s*0\.702\),\s*82%\)/);
  assert.match(user, /font-size:\s*var\(--dsh-content-font-size,\s*14px\)/);
  assert.match(user, /line-height:\s*calc\(22px \+ var\(--dsh-content-font-delta,\s*0px\)\)/);
  assert.match(user, /font-weight:\s*400/);
  assert.match(user, /white-space:\s*pre-wrap/);
  assert.match(user, /border-radius:\s*var\(--dsw-radius-xl,\s*22px\)/);
  assert.doesNotMatch(css, /\.user\s*\{\s*max-width:\s*90%/);
});
