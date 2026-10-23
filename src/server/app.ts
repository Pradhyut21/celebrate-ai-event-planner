import express, {type ErrorRequestHandler, type Express} from 'express';
import { rateLimit } from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { EventInputSchema } from '../shared/schema.js';
import { generatePlan, utcToday } from '../shared/planner.js';
import { enrichPlan, type ProviderOptions } from './provider.js';

export interface AppOptions extends ProviderOptions {
  accessToken?: string;
  production?: boolean;
  allowedOrigins?: string[];
  rateLimit?: number;
  rateWindowMs?: number;
  maxRateEntries?: number;
  maxConcurrent?: number;
  now?: () => number;
  today?: () => string;
  staticDir?: string;
  staticRateLimit?: number;
}

const localOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];

function matchesToken(supplied: string | undefined, expected: string): boolean {
  const actualHash = createHash('sha256').update(supplied ?? '').digest();
  const expectedHash = createHash('sha256').update(`Bearer ${expected}`).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

/** No account or guest data is retained by this process. Rate limits are process-local. */
export function createApp(options: AppOptions = {}): Express {
  if (options.accessToken && options.accessToken.length < 16) throw new Error('PLANNER_ACCESS_TOKEN must have at least 16 characters.');
  if (options.production && options.apiKey && !options.accessToken) throw new Error('Production AI requires PLANNER_ACCESS_TOKEN.');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  const origins = new Set(options.allowedOrigins ?? localOrigins);
  const now = options.now ?? Date.now;
  const windowMs = options.rateWindowMs ?? 60_000;
  const maxEntries = options.maxRateEntries ?? 1_000;
  const limit = options.rateLimit ?? 20;
  const buckets = new Map<string, {count: number; expires: number}>();
  let concurrent = 0;

  app.use((_, response, next) => {
    response.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    if (options.production) response.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use('/api', (_, response, next) => {response.set('Cache-Control', 'no-store'); next();});
  app.get('/api/health', (_, response) => {
    response.json({status: 'ok', aiEnabled: Boolean(options.apiKey), tokenRequired: Boolean(options.accessToken)});
  });
  app.post('/api/plan', (request, response, next) => {
    const origin = request.get('origin');
    if (origin && !origins.has(origin)) {response.status(403).json({error: 'This origin is not allowed.'}); return;}
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const time = now();
    for (const [ip, bucket] of buckets) if (bucket.expires <= time) buckets.delete(ip);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxEntries) {response.status(503).json({error: 'Planner is busy. Try again shortly.'}); return;}
      bucket = {count: 0, expires: time + windowMs};
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      response.set('Retry-After', String(Math.max(1, Math.ceil((bucket.expires - time) / 1_000))));
      response.status(429).json({error: 'Too many planning requests. Please try again shortly.'}); return;
    }
    if (options.accessToken && !matchesToken(request.get('authorization'), options.accessToken)) {
      response.set('WWW-Authenticate', 'Bearer');
      response.status(401).json({error: 'A valid planner access token is required.'}); return;
    }
    if (!request.is('application/json')) {response.status(415).json({error: 'Send application/json.'}); return;}
    next();
  }, express.json({limit: '16kb', strict: true, inflate: false}), async (request, response) => {
    const result = EventInputSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({error: 'Review your event details.', issues: result.error.issues.slice(0, 20)
        .map((issue) => ({path: issue.path.join('.'), message: issue.message}))}); return;
    }
    const today = (options.today ?? utcToday)();
    if (result.data.date < today) {response.status(400).json({error: 'Choose today or a future event date.'}); return;}
    if (concurrent >= (options.maxConcurrent ?? 4)) {
      response.set('Retry-After', '5'); response.status(503).json({error: 'Planner is busy. Try again shortly.'}); return;
    }
    concurrent += 1;
    try {
      const plan = await enrichPlan(result.data, generatePlan(result.data, today), options);
      response.json({plan});
    } finally {concurrent -= 1;}
  });
  app.use('/api', (_, response) => {response.status(404).json({error: 'API route not found.'});});
  if (options.staticDir) {
    const directory = path.resolve(options.staticDir);
    // Pages and assets use a separate budget, so browsing cannot exhaust API quota.
    app.use(rateLimit({
      windowMs: 60_000, limit: options.staticRateLimit ?? 300,
      standardHeaders: true, legacyHeaders: false,
      message: {error: 'Too many page requests. Please try again shortly.'},
    }));
    app.use(express.static(directory, {dotfiles: 'deny', index: 'index.html'}));
    app.get('/{*path}', (_, response) => {response.sendFile(path.join(directory, 'index.html'));});
  }
  app.use((_, response) => {response.status(404).json({error: 'Route not found.'});});
  const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (response.headersSent) {_next(error); return;}
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
    if (status === 413) response.status(413).json({error: 'Event details exceed the 16 KB limit.'});
    else if (status === 400) response.status(400).json({error: 'Send valid JSON.'});
    else if (status === 415) response.status(415).json({error: 'Compressed or unsupported request bodies are not accepted.'});
    else response.status(500).json({error: 'The planner could not complete this request. Please try again.'});
  };
  app.use(errorHandler);
  return app;
}
