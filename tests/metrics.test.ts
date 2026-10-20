import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'vitest';
import { apply } from '../src/dsh-better-display.js';
import { metricsPayload, recordRouteDuration, recordRouteHit, ROUTE_METRICS, ROUTE_REVEAL, ROUTE_SKILL_STATUS } from '../src/metrics.js';

test('route hit counter increments', () => {
  const before = metricsPayload();
  const hitsBefore = before.counters.dsh_better_display_route_hits_total[ROUTE_REVEAL] ?? 0;
  const totalBefore = before.timingsMs[ROUTE_REVEAL]?.totalMs ?? 0;
  const next = recordRouteHit(ROUTE_REVEAL);
  recordRouteDuration(ROUTE_REVEAL, 12.4);
  const after = metricsPayload();
  assert.equal(next, hitsBefore + 1);
  assert.equal(after.counters.dsh_better_display_route_hits_total[ROUTE_REVEAL], hitsBefore + 1);
  assert.equal(after.timingsMs[ROUTE_REVEAL]?.totalMs, totalBefore + 12);
  assert.ok((after.timingsMs[ROUTE_REVEAL]?.maxMs ?? 0) >= 12);
});

test('GET /better-display/metrics returns the incremented route counter', () => {
  const routes: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }[] = [];
  apply({
    webServer: {
      register(route: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => void }) {
        routes.push(route);
        return () => undefined;
      },
    },
    effect(run: () => void) { run(); },
  } as never, { flags: { readerEnabled: true } });
  assert.deepEqual(routes.map(route => route.path).sort(), [ROUTE_METRICS, ROUTE_REVEAL, ROUTE_SKILL_STATUS].sort());
  const metrics = routes.find(route => route.path === ROUTE_METRICS);
  assert.ok(metrics);
  const before = metricsPayload().counters.dsh_better_display_route_hits_total[ROUTE_METRICS] ?? 0;
  const req = new IncomingMessage(new Socket());
  req.method = 'GET';
  req.url = ROUTE_METRICS;
  req.headers = { 'x-request-id': 'req-metrics-1' };
  const res = new ServerResponse(req);
  let body = '';
  res.end = ((chunk?: string) => {
    body = chunk ?? '';
    return res;
  }) as ServerResponse['end'];
  metrics.handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader('content-type'), 'application/json');
  assert.equal(res.getHeader('X-Request-ID'), 'req-metrics-1');
  const parsed = JSON.parse(body) as { counters: { dsh_better_display_route_hits_total: Record<string, number> } };
  assert.equal(parsed.counters.dsh_better_display_route_hits_total[ROUTE_METRICS], before + 1);
});
