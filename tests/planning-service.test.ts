import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPlan,
  PlanningServiceError,
  requestHealth,
  requestPlan,
} from '../src/client/services/planning.js';
import { brief, savedEvent } from './fixtures.js';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const successfulPlan = () => json({ plan: savedEvent().plan });
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('validated browser planning service', () => {
  it('reads capabilities without accepting malformed service flags', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ aiEnabled: true, tokenRequired: true }));
    await expect(requestHealth({ fetcher })).resolves.toEqual({
      aiEnabled: true,
      tokenRequired: true,
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/health');
  });

  it.each([
    null,
    {},
    { aiEnabled: 'true', tokenRequired: false },
    { aiEnabled: true, tokenRequired: 1 },
  ])('rejects invalid health response %j', async (data) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(data));
    await expect(requestHealth({ fetcher })).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('treats a failing health endpoint as unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
    await expect(requestHealth({ fetcher })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('sends the brief and optional session token, then validates the complete plan', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successfulPlan());
    const plan = await requestPlan(brief, { fetcher, token: 'session-access-token' });
    expect(plan).toEqual(savedEvent().plan);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/plan');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer session-access-token',
    });
    expect(JSON.parse(String(init?.body))).toEqual(brief);
  });

  it('uses native fetch without adding a credential when no access token is present', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(successfulPlan());
    vi.stubGlobal('fetch', fetcher);
    const result = await createPlan(brief);
    expect(result.fallbackMessage).toBe('');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it.each([
    [401, 'unauthorized'],
    [429, 'busy'],
    [400, 'invalid-input'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to a safe %s error', async (status, code) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ error: 'private provider error with secret' }, status));
    const error = await requestPlan(brief, { fetcher }).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(PlanningServiceError);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain('secret');
  });

  it('rejects invalid JSON and incomplete plans without persisting them', async () => {
    for (const response of [new Response('not-json'), json({ plan: { summary: 'Incomplete' } })]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(requestPlan(brief, { fetcher })).rejects.toMatchObject({
        code: 'invalid-response',
      });
    }
  });

  it('rejects a well-shaped plan whose allocations do not match the requested event', async () => {
    const plan = savedEvent().plan;
    plan.budget[0].allocated += 1;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ plan }));
    await expect(requestPlan(brief, { fetcher })).rejects.toMatchObject({ code: 'invalid-plan' });
  });

  it('builds an explicit, valid local fallback on a network failure without leaking the error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('private provider secret'));
    const result = await createPlan(brief, { fetcher });
    expect(result.plan.generatedBy).toBe('rules');
    expect(result.fallbackMessage).toContain('temporarily unavailable');
    expect(result.plan.warnings.at(-1)).toContain('local rules-based plan');
    expect(JSON.stringify(result)).not.toContain('private provider secret');
  });

  it('does not start a request or create a fallback after caller cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(createPlan(brief, { fetcher, signal: controller.signal })).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('cancels an active operation even when an injected transport ignores abort signals', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const pending = requestPlan(brief, { fetcher, signal: controller.signal });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    controller.abort();
    await rejection;
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('enforces a deadline even when a transport never settles, and releases its timer', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    const pending = requestPlan(brief, { fetcher });
    const rejection = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(25_001);
    await rejection;
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never turns an invalid event date into a saved local fallback', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
    await expect(createPlan({ ...brief, date: '2000-01-01' }, { fetcher })).rejects.toBeInstanceOf(
      RangeError,
    );
  });
});
