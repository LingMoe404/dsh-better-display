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
export function reconcileTurnSlots(current, groups) {
    const incoming = new Map(groups.map(group => [group.key, group]));
    const next = groups.map(group => ({ group, live: true }));
    for (const slot of current) {
        if (incoming.has(slot.group.key))
            continue;
        insertDeparting(next, { group: slot.group, live: false }, precedingLiveKey(current, incoming, slot.group.key));
    }
    const same = next.length === current.length &&
        next.every((slot, index) => slot.live === current[index].live && slot.group === current[index].group);
    return same ? current : next;
}
/** Nearest preceding slot that is still in the incoming order, if any. */
function precedingLiveKey(current, incoming, key) {
    const index = current.findIndex(slot => slot.group.key === key);
    for (let cursor = index - 1; cursor >= 0; cursor--) {
        const candidate = current[cursor].group.key;
        if (incoming.has(candidate))
            return candidate;
    }
    return undefined;
}
/**
 * Place a departing slot after `anchorKey`, or at the front when the slot had
 * no preceding live neighbour. Slots that share an anchor keep `current` order
 * because each one is inserted at the end of the departing run after that anchor.
 */
function insertDeparting(next, slot, anchorKey) {
    if (anchorKey === undefined) {
        const firstLive = next.findIndex(item => item.live);
        next.splice(firstLive < 0 ? next.length : firstLive, 0, slot);
        return;
    }
    const anchorIndex = next.findIndex(item => item.group.key === anchorKey);
    if (anchorIndex < 0) {
        next.unshift(slot);
        return;
    }
    let insertAt = anchorIndex + 1;
    while (insertAt < next.length && next[insertAt]?.live === false)
        insertAt++;
    next.splice(insertAt, 0, slot);
}
//# sourceMappingURL=turn-slots.js.map