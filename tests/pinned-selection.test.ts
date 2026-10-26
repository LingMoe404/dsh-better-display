import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('pinned selection', () => {
  it('covers every Reader body marker, so final formatting keeps a live selection', () => {
    const reader = [read('../src/client/Reader.tsx'), read('../src/client/AssistantNode.tsx')].join('\n');
    const motion = read('../src/client/motion.tsx');
    const selector = /usePinnedSelection\([^)]*selector = '([^']+)'/.exec(motion)?.[1] ?? '';
    const markers = ['data-reader-answer', 'data-reader-body'].filter(marker => new RegExp(`<article[^>]*\\b${marker}\\b`).test(reader));
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) expect(selector).toContain(`[${marker}]`);
    expect(selector).toContain('[data-reader-process]');
  });
});
