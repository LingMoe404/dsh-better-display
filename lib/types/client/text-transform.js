import { useEffect, useMemo, useState } from 'react';
/**
 * Cordis service name. Another client plugin lists this in `inject` and
 * registers a transformer. The reading view paints the result. The session
 * block, transcript, and fold inputs stay on the original text.
 */
export const TEXT_TRANSFORM_SERVICE = 'dsh-better-display.text-transform';
const KINDS = new Set(['reasoning', 'body']);
function isKind(value) {
    return KINDS.has(value);
}
function reportTransformError(error) {
    console.warn('[dsh-better-display] text transform failed; showing original text', error);
}
function passthrough(request) {
    return { text: request.text, final: !request.streaming, transformRevision: 0, motionRevision: 0 };
}
function normalize(value, request) {
    if (typeof value === 'string')
        return { text: value, final: !request.streaming };
    if (!value || typeof value.text !== 'string')
        return { text: request.text, final: !request.streaming };
    return { text: value.text, final: typeof value.final === 'boolean' ? value.final : !request.streaming };
}
/**
 * Appends keep the motion revision. A replacement gets a new one so the
 * timeline treats the swapped string as already settled.
 */
export function nextDisplayCursor(previous, display) {
    if (!previous)
        return { ...display, transformRevision: 0, motionRevision: 0 };
    if (previous.text === display.text && previous.final === display.final)
        return previous;
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
export function displayStreaming(sourceStreaming, shown, active) {
    return active ? !shown.final : sourceStreaming;
}
/** No registry, or none for this kind: the source string, and no cursor write. */
export function readDisplayText(registry, request) {
    if (!registry?.has(request.kind))
        return passthrough(request);
    return registry.read(request);
}
class TextTransformRegistryImpl {
    stacks = new Map();
    listeners = new Map();
    cursors = new Map();
    register(kind, transformer) {
        const requested = [...new Set(Array.isArray(kind) ? kind : [kind])];
        for (const item of requested) {
            if (!isKind(item))
                throw new Error(`Unknown display text kind: ${String(item)}`);
        }
        const bound = [];
        for (const item of requested) {
            const entry = { transformer };
            try {
                entry.unsubscribe = transformer.subscribe?.(() => { this.emit(item); });
            }
            catch (error) {
                reportTransformError(error);
            }
            const stack = this.stacks.get(item) ?? [];
            stack.push(entry);
            this.stacks.set(item, stack);
            bound.push({ kind: item, entry });
            this.emit(item);
        }
        return () => {
            for (const { kind: item, entry } of bound) {
                try {
                    entry.unsubscribe?.();
                }
                catch (error) {
                    reportTransformError(error);
                }
                const stack = this.stacks.get(item);
                if (!stack)
                    continue;
                const next = stack.filter(candidate => candidate !== entry);
                if (next.length > 0)
                    this.stacks.set(item, next);
                else
                    this.stacks.delete(item);
                this.emit(item);
            }
        };
    }
    has(kind) {
        return (this.stacks.get(kind)?.length ?? 0) > 0;
    }
    read(request) {
        const transformer = this.stacks.get(request.kind)?.at(-1)?.transformer;
        if (!transformer)
            return passthrough(request);
        let display;
        try {
            display = normalize(transformer.read(request), request);
        }
        catch (error) {
            // A broken transformer must never hide the original text. Show it and
            // ask again on the next text change or notify, so a recovered
            // transformer takes over without a remount.
            reportTransformError(error);
            display = { text: request.text, final: !request.streaming };
        }
        const key = `${request.kind}\u0000${request.blockKey}`;
        const next = nextDisplayCursor(this.cursors.get(key), display);
        this.cursors.set(key, next);
        return next;
    }
    subscribe(kind, listener) {
        const set = this.listeners.get(kind) ?? new Set();
        set.add(listener);
        this.listeners.set(kind, set);
        return () => { set.delete(listener); };
    }
    release(kind, blockKey) {
        this.cursors.delete(`${kind}\u0000${blockKey}`);
    }
    emit(kind) {
        const set = this.listeners.get(kind);
        if (!set)
            return;
        for (const listener of [...set])
            listener();
    }
}
export function createTextTransformRegistry() {
    return new TextTransformRegistryImpl();
}
let active;
/** Points the reading view at the registry this client plugin provides. */
export function installTextTransformRegistry(registry) {
    const previous = active;
    active = registry;
    return () => { active = previous; };
}
export function activeTextTransform() {
    return active;
}
/**
 * Subscribe while mounted. The reveal components call this only after
 * `has(kind)`, so an empty registry adds no hook and no listener.
 */
export function useDisplayText(registry, request) {
    const [epoch, setEpoch] = useState(0);
    const { text, streaming, blockKey, kind, source } = request;
    useEffect(() => registry.subscribe(kind, () => { setEpoch(value => value + 1); }), [registry, kind]);
    useEffect(() => () => { registry.release(kind, blockKey); }, [registry, kind, blockKey]);
    return useMemo(() => registry.read({ text, streaming, blockKey, kind, source }), [registry, text, streaming, blockKey, kind, source, epoch]);
}
/** Chain-slot owner. Extra fields are optional so older callers still type-check. */
export function readerBlockOwner(block, streaming, source, presentation, holdFormatting) {
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
export function originalAnswerText(blocks) {
    return blocks.flatMap(block => block.kind === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n\n');
}
//# sourceMappingURL=text-transform.js.map