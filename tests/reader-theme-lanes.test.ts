import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { externalClientBundle } from '../tools/client-build.js';

const css = readFileSync(resolve('src/client/Reader.module.css'), 'utf8');

test('sticky lanes follow the host font delta and measured row heights', () => {
  assert.match(css, /--reader-lane-block:\s*max\(40px,\s*calc\(40px \+ var\(--dsh-content-font-delta, 0px\)\)\)/);
  assert.match(css, /font-size:\s*calc\(14px \+ var\(--dsh-content-font-delta, 0px\)\)/);
  assert.match(css, /line-height:\s*calc\(24px \+ var\(--dsh-content-font-delta, 0px\)\)/);
  assert.match(
    css,
    /\.flowCell\[data-flow-summary\], \.closedProcessSummary \{[^}]*top:\s*calc\(var\(--reader-toolbar-height, var\(--reader-lane-block, 40px\)\) \+ var\(--reader-status-height, var\(--reader-lane-block, 40px\)\)\)/,
  );
  assert.match(css, /--reader-code-summary-height:\s*var\(--reader-summary-height, var\(--reader-lane-block, 40px\)\)/);
  assert.doesNotMatch(css, /--reader-sticky-lane/);
});

test('a transparent canvas still masks the lane with the surface token', () => {
  assert.match(css, /--reader-lane-plate:\s*linear-gradient\(var\(--dsw-alias-bg-base\)/);
  assert.match(css, /linear-gradient\(var\(--dsw-alias-bg-layer-1, transparent\)/);
  assert.doesNotMatch(css, /--reader-lane-plate:[^;]*label-primary/);
  assert.doesNotMatch(css, /--reader-lane-plate:[^;]*color-mix/);
  assert.match(css, /background-color:\s*Canvas/);
  assert.match(css, /background-image:\s*var\(--reader-lane-plate\)/);
  assert.match(css, /\.turnProcessSticky \{ box-shadow:[^;]*\bCanvas\b/);
  assert.doesNotMatch(css, /\.turnProcessSticky \{ box-shadow:[^;]*label-primary/);
  assert.match(css, /\.closedProcessSummary \{ box-shadow:[^;]*\bCanvas\b/);
  assert.match(css, /\.flowCell\[data-flow-summary\] \{ box-shadow:[^;]*\bCanvas\b/);
  assert.match(css, /\.root\[data-reader-glass\] \.turnProcessSticky/);
  const glass = css.slice(css.indexOf('Skin mode is opt-in'));
  assert.match(glass, /background:\s*transparent/);
  assert.doesNotMatch(glass, /background-color:\s*Canvas/);
});

test('built Reader CSS keeps the lane plate and the measured summary offset', async () => {
  const configs = externalClientBundle('dsh-better-display', [], { clientEntry: 'src/client/index.tsx' });
  const client = configs.find(config => config.name === 'dsh-better-display/client');
  const plugin = client?.plugins.find(entry => entry.name === 'dshx-css-modules-inline');
  assert.ok(plugin);
  const source = await plugin.load.call({}, `\0dshx-css-module:${resolve('src/client/Reader.module.css')}.mjs`);
  const literal = /^const css = (.+);$/m.exec(source)?.[1];
  assert.ok(literal);
  const built: unknown = JSON.parse(literal);
  assert.equal(typeof built, 'string');
  if (typeof built !== 'string') return;
  assert.match(built, /--reader-lane-block:max\(40px, calc\(40px \+ var\(--dsh-content-font-delta,0px\)\)\)/);
  assert.match(built, /--dsw-alias-bg-layer-1,transparent/);
  assert.match(built, /background-color:canvas/);
  assert.doesNotMatch(built, /--reader-lane-plate:[^;]*label-primary/);
  assert.match(built, /var\(--reader-toolbar-height,var\(--reader-lane-block,40px\)\) \+ var\(--reader-status-height,var\(--reader-lane-block,40px\)\)/);
});
