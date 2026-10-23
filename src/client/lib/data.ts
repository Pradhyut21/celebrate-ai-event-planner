import { storedEventSchema } from '../../shared/schema.js';
import type { StoredEvent } from '../../shared/schema.js';

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
