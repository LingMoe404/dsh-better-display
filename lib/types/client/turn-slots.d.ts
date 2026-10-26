/** One turn lane: `live` while it is still in the visible order. */
export interface TurnSlot<T extends {
    readonly key: string;
}> {
    readonly group: T;
    readonly live: boolean;
}
/**
 * Keep live turns in the incoming `groups` order, and keep a departing turn
 * next to the live neighbour that preceded it.
 *
 * A rewind removes turn keys from the visible order. Unmounting them in that
 * same commit snaps the transcript, so the lane retains the last group object
 * until the collapse finishes. A re-render, a stream tick, or a reconnect that
 * still contains the same keys only replaces the group object and leaves
 * `live` true — those updates must not start a collapse. A key that returns
 * is live again where `groups` places it. Loading older history therefore
 * stays in transcript order instead of appending the older turns after the
 * ones already on screen. A departing slot is inserted immediately after the
 * nearest preceding slot that is still live, or at the front when it had none,
 * so several departing neighbours keep their relative order.
 *
 * Returns `current` itself when nothing changed, so a React state update can
 * bail out on `Object.is`.
 */
export declare function reconcileTurnSlots<T extends {
    readonly key: string;
}>(current: readonly TurnSlot<T>[], groups: readonly T[]): readonly TurnSlot<T>[];
//# sourceMappingURL=turn-slots.d.ts.map