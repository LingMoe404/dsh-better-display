export const ROUTE_REVEAL = '/better-display/reveal';
export const ROUTE_SKILL_STATUS = '/better-display/skill-status';
export const ROUTE_METRICS = '/better-display/metrics';
export const ROUTE_HITS = [ROUTE_REVEAL, ROUTE_SKILL_STATUS, ROUTE_METRICS];
const hits = new Map(ROUTE_HITS.map(route => [route, 0]));
const timings = new Map(ROUTE_HITS.map(route => [route, { count: 0, totalMs: 0, maxMs: 0 }]));
function snapshotHits() {
    return Object.fromEntries(hits);
}
function snapshotTimings() {
    return Object.fromEntries([...timings].map(([route, timing]) => [route, { ...timing }]));
}
export function recordRouteHit(route) {
    const next = (hits.get(route) ?? 0) + 1;
    hits.set(route, next);
    return next;
}
export function recordRouteDuration(route, elapsedMs) {
    const ms = Number.isFinite(elapsedMs) && elapsedMs > 0 ? Math.round(elapsedMs) : 0;
    const current = timings.get(route) ?? { count: 0, totalMs: 0, maxMs: 0 };
    const next = {
        count: current.count + 1,
        totalMs: current.totalMs + ms,
        maxMs: Math.max(current.maxMs, ms),
    };
    timings.set(route, next);
    return next;
}
export function metricsPayload() {
    return {
        counters: { dsh_better_display_route_hits_total: snapshotHits() },
        timingsMs: snapshotTimings(),
    };
}
//# sourceMappingURL=metrics.js.map