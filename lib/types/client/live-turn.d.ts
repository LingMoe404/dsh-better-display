import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-ui-chat/client';
import type { AssistantBlock } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { TurnBoundary } from './projection.js';
import type { ReaderFlowEntry, ToolActivityEntry } from './tool-activity.js';
export type LiveStep = {
    kind: 'reasoning';
    key: string;
    nodeKey: string;
    start: number;
    blocks: AssistantBlock[];
    step: number;
} | {
    kind: 'body';
    key: string;
    nodeKey: string;
    start: number;
    blocks: AssistantBlock[];
    step: number;
} | {
    kind: 'tool';
    key: string;
    entry: ToolActivityEntry;
} | {
    kind: 'user';
    key: string;
    nodeKey: string;
} | {
    kind: 'other';
    key: string;
    nodeKey: string;
};
export type LiveTurnItem = {
    kind: 'user';
    key: string;
    step: Extract<LiveStep, {
        kind: 'user';
    }>;
} | {
    kind: 'fold';
    key: string;
    steps: readonly LiveStep[];
    summary: string;
} | {
    kind: 'open';
    key: string;
    step: LiveStep;
};
export declare function liveFoldEnabled(boundary: TurnBoundary): boolean;
export declare function foldSummary(steps: readonly LiveStep[]): string;
/** Expand readerFlow into source-ordered live steps using existing block boundaries. */
export declare function segmentLiveTurn(flow: readonly ReaderFlowEntry[], get: (key: string) => ChatConversationViewNode | undefined): LiveStep[];
/**
 * One live chain: narration stays visible, while every earlier reasoning/tool
 * run collapses into its own box at its original position.
 */
export declare function presentLiveTurn(steps: readonly LiveStep[], boundary: TurnBoundary, autoFold?: boolean): LiveTurnItem[];
/**
 * Summaries for collapsed process that sits between two narration blocks.
 *
 * A live-fold cell already shows that summary while the turn is open. Drawing
 * the seam as well repeats the same counts, so a run whose every step is
 * already inside a fold cell contributes neither a seam nor `after`. `after`
 * is what marks the previous body with `data-reader-seam-after` and drops its
 * bottom padding; skipping the seam must leave that spacing alone.
 */
export declare function planProcessSeams(steps: readonly LiveStep[], liveItems: readonly LiveTurnItem[], expanded: boolean): {
    before: Map<string, string>;
    after: Set<string>;
};
//# sourceMappingURL=live-turn.d.ts.map