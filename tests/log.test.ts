import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'vitest';
import { createLogger, redact, REDACTED, requestIdOf } from '../src/log.js';
import { apply } from '../src/dsh-better-display.js';
import { ROUTE_REVEAL } from '../src/metrics.js';

const SECRET = 's3cr3t-token-value';

test('logger redacts authorization headers, tokens, and secret-looking query values', () => {
  const lines: string[] = [];
  const logger = createLogger({ write: line => lines.push(line), clock: () => new Date('2026-10-20T00:00:00.000Z') });
  logger.info('http request', {
    headers: {
      authorization: `Bearer ${SECRET}`,
      'x-api-key': SECRET,
      'x-request-id': 'req-1',
      accept: 'application/json',
    },
    url: `/better-display/skill-status?cwd=/work&token=${SECRET}&api_key=${SECRET}&password=${SECRET}`,
    token: SECRET,
    access_token: SECRET,
  });
  const record = JSON.parse(lines[0] ?? '{}') as {
    level: string;
    msg: string;
    time: string;
    headers: { authorization: string; 'x-api-key': string; 'x-request-id': string; accept: string };
    url: string;
    token: string;
    access_token: string;
  };
  const text = lines.join('\n');
  assert.equal(record.level, 'info');
  assert.equal(record.msg, 'http request');
  assert.equal(record.time, '2026-10-20T00:00:00.000Z');
  assert.equal(record.headers.authorization, REDACTED);
  assert.equal(record.headers['x-api-key'], REDACTED);
  assert.equal(record.token, REDACTED);
  assert.equal(record.access_token, REDACTED);
  assert.equal(record.headers['x-request-id'], 'req-1');
  assert.equal(record.headers.accept, 'application/json');
  assert.match(record.url, /cwd=\/work/);
  assert.match(record.url, /token=\[REDACTED\]/);
  assert.match(record.url, /api_key=\[REDACTED\]/);
  assert.match(record.url, /password=\[REDACTED\]/);
  assert.equal(text.includes(SECRET), false);
  assert.deepEqual(redact({ authorization: `Bearer ${SECRET}`, accept: 'application/json' }), {
    authorization: REDACTED,
    accept: 'application/json',
  });
});

test('request ids keep a safe X-Request-ID and replace anything else', () => {
  const kept = requestIdOf({ headers: { 'x-request-id': 'req.trace_1:part-a' } } as IncomingMessage);
  assert.equal(kept, 'req.trace_1:part-a');
  const firstOfMany = requestIdOf({ headers: { 'x-request-id': ['batch-7', 'batch-8'] } } as IncomingMessage);
  assert.equal(firstOfMany, 'batch-7');
  const generated = requestIdOf({ headers: { 'x-request-id': 'bad id\ninjected' } } as IncomingMessage);
  assert.notEqual(generated, 'bad id\ninjected');
  assert.match(generated, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.match(requestIdOf({ headers: {} } as IncomingMessage), /^[0-9a-f-]{36}$/);
});

test('reveal handler logs the request id and does not log the secret query', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => { lines.push(String(line)); };
  try {
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
    const reveal = routes.find(route => route.path === ROUTE_REVEAL);
    assert.ok(reveal);
    const req = new IncomingMessage(new Socket());
    req.method = 'GET';
    req.url = `${ROUTE_REVEAL}?cwd=/work&token=${SECRET}`;
    req.headers = { authorization: `Bearer ${SECRET}`, 'x-request-id': 'req-reveal-1' };
    const res = new ServerResponse(req);
    res.end = (() => res) as ServerResponse['end'];
    reveal.handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.getHeader('X-Request-ID'), 'req-reveal-1');
    const text = lines.join('\n');
    assert.match(text, /\[my-plugins\/dsh-better-display\] loaded/);
    assert.match(text, /req-reveal-1/);
    assert.equal(text.includes(SECRET), false);
  } finally {
    console.log = original;
  }
});
