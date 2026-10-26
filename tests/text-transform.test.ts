import assert from 'node:assert/strict';
import { test } from 'vitest';
import { StreamBuffer } from '../src/client/stream-buffer.js';
import {
  activeTextTransform,
  createTextTransformRegistry,
  displayStreaming,
  installTextTransformRegistry,
  nextDisplayCursor,
  originalAnswerText,
  readDisplayText,
  readerBlockOwner,
  type DisplayTextRequest,
} from '../src/client/text-transform.js';
import type { ReaderBlockOwner } from '../src/client/types.js';
import { WordTimeline } from '../src/client/word-timeline.js';

const reasoning = (text: string, streaming = true, blockKey = 'block-1'): DisplayTextRequest => ({
  text, streaming, blockKey, kind: 'reasoning', source: 'assistant',
});

test('no transformer leaves the source text and the streaming flag untouched', () => {
  const registry = createTextTransformRegistry();
  const request = reasoning('Hello world', true);
  const shown = readDisplayText(registry, request);
  assert.equal(shown.text, request.text);
  assert.equal(shown.final, false);
  assert.equal(shown.motionRevision, 0);
  assert.equal(shown.transformRevision, 0);
  assert.equal(readDisplayText(undefined, request).text, 'Hello world');
  assert.equal(displayStreaming(true, shown, false), true);
  assert.equal(displayStreaming(false, { final: true }, false), false);
  assert.equal(registry.has('reasoning'), false);
  assert.equal(registry.has('body'), false);
});

test('a sync transformer rewrites the display string and leaves the block alone', () => {
  const registry = createTextTransformRegistry();
  const source = 'Hello';
  const block = { kind: 'text' as const, text: source };
  registry.register('body', {
    read: request => ({ text: request.text.toUpperCase(), final: !request.streaming }),
  });
  const streaming = readDisplayText(registry, { text: source, streaming: true, blockKey: 'a', kind: 'body', source: 'assistant' });
  const settled = readDisplayText(registry, { text: source, streaming: false, blockKey: 'a', kind: 'body', source: 'assistant' });
  assert.equal(streaming.text, 'HELLO');
  assert.equal(streaming.final, false);
  assert.equal(displayStreaming(true, streaming, true), true);
  assert.equal(settled.text, 'HELLO');
  assert.equal(settled.final, true);
  assert.equal(displayStreaming(false, settled, true), false);
  assert.equal(source, 'Hello');
  assert.equal(block.text, 'Hello');
  assert.equal(originalAnswerText([block, { kind: 'reasoning', text: 'secret thought' }]), 'Hello');
});

test('an async append bumps the transform revision without restarting the reveal', () => {
  const registry = createTextTransformRegistry();
  let shown = 'Hello';
  const listeners = new Set<() => void>();
  registry.register('reasoning', {
    read: () => ({ text: shown, final: false }),
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  });
  const request = reasoning('thinking starts', true);
  const first = registry.read(request);
  assert.equal(first.text, 'Hello');
  assert.equal(first.transformRevision, 0);
  assert.equal(first.motionRevision, 0);

  const buffer = new StreamBuffer('');
  const timeline = new WordTimeline();
  timeline.begin('', true, 0, 0);
  const paint = (text: string, now: number) => {
    buffer.update(text, now, { finished: false });
    buffer.advance(now + 120);
    timeline.begin(buffer.visible, true, buffer.revision, now + 120);
  };
  paint(first.text, 100);
  assert.equal(buffer.revision, 0);
  assert.ok(buffer.visible.length > 0);
  const generation = timeline.generation;
  const prefixBorn = timeline.bornAt(0);
  const visible = buffer.visible;
  assert.notEqual(prefixBorn, null);

  shown = 'Hello there';
  for (const listener of listeners) listener();
  const second = registry.read(request);
  assert.equal(second.text, 'Hello there');
  assert.equal(second.motionRevision, first.motionRevision);
  assert.equal(second.transformRevision, first.transformRevision + 1);
  paint(second.text, 400);
  assert.equal(buffer.revision, 0);
  assert.ok(buffer.visible.startsWith(visible));
  assert.ok(buffer.visible.length > visible.length);
  assert.equal(timeline.generation, generation);
  assert.equal(timeline.bornAt(0), prefixBorn);

  // The transform counter is a different clock. Feeding it to the timeline
  // settles the paragraph; the reader does not do that.
  const trap = new WordTimeline();
  trap.begin('', true, 0, 0);
  trap.begin(visible, true, first.motionRevision, 220);
  const trapGeneration = trap.generation;
  trap.begin(second.text, true, second.transformRevision, 520);
  assert.notEqual(trap.generation, trapGeneration);
});

test('a replaced translation settles on the new string instead of replaying from empty', () => {
  const registry = createTextTransformRegistry();
  let shown = 'Hello there';
  registry.register('reasoning', {
    read: () => ({ text: shown, final: false }),
  });
  const request = reasoning('source', true);
  const first = registry.read(request);
  const buffer = new StreamBuffer('');
  buffer.update(first.text, 100);
  buffer.advance(220);
  assert.equal(buffer.visible, 'Hello there');
  const timeline = new WordTimeline();
  timeline.begin('', true, buffer.revision, 0);
  timeline.begin(buffer.visible, true, buffer.revision, 220);
  const generation = timeline.generation;

  shown = '你好世界';
  const second = registry.read(request);
  assert.equal(second.motionRevision, first.motionRevision + 1);
  assert.ok(second.transformRevision > first.transformRevision);
  buffer.update(second.text, 400);
  assert.equal(buffer.visible, '你好世界');
  assert.notEqual(buffer.visible, '');
  assert.equal(buffer.revision, 1);
  timeline.begin(buffer.visible, true, buffer.revision, 400);
  assert.notEqual(timeline.generation, generation);
  assert.equal(timeline.bornAt(0), null);
});

test('the block owner carries presentation, holdFormatting, and liveText', () => {
  const block = { kind: 'reasoning' as const, text: 'original' };
  const owner = readerBlockOwner(block as ReaderBlockOwner['block'], true, 'assistant', {
    startedAt: 42, interrupted: false, liveText: true,
  }, false);
  assert.equal(owner.block, block);
  assert.equal(owner.streaming, true);
  assert.equal(owner.source, 'assistant');
  assert.deepEqual(owner.presentation, { startedAt: 42, interrupted: false, liveText: true });
  assert.equal(owner.holdFormatting, false);
  assert.equal(owner.liveText, true);
  assert.equal(owner.block.text, 'original');
  const bare: ReaderBlockOwner = { block: owner.block, streaming: false, source: 'user' };
  assert.equal(bare.presentation, undefined);
  assert.equal(bare.holdFormatting, undefined);
  assert.equal(bare.liveText, undefined);
});

test('unregistering restores the original text and the install pointer nests', () => {
  const registry = createTextTransformRegistry();
  const dispose = registry.register(['reasoning', 'body'], {
    read: request => request.text.toUpperCase(),
  });
  assert.equal(registry.has('reasoning'), true);
  assert.equal(registry.has('body'), true);
  assert.equal(readDisplayText(registry, reasoning('Ab')).text, 'AB');
  dispose();
  assert.equal(registry.has('reasoning'), false);
  assert.equal(readDisplayText(registry, reasoning('Ab')).text, 'Ab');

  const outer = createTextTransformRegistry();
  const restoreOuter = installTextTransformRegistry(outer);
  try {
    assert.equal(activeTextTransform(), outer);
    const inner = createTextTransformRegistry();
    const restoreInner = installTextTransformRegistry(inner);
    try {
      assert.equal(activeTextTransform(), inner);
    } finally {
      restoreInner();
    }
    assert.equal(activeTextTransform(), outer);
  } finally {
    restoreOuter();
  }
  assert.equal(activeTextTransform(), undefined);
});

test('a transformer notify reaches reader subscribers, and release drops the cursor', () => {
  const registry = createTextTransformRegistry();
  let shown = 'Hello';
  let notify = () => {};
  registry.register('reasoning', {
    read: () => ({ text: shown, final: false }),
    subscribe(listener) {
      notify = listener;
      return () => {};
    },
  });
  let seen = 0;
  const stop = registry.subscribe('reasoning', () => { seen += 1; });
  const first = registry.read(reasoning('source'));
  assert.equal(first.text, 'Hello');
  assert.equal(first.transformRevision, 0);
  shown = 'Hello there';
  notify();
  assert.equal(seen, 1);
  const next = registry.read(reasoning('source'));
  assert.equal(next.text, 'Hello there');
  assert.equal(next.motionRevision, 0);
  assert.equal(next.transformRevision, 1);
  stop();
  registry.release('reasoning', 'block-1');
  shown = 'Hello there friend';
  const restarted = registry.read(reasoning('source'));
  assert.equal(restarted.transformRevision, 0);
  assert.equal(restarted.motionRevision, 0);
});

test('an extending display string keeps the motion revision', () => {
  const first = nextDisplayCursor(undefined, { text: 'Hello', final: false });
  const second = nextDisplayCursor(first, { text: 'Hello world', final: false });
  const same = nextDisplayCursor(second, { text: 'Hello world', final: false });
  assert.equal(second.motionRevision, first.motionRevision);
  assert.equal(second.transformRevision, 1);
  assert.equal(same, second);
});

test('a throwing transformer falls back to the original text and recovers without a remount', () => {
  const registry = createTextTransformRegistry();
  let broken = true;
  let notify = () => {};
  const warn = console.warn;
  console.warn = () => {};
  try {
    registry.register('reasoning', {
      subscribe(listener) { notify = listener; return () => {}; },
      read(request) {
        if (broken) throw new Error('engine down');
        return { text: request.text.toUpperCase(), final: !request.streaming };
      },
    });
    const first = registry.read(reasoning('hello', true));
    assert.equal(first.text, 'hello');
    assert.equal(first.final, false);
    broken = false;
    notify();
    const recovered = registry.read(reasoning('hello', true));
    assert.equal(recovered.text, 'HELLO');
  } finally {
    console.warn = warn;
  }
});

test('a transformer whose subscribe throws still registers and reads', () => {
  const registry = createTextTransformRegistry();
  const warn = console.warn;
  console.warn = () => {};
  try {
    const off = registry.register('body', {
      subscribe() { throw new Error('no events'); },
      read(request) { return request.text.toUpperCase(); },
    });
    assert.equal(registry.read({ text: 'ok', streaming: false, blockKey: 'b', kind: 'body', source: 'assistant' }).text, 'OK');
    off();
    assert.equal(registry.has('body'), false);
  } finally {
    console.warn = warn;
  }
});
