/** One turn lane: `live` while it is still in the visible order. */
export interface TurnSlot<T extends { readonly key: string }> {
  readonly group: T;
  readonly live: boolean;
}

/**
 * Keep a departing turn at its previous index and mark it `live: false`.
 *
 * A rewind removes turn keys from the visible order. Unmounting them in that
 * same commit snaps the transcript, so the lane retains the last group object
 * until the collapse finishes. A re-render, a stream tick, or a reconnect that
 * still contains the same keys only replaces the group object and leaves
 * `live` true — those updates must not start a collapse. A key that returns
 * becomes live again in place. New keys append.
 *
 * Returns `current` itself when nothing changed, so a React state update can
 * bail out on `Object.is`.
 */
export function reconcileTurnSlots<T extends { readonly key: string }>(
  current: readonly TurnSlot<T>[],
  groups: readonly T[]
): readonly TurnSlot<T>[] {
  const incoming = new Map(groups.map(group => [group.key, group]));
  const next: TurnSlot<T>[] = [];
  for (const slot of current) {
    const stillLive = incoming.get(slot.group.key);
    if (stillLive === undefined) {
      next.push({ group: slot.group, live: false });
      continue;
    }
    incoming.delete(slot.group.key);
    next.push({ group: stillLive, live: true });
  }
  for (const group of groups) if (incoming.has(group.key)) next.push({ group, live: true });
  const same =
    next.length === current.length &&
    next.every(
      (slot, index) => slot.live === current[index]!.live && slot.group === current[index]!.group
    );
  return same ? current : next;
}
