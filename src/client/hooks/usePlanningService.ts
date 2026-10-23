import { useEffect, useRef, useState } from 'react';
import type { EventInput } from '../../shared/schema.js';
import type { Health, Notice } from '../types.js';
import { createPlan, requestHealth } from '../services/planning.js';
import type { PlanResult } from '../services/planning.js';

/** Own request cancellation and the synchronous duplicate-submit guard for one mounted workspace. */
export function usePlanningService() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void requestHealth({ signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setHealth(result);
          setHealthError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealthError(true);
      });
    return () => {
      controller.abort();
      generation.current?.abort();
    };
  }, []);
  const generate = async (
    input: EventInput,
    onCreated: (result: PlanResult) => void,
    onError: (notice: Notice) => void,
  ) => {
    if (generation.current) return;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    try {
      const result = await createPlan(input, { token, signal: controller.signal });
      if (!controller.signal.aborted) onCreated(result);
    } catch {
      if (!controller.signal.aborted)
        onError({
          text: 'We could not create this plan. Check that the event date is today or later and try again.',
          kind: 'error',
        });
    } finally {
      if (generation.current === controller) generation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return { health, healthError, token, setToken, busy, generate };
}
