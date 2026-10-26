import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useLayoutEffect, useRef } from 'react';
const MIN_LANE_PX = 40;
const LaneOwnerContext = createContext(null);
const ownersByRoot = new WeakMap();
/** One map per Reader, so two roots that both contain turn 1 do not share a writer. */
export function ReaderLaneScope({ children }) {
    const owners = useRef(new Map());
    useLayoutEffect(() => {
        const map = owners.current;
        return () => { map.clear(); };
    }, []);
    return _jsx(LaneOwnerContext.Provider, { value: owners.current, children: children });
}
function laneScope(el) {
    return el.closest('[data-reader-turn]') ?? el.closest('[data-dsh-better-display]');
}
function ownersFor(el, scoped) {
    if (scoped)
        return scoped;
    const root = el.closest('[data-dsh-better-display]') ?? el;
    let owners = ownersByRoot.get(root);
    if (!owners) {
        owners = new Map();
        ownersByRoot.set(root, owners);
    }
    return owners;
}
function publishedLanePx(el) {
    return Math.max(MIN_LANE_PX, Math.ceil(el.getBoundingClientRect().height));
}
/** One writer per turn inside a single Reader. A retiring summary cannot clear the lane that replaced it. */
export function publishLaneHeight(el, property, scoped = null) {
    const scope = laneScope(el);
    if (!scope)
        return () => { };
    const owners = ownersFor(el, scoped);
    const root = el.closest('[data-dsh-better-display]');
    const key = `${property}\0${scope.getAttribute('data-reader-turn') ?? 'root'}`;
    const update = () => {
        if (owners.get(key) !== el)
            return;
        scope.style.setProperty(property, `${publishedLanePx(el)}px`);
    };
    owners.set(key, el);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
        observer.disconnect();
        if (owners.get(key) !== el)
            return;
        owners.delete(key);
        scope.style.removeProperty(property);
        if (!scoped && root && owners.size === 0)
            ownersByRoot.delete(root);
    };
}
export function usePublishedHeight(property) {
    const owners = useContext(LaneOwnerContext);
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        return publishLaneHeight(el, property, owners);
    }, [owners, property]);
    return ref;
}
export function useSummaryLane(ref, active) {
    const owners = useContext(LaneOwnerContext);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!active || !el)
            return;
        return publishLaneHeight(el, '--reader-summary-height', owners);
    }, [active, owners, ref]);
}
/** Publish real lane geometry; wrapped labels must not collide with statistics. */
export function StickyLane({ kind, className, children }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        const scope = el?.closest(kind === 'toolbar' ? '[data-dsh-better-display]' : '[data-reader-turn]');
        if (!el || !scope)
            return;
        const property = kind === 'toolbar' ? '--reader-toolbar-height' : '--reader-status-height';
        const update = () => {
            scope.style.setProperty(property, `${Math.max(MIN_LANE_PX, el.getBoundingClientRect().height)}px`);
            if (kind !== 'toolbar')
                return;
            // The status lane is sized as calc(100% - --reader-control-width), so this
            // must reserve the WHOLE control group. Measuring only the first button
            // left every later control painted over by the status lane.
            const controls = el.querySelectorAll('button');
            let width = 80;
            if (controls.length > 0) {
                const first = controls[0].getBoundingClientRect();
                const last = controls[controls.length - 1].getBoundingClientRect();
                width = last.right - first.left;
            }
            scope.style.setProperty('--reader-control-width', `${width + 28}px`);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        if (kind === 'toolbar')
            for (const control of el.querySelectorAll('button'))
                observer.observe(control);
        return () => { observer.disconnect(); scope.style.removeProperty(property); if (kind === 'toolbar')
            scope.style.removeProperty('--reader-control-width'); };
    }, [kind]);
    return _jsx("div", { ref: ref, className: className, "data-reader-lane": kind, "data-ud-check": kind === 'toolbar' ? 'reader-toolbar' : undefined, children: children });
}
//# sourceMappingURL=StickyLane.js.map