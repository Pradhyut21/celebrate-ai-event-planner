import { generatePlan } from '../../shared/planner.js';
import { planResponseSchema, storedEventSchema } from '../../shared/schema.js';
import type { EventInput, Plan } from '../../shared/schema.js';
import type { Health } from '../types.js';

type Failure =
  | 'cancelled'
  | 'timeout'
  | 'unavailable'
  | 'invalid-response'
  | 'invalid-plan'
  | 'unauthorized'
  | 'busy'
  | 'invalid-input';

/** A safe, user-facing failure. Provider response bodies never reach the UI. */
export class PlanningServiceError extends Error {
  constructor(
    public readonly code: Failure,
    message: string,
  ) {
    super(message);
    this.name = 'PlanningServiceError';
  }
}

type RequestOptions = { signal?: AbortSignal; fetcher?: typeof fetch };
type PlanOptions = RequestOptions & { token?: string };
export type PlanResult = { plan: Plan; fallbackMessage: string };

/** Link caller cancellation to a bounded request, releasing timers/listeners on every path. */
async function withDeadline<T>(
  timeoutMs: number,
  options: RequestOptions,
  operation: (signal: AbortSignal, fetcher: typeof fetch) => Promise<T>,
): Promise<T> {
  if (options.signal?.aborted)
    throw new PlanningServiceError('cancelled', 'Planning request cancelled.');
  const controller = new AbortController();
  const interrupted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('Request aborted')), {
      once: true,
    });
  });
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, timeoutMs);
  try {
    return await Promise.race([
      operation(controller.signal, options.fetcher ?? fetch),
      interrupted,
    ]);
  } catch (error) {
    if (options.signal?.aborted)
      throw new PlanningServiceError('cancelled', 'Planning request cancelled.');
    if (controller.signal.aborted)
      throw new PlanningServiceError('timeout', 'The planning service took too long to respond.');
    if (error instanceof PlanningServiceError) throw error;
    throw new PlanningServiceError(
      'unavailable',
      'The planning service is temporarily unavailable.',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    const data: unknown = await response.json();
    return data;
  } catch {
    throw new PlanningServiceError(
      'invalid-response',
      'The planning service returned an incomplete plan.',
    );
  }
}

export function requestHealth(options: RequestOptions = {}): Promise<Health> {
  return withDeadline(8_000, options, async (signal, fetcher) => {
    const response = await fetcher('/api/health', { signal, redirect: 'error' });
    if (!response.ok) throw new PlanningServiceError('unavailable', 'Service unavailable');
    const data = await readJson(response);
    if (
      !data ||
      typeof data !== 'object' ||
      !('aiEnabled' in data) ||
      typeof data.aiEnabled !== 'boolean' ||
      !('tokenRequired' in data) ||
      typeof data.tokenRequired !== 'boolean'
    )
      throw new PlanningServiceError('invalid-response', 'Invalid service response');
    return { aiEnabled: data.aiEnabled, tokenRequired: data.tokenRequired };
  });
}

export function requestPlan(input: EventInput, options: PlanOptions = {}): Promise<Plan> {
  return withDeadline(25_000, options, async (signal, fetcher) => {
    const response = await fetcher('/api/plan', {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok) {
      if (response.status === 401)
        throw new PlanningServiceError(
          'unauthorized',
          'The planning service needs an access token. Add it in Settings.',
        );
      if (response.status === 429)
        throw new PlanningServiceError(
          'busy',
          'The planning service is busy. Please try again later.',
        );
      if (response.status === 400)
        throw new PlanningServiceError('invalid-input', 'Check your event details and try again.');
      throw new PlanningServiceError(
        'unavailable',
        'The planning service is temporarily unavailable.',
      );
    }
    const parsed = planResponseSchema.safeParse(await readJson(response));
    if (!parsed.success)
      throw new PlanningServiceError(
        'invalid-response',
        'The planning service returned an incomplete plan.',
      );
    const event = storedEventSchema.safeParse({
      id: 'validation',
      input,
      plan: parsed.data.plan,
      updatedAt: new Date().toISOString(),
    });
    if (!event.success)
      throw new PlanningServiceError(
        'invalid-plan',
        'The planning service returned a plan that did not match your event.',
      );
    return event.data.plan;
  });
}

/** Local fallback is explicit in both the persisted plan and the live notification. */
export async function createPlan(
  input: EventInput,
  options: PlanOptions = {},
): Promise<PlanResult> {
  try {
    return { plan: await requestPlan(input, options), fallbackMessage: '' };
  } catch (error) {
    if (error instanceof PlanningServiceError && error.code === 'cancelled') throw error;
    const fallbackMessage =
      error instanceof PlanningServiceError
        ? error.message
        : 'The planning service is temporarily unavailable.';
    const plan = generatePlan(input);
    return {
      plan: {
        ...plan,
        warnings: [
          ...plan.warnings,
          `${fallbackMessage} A local rules-based plan was created so you can keep planning.`,
        ],
      },
      fallbackMessage,
    };
  }
}
