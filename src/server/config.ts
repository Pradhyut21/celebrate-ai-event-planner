import { utcToday } from '../shared/planner.js';
import type { ProviderOptions } from './provider.js';

export const SERVER_LIMITS = {
  jsonBody: '16kb',
  requestsPerWindow: 20,
  windowMs: 60_000,
  rateEntries: 1_000,
  concurrentPlans: 4,
  staticRequestsPerWindow: 300,
  concurrencyRetrySeconds: 5,
  validationIssues: 20,
} as const;

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function validateOrigins(origins: readonly string[], production: boolean): void {
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('Allowed origins must be exact HTTP or HTTPS origins.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('Allowed origins must be exact HTTP or HTTPS origins.');
    }
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (production && url.protocol !== 'https:' && !loopback) {
      throw new Error('Production origins require HTTPS except for local development.');
    }
  }
}

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

/** Resolve defaults once; all request handlers share the same security policy. */
export function resolveAppConfig(options: AppOptions) {
  if (options.accessToken && options.accessToken.length < 16) {
    throw new Error('PLANNER_ACCESS_TOKEN must have at least 16 characters.');
  }
  if (options.production && options.apiKey && !options.accessToken) {
    throw new Error('Production AI requires PLANNER_ACCESS_TOKEN.');
  }
  const config = {
    accessToken: options.accessToken,
    production: options.production ?? false,
    origins: new Set(options.allowedOrigins ?? LOCAL_ORIGINS),
    rateLimit: options.rateLimit ?? SERVER_LIMITS.requestsPerWindow,
    rateWindowMs: options.rateWindowMs ?? SERVER_LIMITS.windowMs,
    maxRateEntries: options.maxRateEntries ?? SERVER_LIMITS.rateEntries,
    maxConcurrent: options.maxConcurrent ?? SERVER_LIMITS.concurrentPlans,
    now: options.now ?? Date.now,
    today: options.today ?? utcToday,
    staticDir: options.staticDir,
    staticRateLimit: options.staticRateLimit ?? SERVER_LIMITS.staticRequestsPerWindow,
  };
  validateOrigins([...config.origins], config.production);
  for (const key of ['rateLimit', 'maxRateEntries', 'maxConcurrent', 'staticRateLimit'] as const) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 0) {
      throw new Error(`${key} must be a non-negative safe integer.`);
    }
  }
  if (!Number.isSafeInteger(config.rateWindowMs) || config.rateWindowMs < 1) {
    throw new Error('rateWindowMs must be a positive safe integer.');
  }
  return config;
}

export type AppConfig = ReturnType<typeof resolveAppConfig>;
