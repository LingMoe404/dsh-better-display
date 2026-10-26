import type { RefObject } from 'react';
import type { TurnBoundary } from './projection.js';
import type { BlockRenderProps, ReaderProps } from './types.js';
type SeatProps = BlockRenderProps & Pick<ReaderProps, 'useChat' | 'sessionId'> & {
    nodeKey: string;
    boundary: TurnBoundary;
    pinned?: boolean;
    processOpen?: boolean;
};
export declare const AssistantNode: import("react").MemoExoticComponent<({ useChat, nodeKey, boundary, processOpen, pinned, folded, partStart, seamSummary, seamAfter, motion, onRead, returnFocusTo, ...render }: SeatProps & {
    motion: boolean;
    onRead: () => void;
    returnFocusTo: RefObject<HTMLButtonElement>;
    partStart?: number;
    folded?: boolean;
    seamSummary?: string;
    seamAfter?: boolean;
}) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=AssistantNode.d.ts.map