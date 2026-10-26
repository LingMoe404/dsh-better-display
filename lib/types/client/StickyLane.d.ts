import type { ReactNode } from 'react';
type LaneOwners = Map<string, HTMLElement>;
/** One map per Reader, so two roots that both contain turn 1 do not share a writer. */
export declare function ReaderLaneScope({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
/** One writer per turn inside a single Reader. A retiring summary cannot clear the lane that replaced it. */
export declare function publishLaneHeight(el: HTMLElement, property: string, scoped?: LaneOwners | null): () => void;
export declare function usePublishedHeight(property: string): import("react").RefObject<HTMLDivElement>;
export declare function useSummaryLane(ref: {
    readonly current: HTMLElement | null;
}, active: boolean): void;
/** Publish real lane geometry; wrapped labels must not collide with statistics. */
export declare function StickyLane({ kind, className, children }: {
    kind: 'toolbar' | 'status';
    className: string;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=StickyLane.d.ts.map