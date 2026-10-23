import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { EventInputSchema } from '../shared/schema.js';
import { generatePlan } from '../shared/planner.js';
import { enrichPlan } from './provider.js';
import { resolveAppConfig, SERVER_LIMITS } from './config.js';
import type { AppOptions } from './config.js';
import {
  apiErrorHandler,
  plannerAccess,
  PLANNER_BUSY_MESSAGE,
  securityHeaders,
} from './middleware.js';
import { createConcurrencyGate } from './resources.js';

export type { AppOptions } from './config.js';

/** Compose HTTP handlers while keeping policy, resource budgets and planning independently testable. */
export function createApp(options: AppOptions = {}): Express {
  const config = resolveAppConfig(options);
  const gate = createConcurrencyGate(config.maxConcurrent);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(securityHeaders(config.production));
  app.use('/api', (_, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (_, response) => {
    response.json({
      status: 'ok',
      aiEnabled: Boolean(options.apiKey),
      tokenRequired: Boolean(config.accessToken),
    });
  });
  app.post(
    '/api/plan',
    plannerAccess(config),
    express.json({ limit: SERVER_LIMITS.jsonBody, strict: true, inflate: false }),
    async (request, response) => {
      const result = EventInputSchema.safeParse(request.body);
      if (!result.success) {
        response.status(400).json({
          error: 'Review your event details.',
          issues: result.error.issues
            .slice(0, SERVER_LIMITS.validationIssues)
            .map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
        return;
      }
      const today = config.today();
      if (result.data.date < today) {
        response.status(400).json({ error: 'Choose today or a future event date.' });
        return;
      }
      const release = gate.tryAcquire();
      if (!release) {
        response.set('Retry-After', String(SERVER_LIMITS.concurrencyRetrySeconds));
        response.status(503).json({ error: PLANNER_BUSY_MESSAGE });
        return;
      }
      try {
        const plan = await enrichPlan(result.data, generatePlan(result.data, today), options);
        response.json({ plan });
      } finally {
        release();
      }
    },
  );
  app.use('/api', (_, response) => {
    response.status(404).json({ error: 'API route not found.' });
  });
  if (config.staticDir) {
    const directory = path.resolve(config.staticDir);
    // Page traffic cannot exhaust the cost-bearing planning API quota.
    app.use(
      rateLimit({
        windowMs: SERVER_LIMITS.windowMs,
        limit: config.staticRateLimit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many page requests. Please try again shortly.' },
      }),
    );
    app.use(express.static(directory, { dotfiles: 'deny', index: 'index.html' }));
    app.get('/{*path}', (_, response) => {
      response.sendFile(path.join(directory, 'index.html'));
    });
  }
  app.use((_, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
  app.use(apiErrorHandler);
  return app;
}
