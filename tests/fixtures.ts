import type { EventInput, StoredEvent } from '../src/shared/schema.js';
import { generatePlan } from '../src/shared/planner.js';

export const brief: EventInput = {
  name: 'Community garden celebration',
  type: 'community',
  date: '2030-06-20',
  currency: 'USD',
  budget: 1234.56,
  guests: 40,
  location: 'Community garden',
  vibe: 'Relaxed and inclusive',
  priorities: ['Food'],
  accessibility: 'Step-free routes',
  dietary: 'Vegetarian',
  notes: 'Local music and reusable decor',
};

/** Each test gets fresh mutable event data and a deterministic calendar. */
export function savedEvent(id = 'event-one'): StoredEvent {
  return {
    id,
    input: structuredClone(brief),
    plan: generatePlan(brief, '2030-01-01'),
    updatedAt: '2030-01-01T12:00:00.000Z',
  };
}
