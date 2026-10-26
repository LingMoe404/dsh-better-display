import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'vitest';

// Width is a layout fact. This skips in CI, which has no pinned Chromium.
const browserRuntime = join(homedir(), '.codex/playwright-runtime/runtime.mjs');
const skip = existsSync(browserRuntime) ? false : 'pinned Chromium runtime not available';

const hostCss = `
  .userRow { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .userStack { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 0;
    max-width: min(calc(var(--dsh-chat-content-width, 748px) * 0.702), 82%); }
  .bubble { max-width: 100%; padding: 10px 16px; box-sizing: border-box;
    font-size: var(--dsh-content-font-size, 14px);
    line-height: calc(22px + var(--dsh-content-font-delta, 0px));
    font-weight: 400; white-space: pre-wrap; word-break: break-word; background: #eee; }
`;

test('reader user bubbles match the host cap instead of shrinking to the text', { skip }, async () => {
  const root = resolve(import.meta.dirname, '..');
  const pluginCss = readFileSync(join(root, 'src/client/Reader.module.css'), 'utf8');
  const { launchPinnedChromium } = await import(pathToFileURL(browserRuntime).href);
  const browser = await launchPinnedChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent('<!doctype html><meta charset="utf-8"><style id="host"></style><style id="plugin"></style><div id="app"></div>');
    await page.locator('#host').evaluate((el, css) => { el.textContent = css; }, hostCss);
    await page.locator('#plugin').evaluate((el, css) => { el.textContent = css; }, pluginCss);
    const rows = await page.evaluate(() => {
      const cases = [
        { width: 748, axis: '', text: '升级插件', name: 'short' },
        { width: 748, axis: '', text: '测'.repeat(30), name: 'thirty' },
        { width: 748, axis: '', text: '测'.repeat(80), name: 'long' },
        { width: 480, axis: '', text: '测'.repeat(30), name: 'narrow' },
        { width: 1000, axis: '1000px', text: '测'.repeat(80), name: 'wide-axis' },
      ];
      const widthOf = (el: Element) => Math.round(el.getBoundingClientRect().width * 10) / 10;
      const heightOf = (el: Element) => Math.round(el.getBoundingClientRect().height * 10) / 10;
      return cases.map(item => {
        const reader = document.createElement('div');
        reader.className = 'root';
        reader.style.width = `${item.width}px`;
        reader.style.padding = '0';
        if (item.axis) reader.style.setProperty('--dsh-chat-content-width', item.axis);
        const column = document.createElement('div');
        column.className = 'column';
        const turn = document.createElement('section');
        turn.className = 'turn';
        const cluster = document.createElement('div');
        cluster.className = 'userCluster';
        const slot = document.createElement('div');
        slot.dataset.slot = 'conversation.chat.node';
        slot.style.display = 'contents';
        const row = document.createElement('div');
        row.className = 'userRow';
        const stack = document.createElement('div');
        stack.className = 'userStack';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = item.text;
        stack.append(bubble);
        row.append(stack);
        slot.append(row);
        cluster.append(slot);
        const pendingCluster = document.createElement('div');
        pendingCluster.className = 'userCluster';
        pendingCluster.dataset.readerPendingSubmission = '';
        const pending = document.createElement('div');
        pending.className = 'user';
        pending.textContent = item.text;
        pendingCluster.append(pending);
        turn.append(cluster);
        column.append(turn, pendingCluster);
        reader.append(column);

        const nativeColumn = document.createElement('div');
        nativeColumn.className = 'column';
        nativeColumn.style.width = `${item.width}px`;
        if (item.axis) nativeColumn.style.setProperty('--dsh-chat-content-width', item.axis);
        const nativeRow = document.createElement('div');
        nativeRow.className = 'userRow';
        const nativeStack = document.createElement('div');
        nativeStack.className = 'userStack';
        const nativeBubble = document.createElement('div');
        nativeBubble.className = 'bubble';
        nativeBubble.textContent = item.text;
        nativeStack.append(nativeBubble);
        nativeRow.append(nativeStack);
        nativeColumn.append(nativeRow);
        document.body.append(reader, nativeColumn);
        const pendingStyle = getComputedStyle(pending);
        return {
          name: item.name,
          cluster: widthOf(cluster),
          bubble: widthOf(bubble),
          bubbleH: heightOf(bubble),
          pending: widthOf(pending),
          pendingH: heightOf(pending),
          pendingFont: pendingStyle.fontSize,
          pendingLine: pendingStyle.lineHeight,
          native: widthOf(nativeBubble),
          nativeH: heightOf(nativeBubble),
          stackMax: getComputedStyle(stack).maxWidth,
        };
      });
    });
    for (const row of rows) {
      assert.equal(row.bubble, row.native, `${row.name} official bubble`);
      assert.equal(row.bubbleH, row.nativeH, `${row.name} official height`);
      assert.equal(row.pending, row.native, `${row.name} pending bubble`);
      assert.equal(row.pendingH, row.nativeH, `${row.name} pending height`);
      assert.equal(row.pendingFont, '14px', `${row.name} pending font`);
      assert.equal(row.pendingLine, '22px', `${row.name} pending line`);
      assert.equal(row.stackMax, '100%', `${row.name} host stack cap`);
    }
    const byName = Object.fromEntries(rows.map(row => [row.name, row]));
    assert.ok(Math.abs(byName.short.bubble - byName.short.cluster) > 100, 'a short bubble stays content-sized inside the cap');
    assert.ok(byName.short.bubbleH < 50, 'a four-glyph message stays on one line');
    assert.ok(byName.thirty.bubbleH < 50, 'thirty glyphs fit on one line at the default column');
    assert.ok(Math.abs(byName.long.cluster - 748 * 0.702) < 1, 'default cap follows 748 * 0.702');
    assert.ok(byName['wide-axis'].bubble > 540, 'a wider content axis is not stuck at 525px');
    assert.ok(Math.abs(byName.narrow.cluster - 480 * 0.82) < 1, 'a narrow column uses 82% of the column');
  } finally {
    await browser.close();
  }
});
