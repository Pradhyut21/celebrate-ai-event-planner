import { createHash, timingSafeEqual } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { AppConfig } from './config.js';
import { createRateBudget } from './resources.js';

export const PLANNER_BUSY_MESSAGE = 'Planner is busy. Try again shortly.';

function matchesToken(supplied: string | undefined, expected: string): boolean {
  const actualHash = createHash('sha256')
    .update(supplied ?? '')
    .digest();
  const expectedHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function securityHeaders(production: boolean): RequestHandler {
  return (_, response, next) => {
    response.set({
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (production)
      response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/** Origin, quota and authentication run before parsing any untrusted JSON. */
export function plannerAccess(config: AppConfig): RequestHandler {
  const consume = createRateBudget({
    limit: config.rateLimit,
    windowMs: config.rateWindowMs,
    maxEntries: config.maxRateEntries,
    now: config.now,
  });
  return (request, response, next) => {
    const origin = request.get('origin');
    if (origin && !config.origins.has(origin)) {
      response.status(403).json({ error: 'This origin is not allowed.' });
      return;
    }
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const decision = consume(key);
    if (decision.status === 'busy') {
      response.status(503).json({ error: PLANNER_BUSY_MESSAGE });
      return;
    }
    if (decision.status === 'limited') {
      response.set('Retry-After', String(decision.retryAfter));
      response.status(429).json({ error: 'Too many planning requests. Please try again shortly.' });
      return;
    }
    if (config.accessToken && !matchesToken(request.get('authorization'), config.accessToken)) {
      response.set('WWW-Authenticate', 'Bearer');
      response.status(401).json({ error: 'A valid planner access token is required.' });
      return;
    }
    if (!request.is('application/json')) {
      response.status(415).json({ error: 'Send application/json.' });
      return;
    }
    next();
  };
}

/** Never expose parser internals, stack traces or upstream error details. */
export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
  if (status === 413) response.status(413).json({ error: 'Event details exceed the 16 KB limit.' });
  else if (status === 400) response.status(400).json({ error: 'Send valid JSON.' });
  else if (status === 415)
    response
      .status(415)
      .json({ error: 'Compressed or unsupported request bodies are not accepted.' });
  else
    response
      .status(500)
      .json({ error: 'The planner could not complete this request. Please try again.' });
};
