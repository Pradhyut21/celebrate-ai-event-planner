import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server/app.js';
import { PlanResponseSchema, type EventInput } from '../src/shared/schema.js';

const event: EventInput = {
  name: 'Neighbourhood day', type: 'community', date: '2027-06-20', currency: 'INR',
  budget: 120_000, guests: 120, location: 'Hyderabad', vibe: 'Colourful and welcoming',
  priorities: ['Accessibility'], accessibility: 'Step-free route', dietary: 'Vegetarian', notes: '',
};
const token = 'test-access-token-at-least-16';
const appOptions = {today: () => '2027-01-01'};

describe('planner HTTP boundary', () => {
  it('reports honest provider capabilities without returning configuration secrets', async () => {
    const app = createApp({...appOptions, apiKey: 'server-secret', accessToken: token});
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({status: 'ok', aiEnabled: true, tokenRequired: true});
    expect(response.text).not.toContain('server-secret');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns a complete schema-validated no-key plan with security headers', async () => {
    const response = await request(createApp(appOptions)).post('/api/plan').send(event).expect(200);
    expect(PlanResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.plan.generatedBy).toBe('rules');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('rejects unknown fields, invalid amounts, past dates and malformed JSON', async () => {
    const app = createApp(appOptions);
    await request(app).post('/api/plan').send({...event, privileged: true}).expect(400);
    const invalid = await request(app).post('/api/plan').send({...event, budget: -100}).expect(400);
    expect(invalid.body.issues).toContainEqual(expect.objectContaining({path: 'budget'}));
    await request(app).post('/api/plan').send({...event, date: '2026-12-31'}).expect(400);
    const badJson = await request(app).post('/api/plan').set('Content-Type', 'application/json').send('{bad-json').expect(400);
    expect(badJson.text).not.toContain('SyntaxError');
    expect(badJson.text).not.toContain('node_modules');
  });

  it('requires JSON and rejects bodies larger than 16 KB and compressed bodies', async () => {
    const app = createApp(appOptions);
    await request(app).post('/api/plan').type('form').send({name: 'test'}).expect(415);
    await request(app).post('/api/plan').send({...event, notes: 'n'.repeat(17_000)}).expect(413);
    await request(app).post('/api/plan').set('Content-Type', 'application/json').set('Content-Encoding', 'gzip').send('{}').expect(415);
  });

  it('rejects untrusted and null origins while accepting configured exact origins', async () => {
    const app = createApp({...appOptions, allowedOrigins: ['https://planner.example']});
    await request(app).post('/api/plan').set('Origin', 'https://attacker.example').send(event).expect(403);
    await request(app).post('/api/plan').set('Origin', 'null').send(event).expect(403);
    await request(app).post('/api/plan').set('Origin', 'https://planner.example.evil').send(event).expect(403);
    const valid = await request(app).post('/api/plan').set('Origin', 'https://planner.example').send(event).expect(200);
    expect(valid.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('checks the Bearer token before any provider request and prevents unsafe production startup', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = createApp({...appOptions, apiKey: 'do-not-leak', accessToken: token, fetchImpl});
    await request(app).post('/api/plan').send(event).expect(401);
    await request(app).post('/api/plan').set('Authorization', `Bearer ${token}x`).send(event).expect(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => createApp({production: true, apiKey: 'paid-key'})).toThrow('Production AI requires');
    expect(() => createApp({accessToken: 'short'})).toThrow('at least 16');
  });

  it('uses deterministic fallback when the authenticated provider is unavailable, without leaking upstream errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('Secret provider payload with paid-key'));
    const response = await request(createApp({...appOptions, apiKey: 'paid-key', accessToken: token, fetchImpl}))
      .post('/api/plan').set('Authorization', `Bearer ${token}`).send(event).expect(200);
    expect(response.body.plan.generatedBy).toBe('rules');
    expect(response.body.plan.warnings.join(' ')).toContain('unavailable');
    expect(response.text).not.toContain('paid-key');
    expect(response.text).not.toContain('Secret provider');
  });

  it('bounds per-IP requests, ignores spoofed forwarding headers and expires old buckets', async () => {
    let time = 0;
    const app = createApp({...appOptions, rateLimit: 2, rateWindowMs: 1_000, now: () => time});
    await request(app).post('/api/plan').set('X-Forwarded-For', '1.1.1.1').send(event).expect(200);
    await request(app).post('/api/plan').set('X-Forwarded-For', '2.2.2.2').send(event).expect(200);
    const limited = await request(app).post('/api/plan').set('X-Forwarded-For', '3.3.3.3').send(event).expect(429);
    expect(limited.headers['retry-after']).toBe('1');
    time = 1_001;
    await request(app).post('/api/plan').send(event).expect(200);
  });

  it('bounds the rate limiter storage and the concurrent AI work', async () => {
    await request(createApp({...appOptions, maxRateEntries: 0})).post('/api/plan').send(event).expect(503);
    let release!: () => void;
    let started!: () => void;
    const waitForStart = new Promise<void>((resolve) => {started = resolve;});
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      started();
      return new Promise<Response>((resolve) => {release = () => resolve(new Response('{}', {status: 500}));});
    });
    const app = createApp({...appOptions, apiKey: 'test-key', fetchImpl, maxConcurrent: 1});
    const first = request(app).post('/api/plan').send(event).then((response) => response);
    await waitForStart;
    const second = await request(app).post('/api/plan').send(event).expect(503);
    expect(second.headers['retry-after']).toBe('5');
    release();
    expect((await first).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('hides unexpected exceptions and returns JSON for unknown API routes', async () => {
    const app = createApp({today: () => {throw new Error('private stack details');}});
    const response = await request(app).post('/api/plan').send(event).expect(500);
    expect(response.body).toEqual({error: 'The planner could not complete this request. Please try again.'});
    await request(app).get('/api/does-not-exist').expect(404, {error: 'API route not found.'});
  });
});
