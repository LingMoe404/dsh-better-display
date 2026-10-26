import type { ReaderBlockOwner, ReaderBlockPresentation } from './types.js';
/**
 * Cordis service name. Another client plugin lists this in `inject` and
 * registers a transformer. The reading view paints the result. The session
 * block, transcript, and fold inputs stay on the original text.
 */
export declare const TEXT_TRANSFORM_SERVICE = "dsh-better-display.text-transform";
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
/**
 * Appends keep the motion revision. A replacement gets a new one so the
 * timeline treats the swapped string as already settled.
 */
export declare function nextDisplayCursor(previous: DisplayCursor | undefined, display: DisplayText): DisplayCursor;
/**
 * Streaming flag fed to the reveal. With no transformer this is the model's
 * flag. A transformer that reports `final: !streaming` produces the same flag.
 */
export declare function displayStreaming(sourceStreaming: boolean, shown: Pick<DisplayCursor, 'final'>, active: boolean): boolean;
/** No registry, or none for this kind: the source string, and no cursor write. */
export declare function readDisplayText(registry: TextTransformRegistry | undefined, request: DisplayTextRequest): DisplayCursor;
export declare function createTextTransformRegistry(): TextTransformRegistry;
/** Points the reading view at the registry this client plugin provides. */
export declare function installTextTransformRegistry(registry: TextTransformRegistry | undefined): () => void;
export declare function activeTextTransform(): TextTransformRegistry | undefined;
/**
 * Subscribe while mounted. The reveal components call this only after
 * `has(kind)`, so an empty registry adds no hook and no listener.
 */
export declare function useDisplayText(registry: TextTransformRegistry, request: DisplayTextRequest): DisplayCursor;
/** Chain-slot owner. Extra fields are optional so older callers still type-check. */
export declare function readerBlockOwner(block: ReaderBlockOwner['block'], streaming: boolean, source: ReaderBlockOwner['source'], presentation: ReaderBlockPresentation, holdFormatting: boolean): ReaderBlockOwner;
/** Copy actions read this. Display text never replaces it. */
export declare function originalAnswerText(blocks: readonly {
    readonly kind: string;
    readonly text?: string;
}[]): string;
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Display-only reader text transforms. Present after this client plugin applies. */
        'dsh-better-display.text-transform'?: TextTransformRegistry;
    }
}
//# sourceMappingURL=text-transform.d.ts.map