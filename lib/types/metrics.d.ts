export declare const ROUTE_REVEAL = "/better-display/reveal";
export declare const ROUTE_SKILL_STATUS = "/better-display/skill-status";
export declare const ROUTE_METRICS = "/better-display/metrics";
export declare const ROUTE_HITS: readonly ["/better-display/reveal", "/better-display/skill-status", "/better-display/metrics"];
export interface RouteTiming {
    count: number;
    totalMs: number;
    maxMs: number;
}
export declare function recordRouteHit(route: string): number;
export declare function recordRouteDuration(route: string, elapsedMs: number): RouteTiming;
export declare function metricsPayload(): {
    counters: {
        dsh_better_display_route_hits_total: Record<string, number>;
    };
    timingsMs: Record<string, RouteTiming>;
};
//# sourceMappingURL=metrics.d.ts.map