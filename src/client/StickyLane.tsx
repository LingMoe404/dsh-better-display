import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

const laneOwners = new Map<string, HTMLElement>();

function laneScope(el: HTMLElement) {
  return el.closest<HTMLElement>('[data-reader-turn]') ?? el.closest<HTMLElement>('[data-dsh-better-display]');
}

/** One writer per turn, so a retiring summary cannot clear the lane that replaced it. */
export function publishLaneHeight(el: HTMLElement, property: string) {
  const scope = laneScope(el);
  if (!scope) return () => {};
  const key = `${property}\0${scope.getAttribute('data-reader-turn') ?? 'root'}`;
  const update = () => {
    if (laneOwners.get(key) !== el) return;
    scope.style.setProperty(property, `${Math.ceil(el.getBoundingClientRect().height)}px`);
  };
  laneOwners.set(key, el);
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  return () => {
    observer.disconnect();
    if (laneOwners.get(key) !== el) return;
    laneOwners.delete(key);
    scope.style.removeProperty(property);
  };
}

export function usePublishedHeight(property: string) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return publishLaneHeight(el, property);
  }, [property]);
  return ref;
}

export function useSummaryLane(ref: { readonly current: HTMLElement | null }, active: boolean) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    return publishLaneHeight(el, '--reader-summary-height');
  }, [active, ref]);
}

/** Publish real lane geometry; wrapped labels must not collide with statistics. */
export function StickyLane({ kind, className, children }: { kind: 'toolbar' | 'status'; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const scope = el?.closest<HTMLElement>(kind === 'toolbar' ? '[data-dsh-better-display]' : '[data-reader-turn]');
    if (!el || !scope) return;
    const property = kind === 'toolbar' ? '--reader-toolbar-height' : '--reader-status-height';
    const update = () => {
      scope.style.setProperty(property, `${el.getBoundingClientRect().height}px`);
      if (kind !== 'toolbar') return;
      // The status lane is sized as calc(100% - --reader-control-width), so this
      // must reserve the WHOLE control group. Measuring only the first button
      // left every later control painted over by the status lane.
      const controls = el.querySelectorAll('button');
      let width = 80;
      if (controls.length > 0) {
        const first = controls[0]!.getBoundingClientRect();
        const last = controls[controls.length - 1]!.getBoundingClientRect();
        width = last.right - first.left;
      }
      scope.style.setProperty('--reader-control-width', `${width + 28}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (kind === 'toolbar') for (const control of el.querySelectorAll('button')) observer.observe(control);
    return () => { observer.disconnect(); scope.style.removeProperty(property); if (kind === 'toolbar') scope.style.removeProperty('--reader-control-width'); };
  }, [kind]);
  return <div ref={ref} className={className} data-reader-lane={kind} data-ud-check={kind === 'toolbar' ? 'reader-toolbar' : undefined}>{children}</div>;
}
