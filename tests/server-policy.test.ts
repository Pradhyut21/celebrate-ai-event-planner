import { describe, expect, it } from 'vitest';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import request from 'supertest';
import { apiErrorHandler } from '../src/server/middleware.js';
import { resolveAppConfig } from '../src/server/config.js';
import { createConcurrencyGate, createRateBudget } from '../src/server/resources.js';

describe('fail-closed server configuration', () => {
  it.each([
    '*',
    'null',
    'https://example.com/path',
    'https://example.com/',
    'https://user:password@example.com',
    'file:///tmp',
  ])('rejects ambiguous origin %s', (origin) => {
    expect(() => resolveAppConfig({ allowedOrigins: [origin] })).toThrow('exact HTTP or HTTPS');
  });
  it('requires encrypted production origins while preserving loopback development', () => {
    expect(() =>
      resolveAppConfig({ production: true, allowedOrigins: ['http://example.com'] }),
    ).toThrow('require HTTPS');
    expect(
      resolveAppConfig({
        production: true,
        allowedOrigins: [
          'https://example.com',
          'http://localhost:3001',
          'http://127.0.0.1:4173',
          'http://[::1]:3001',
        ],
      }).origins.size,
    ).toBe(4);
    expect(resolveAppConfig({ allowedOrigins: [] }).origins.size).toBe(0);
  });
  it.each(['rateLimit', 'maxRateEntries', 'maxConcurrent', 'staticRateLimit'] as const)(
    'rejects invalid resource setting %s rather than disabling protection',
    (key) => {
      for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, 0.5])
        expect(() => resolveAppConfig({ [key]: value })).toThrow('safe integer');
      expect(resolveAppConfig({ [key]: 0 })[key]).toBe(0);
    },
  );
  it('requires a positive integral window duration', () => {
    for (const rateWindowMs of [0, -1, Number.NaN, 0.5])
      expect(() => resolveAppConfig({ rateWindowMs })).toThrow('positive safe integer');
    expect(resolveAppConfig({ rateWindowMs: 1 }).rateWindowMs).toBe(1);
  });
});

describe('bounded process resources', () => {
  it('delegates a streaming failure after headers are sent instead of writing a second response', async () => {
    const app = express();
    const failure = new Error('Internal stream failure');
    app.get('/partial', (_request, response, next) => {
      response.write('partial ');
      next(failure);
    });
    app.use(apiErrorHandler);
    const finish: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
      expect(error).toBe(failure);
      response.end('finished');
    };
    app.use(finish);
    const result = await request(app).get('/partial').expect(200);
    expect(result.text).toBe('partial finished');
    expect(result.text).not.toContain(failure.message);
  });
  it('recovers address capacity on expiration without letting new clients bypass limits', () => {
    let now = 0;
    const consume = createRateBudget({ limit: 1, maxEntries: 1, windowMs: 1500, now: () => now });
    expect(consume('one')).toEqual({ status: 'allowed' });
    expect(consume('two')).toEqual({ status: 'busy' });
    expect(consume('one')).toEqual({ status: 'limited', retryAfter: 2 });
    now = 1000;
    expect(consume('one')).toEqual({ status: 'limited', retryAfter: 1 });
    now = 1500;
    expect(consume('two')).toEqual({ status: 'allowed' });
  });
  it('releases concurrency exactly once, including repeated cleanup calls', () => {
    const gate = createConcurrencyGate(1);
    const release = gate.tryAcquire();
    expect(release).toBeTypeOf('function');
    expect(gate.tryAcquire()).toBeUndefined();
    release?.();
    release?.();
    const second = gate.tryAcquire();
    expect(second).toBeTypeOf('function');
    expect(gate.tryAcquire()).toBeUndefined();
    second?.();
    expect(createConcurrencyGate(0).tryAcquire()).toBeUndefined();
  });
});
