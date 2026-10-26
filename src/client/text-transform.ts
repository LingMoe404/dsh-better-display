import { useEffect, useMemo, useState } from 'react';
import type { ReaderBlockOwner, ReaderBlockPresentation } from './types.js';

/**
 * Cordis service name. Another client plugin lists this in `inject` and
 * registers a transformer. The reading view paints the result. The session
 * block, transcript, and fold inputs stay on the original text.
 */
export const TEXT_TRANSFORM_SERVICE = 'dsh-better-display.text-transform';

export type DisplayTextKind = 'reasoning' | 'body';

export interface DisplayTextRequest {
  /** Original block text. Registrants must not write it back onto the block. */
  text: string;
  streaming: boolean;
  /** Opaque id of this mounted block. Stable until the block unmounts. */
  blockKey: string;
  kind: DisplayTextKind;
  /** Assistant body and reasoning are the usual targets. Tool prose uses `tool`. */
  source?: ReaderBlockOwner['source'];
}

export interface DisplayText {
  text: string;
  /**
   * True when this string is the settled display for the current source.
   * False keeps the live reveal open, including after the model has stopped
   * but a translation batch is still outstanding.
   */
  final: boolean;
}

/**
 * Sync `read` on every paint, plus `subscribe` when a later batch changes
 * what `read` returns. `subscribe` may be called once per kind and must
 * accept more than one listener.
 */
export interface DisplayTextTransformer {
  read(request: DisplayTextRequest): DisplayText | string | undefined;
  subscribe?(listener: () => void): () => void;
}

export interface DisplayCursor extends DisplayText {
  /**
   * Increments when the displayed string or its `final` bit changes.
   * This is not the reveal clock. Passing it to the word timeline as the
   * motion revision replays or snaps the paragraph.
   */
  transformRevision: number;
  /**
   * Reveal identity. Stays put when the new string extends the previous
   * display string, so an appended translation batch continues the fade.
   * Increments only when the string is replaced, which settles the new
   * text instead of typing it again from the first grapheme.
   */
  motionRevision: number;
}

export interface TextTransformRegistry {
  register(kind: DisplayTextKind | readonly DisplayTextKind[], transformer: DisplayTextTransformer): () => void;
  has(kind: DisplayTextKind): boolean;
  read(request: DisplayTextRequest): DisplayCursor;
  subscribe(kind: DisplayTextKind, listener: () => void): () => void;
  release(kind: DisplayTextKind, blockKey: string): void;
}

const KINDS = new Set<DisplayTextKind>(['reasoning', 'body']);

function isKind(value: string): value is DisplayTextKind {
  return KINDS.has(value as DisplayTextKind);
}

function passthrough(request: DisplayTextRequest): DisplayCursor {
  return { text: request.text, final: !request.streaming, transformRevision: 0, motionRevision: 0 };
}

function normalize(value: DisplayText | string | undefined, request: DisplayTextRequest): DisplayText {
  if (typeof value === 'string') return { text: value, final: !request.streaming };
  if (!value || typeof value.text !== 'string') return { text: request.text, final: !request.streaming };
  return { text: value.text, final: typeof value.final === 'boolean' ? value.final : !request.streaming };
}

/**
 * Appends keep the motion revision. A replacement gets a new one so the
 * timeline treats the swapped string as already settled.
 */
export function nextDisplayCursor(previous: DisplayCursor | undefined, display: DisplayText): DisplayCursor {
  if (!previous) return { ...display, transformRevision: 0, motionRevision: 0 };
  if (previous.text === display.text && previous.final === display.final) return previous;
  const appended = display.text.startsWith(previous.text);
  return {
    text: display.text,
    final: display.final,
    transformRevision: previous.transformRevision + 1,
    motionRevision: appended ? previous.motionRevision : previous.motionRevision + 1,
  };
}

/**
 * Streaming flag fed to the reveal. With no transformer this is the model's
 * flag. A transformer that reports `final: !streaming` produces the same flag.
 */
export function displayStreaming(sourceStreaming: boolean, shown: Pick<DisplayCursor, 'final'>, active: boolean): boolean {
  return active ? !shown.final : sourceStreaming;
}

/** No registry, or none for this kind: the source string, and no cursor write. */
export function readDisplayText(registry: TextTransformRegistry | undefined, request: DisplayTextRequest): DisplayCursor {
  if (!registry?.has(request.kind)) return passthrough(request);
  return registry.read(request);
}

interface StackEntry {
  transformer: DisplayTextTransformer;
  unsubscribe?: () => void;
}

class TextTransformRegistryImpl implements TextTransformRegistry {
  private readonly stacks = new Map<DisplayTextKind, StackEntry[]>();
  private readonly listeners = new Map<DisplayTextKind, Set<() => void>>();
  private readonly cursors = new Map<string, DisplayCursor>();

  register(kind: DisplayTextKind | readonly DisplayTextKind[], transformer: DisplayTextTransformer): () => void {
    const requested = [...new Set(Array.isArray(kind) ? kind : [kind])];
    for (const item of requested) {
      if (!isKind(item)) throw new Error(`Unknown display text kind: ${String(item)}`);
    }
    const bound: { kind: DisplayTextKind; entry: StackEntry }[] = [];
    for (const item of requested) {
      const entry: StackEntry = { transformer };
      entry.unsubscribe = transformer.subscribe?.(() => { this.emit(item); });
      const stack = this.stacks.get(item) ?? [];
      stack.push(entry);
      this.stacks.set(item, stack);
      bound.push({ kind: item, entry });
      this.emit(item);
    }
    return () => {
      for (const { kind: item, entry } of bound) {
        entry.unsubscribe?.();
        const stack = this.stacks.get(item);
        if (!stack) continue;
        const next = stack.filter(candidate => candidate !== entry);
        if (next.length > 0) this.stacks.set(item, next);
        else this.stacks.delete(item);
        this.emit(item);
      }
    };
  }

  has(kind: DisplayTextKind): boolean {
    return (this.stacks.get(kind)?.length ?? 0) > 0;
  }

  read(request: DisplayTextRequest): DisplayCursor {
    const transformer = this.stacks.get(request.kind)?.at(-1)?.transformer;
    if (!transformer) return passthrough(request);
    const display = normalize(transformer.read(request), request);
    const key = `${request.kind}\u0000${request.blockKey}`;
    const next = nextDisplayCursor(this.cursors.get(key), display);
    this.cursors.set(key, next);
    return next;
  }

  subscribe(kind: DisplayTextKind, listener: () => void): () => void {
    const set = this.listeners.get(kind) ?? new Set();
    set.add(listener);
    this.listeners.set(kind, set);
    return () => { set.delete(listener); };
  }

  release(kind: DisplayTextKind, blockKey: string): void {
    this.cursors.delete(`${kind}\u0000${blockKey}`);
  }

  private emit(kind: DisplayTextKind): void {
    const set = this.listeners.get(kind);
    if (!set) return;
    for (const listener of [...set]) listener();
  }
}

export function createTextTransformRegistry(): TextTransformRegistry {
  return new TextTransformRegistryImpl();
}

let active: TextTransformRegistry | undefined;

/** Points the reading view at the registry this client plugin provides. */
export function installTextTransformRegistry(registry: TextTransformRegistry | undefined): () => void {
  const previous = active;
  active = registry;
  return () => { active = previous; };
}

export function activeTextTransform(): TextTransformRegistry | undefined {
  return active;
}

/**
 * Subscribe while mounted. The reveal components call this only after
 * `has(kind)`, so an empty registry adds no hook and no listener.
 */
export function useDisplayText(registry: TextTransformRegistry, request: DisplayTextRequest): DisplayCursor {
  const [epoch, setEpoch] = useState(0);
  const { text, streaming, blockKey, kind, source } = request;
  useEffect(() => registry.subscribe(kind, () => { setEpoch(value => value + 1); }), [registry, kind]);
  useEffect(() => () => { registry.release(kind, blockKey); }, [registry, kind, blockKey]);
  return useMemo(
    () => registry.read({ text, streaming, blockKey, kind, source }),
    [registry, text, streaming, blockKey, kind, source, epoch],
  );
}

/** Chain-slot owner. Extra fields are optional so older callers still type-check. */
export function readerBlockOwner(
  block: ReaderBlockOwner['block'],
  streaming: boolean,
  source: ReaderBlockOwner['source'],
  presentation: ReaderBlockPresentation,
  holdFormatting: boolean,
): ReaderBlockOwner {
  return {
    block,
    streaming,
    source,
    presentation: {
      startedAt: presentation.startedAt,
      interrupted: presentation.interrupted,
      liveText: presentation.liveText,
    },
    holdFormatting,
    liveText: presentation.liveText,
  };
}

/** Copy actions read this. Display text never replaces it. */
export function originalAnswerText(blocks: readonly { readonly kind: string; readonly text?: string }[]): string {
  return blocks.flatMap(block => block.kind === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n\n');
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Display-only reader text transforms. Present after this client plugin applies. */
    'dsh-better-display.text-transform'?: TextTransformRegistry;
  }
}
