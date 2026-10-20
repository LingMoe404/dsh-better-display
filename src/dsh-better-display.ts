import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { loadFlags, type Flags } from './flags.js';
import { createLogger, requestIdOf } from './log.js';
import { metricsPayload, recordRouteDuration, recordRouteHit, ROUTE_METRICS, ROUTE_REVEAL, ROUTE_SKILL_STATUS } from './metrics.js';
import { createRevealHandler, revealRoots } from './reveal.js';
import { scanGenerativeMcpappsStatus } from './skill-roots.js';
import { skillsFromListResult, toPublicSkillStatus } from './skill-status.js';

declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer?: {
      register: (route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
      }) => () => void;
    };
  }
}

export const name = 'dsh-better-display';
export const inject = ['webServer'];

const log = createLogger({ base: { plugin: name } });

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function skillLister(ctx: Context): (() => Promise<readonly { readonly name?: string }[] | undefined>) | undefined {
  const skills = ctx.get?.('skills') as { list?: (options?: object) => Promise<unknown> } | undefined;
  if (typeof skills?.list !== 'function') return undefined;
  return async () => skillsFromListResult(await skills.list!({}));
}

function beginRequest(req: IncomingMessage, res: ServerResponse, route: string): string {
  const requestId = requestIdOf(req);
  res.setHeader('X-Request-ID', requestId);
  recordRouteHit(route);
  const started = performance.now();
  res.on('finish', () => {
    recordRouteDuration(route, performance.now() - started);
  });
  log.info('http request', {
    requestId,
    route,
    method: req.method ?? '',
    url: req.url ?? '',
    headers: req.headers,
  });
  return requestId;
}

export function apply(ctx: Context, options?: { readonly flags?: Flags }): void {
  const flags = options?.flags ?? loadFlags();
  log.info('[my-plugins/dsh-better-display] loaded', { readerEnabled: flags.readerEnabled });
  if (!flags.readerEnabled) {
    log.info('route registration skipped', { readerEnabled: false });
    return;
  }

  if (ctx.webServer) {
    ctx.effect(() => {
      const reveal = createRevealHandler({ roots: sessionId => revealRoots(ctx, sessionId) });
      const disposeReveal = ctx.webServer!.register({
        kind: 'exact',
        path: ROUTE_REVEAL,
        handler: (req, res) => {
          beginRequest(req, res, ROUTE_REVEAL);
          reveal(req, res);
        },
      });
      const disposeSkill = ctx.webServer!.register({
        kind: 'exact',
        path: ROUTE_SKILL_STATUS,
        handler: async (req, res) => {
          const requestId = beginRequest(req, res, ROUTE_SKILL_STATUS);
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end();
            return;
          }
          try {
            const url = new URL(req.url ?? '', 'http://127.0.0.1');
            const cwd = url.searchParams.get('cwd') ?? undefined;
            const status = await scanGenerativeMcpappsStatus({
              cwd,
              listSkills: skillLister(ctx),
            });
            writeJson(res, 200, toPublicSkillStatus(status));
          } catch (err) {
            log.error('skill-status failed', {
              requestId,
              error: err instanceof Error ? err.message : String(err),
            });
            writeJson(res, 500, { ok: false, error: String(err) });
          }
        },
      });
      const disposeMetrics = ctx.webServer!.register({
        kind: 'exact',
        path: ROUTE_METRICS,
        handler: (req, res) => {
          beginRequest(req, res, ROUTE_METRICS);
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end();
            return;
          }
          writeJson(res, 200, metricsPayload());
        },
      });
      return () => {
        disposeReveal();
        disposeSkill();
        disposeMetrics();
      };
    }, 'dsh-better-display: reveal, skill-status, and metrics routes');
  }
}
