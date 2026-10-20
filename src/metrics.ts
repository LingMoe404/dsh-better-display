export const ROUTE_REVEAL = '/better-display/reveal';
export const ROUTE_SKILL_STATUS = '/better-display/skill-status';
export const ROUTE_METRICS = '/better-display/metrics';

export const ROUTE_HITS = [ROUTE_REVEAL, ROUTE_SKILL_STATUS, ROUTE_METRICS] as const;

export interface RouteTiming {
  count: number;
  totalMs: number;
  maxMs: number;
}

const hits = new Map<string, number>(ROUTE_HITS.map(route => [route, 0]));
const timings = new Map<string, RouteTiming>(ROUTE_HITS.map(route => [route, { count: 0, totalMs: 0, maxMs: 0 }]));

function snapshotHits(): Record<string, number> {
  return Object.fromEntries(hits);
}

function snapshotTimings(): Record<string, RouteTiming> {
  return Object.fromEntries([...timings].map(([route, timing]) => [route, { ...timing }]));
}

export function recordRouteHit(route: string): number {
  const next = (hits.get(route) ?? 0) + 1;
  hits.set(route, next);
  return next;
}

export function recordRouteDuration(route: string, elapsedMs: number): RouteTiming {
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

export function metricsPayload(): {
  counters: { dsh_better_display_route_hits_total: Record<string, number> };
  timingsMs: Record<string, RouteTiming>;
} {
  return {
    counters: { dsh_better_display_route_hits_total: snapshotHits() },
    timingsMs: snapshotTimings(),
  };
}
