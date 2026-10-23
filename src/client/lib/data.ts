import { storedEventSchema } from '../../shared/schema.js';
import type { Plan, StoredEvent } from '../../shared/schema.js';

export const STORAGE_KEY = 'celebrate-ai.events.v1';
export const SELECTION_KEY = 'celebrate-ai.selected.v1';
export const MAX_EVENTS = 20;
export const MAX_BACKUP_BYTES = 2_000_000;

/** Validate the whole envelope before replacing any in-memory or persisted data. */
export function parseBackup(raw: string, allowEmpty = false): StoredEvent[] {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error('Choose a JSON backup smaller than 2 MB.');
  const decoded: unknown = JSON.parse(raw);
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    !('version' in decoded) ||
    decoded.version !== 1 ||
    !('events' in decoded) ||
    !Array.isArray(decoded.events) ||
    decoded.events.length > MAX_EVENTS ||
    (!allowEmpty && decoded.events.length < 1)
  )
    throw new Error('Choose a version 1 Celebrate AI backup with 1–20 events.');
  const events = decoded.events.map((value: unknown) => storedEventSchema.parse(value));
  if (new Set(events.map((event) => event.id)).size !== events.length)
    throw new Error('The backup contains duplicate event identifiers.');
  return events;
}

export function serializeBackup(events: StoredEvent[]): string {
  return JSON.stringify({ version: 1, events }, null, 2);
}

/** Quote CSV fields and neutralize spreadsheet formulas, including whitespace-prefixed ones. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Sum in minor units so a displayed financial total has no floating-point drift. */
export function sumMoney(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

/** Rebalance other categories atomically, preserving the exact total allocation. */
export function reallocateBudget(
  budget: Plan['budget'],
  id: string,
  amount: number,
): Plan['budget'] {
  const target = budget.findIndex((item) => item.id === id);
  if (target < 0) throw new Error('Budget category not found.');
  const cents = Math.round(amount * 100);
  const total = budget.reduce((sum, item) => sum + Math.round(item.allocated * 100), 0);
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    cents > total ||
    Math.abs(amount * 100 - cents) > 0.00001
  )
    throw new Error('Use up to two decimal places and an allocation within the total budget.');
  const next = budget.map((item) => ({ ...item }));
  let delta = cents - Math.round(next[target].allocated * 100);
  next[target].allocated = cents / 100;
  const others = next
    .map((_, index) => index)
    .reverse()
    .filter((index) => index !== target);
  if (!others.length && delta !== 0)
    throw new Error('A single category must equal the total budget.');
  for (const index of others) {
    if (delta === 0) break;
    const available = Math.round(next[index].allocated * 100);
    const adjustment = delta > 0 ? Math.min(available, delta) : delta;
    next[index].allocated = (available - adjustment) / 100;
    delta -= adjustment;
  }
  if (delta !== 0) throw new Error('There is not enough budget in other categories.');
  return next;
}
