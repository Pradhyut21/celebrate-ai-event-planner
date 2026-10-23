import { storedEventSchema } from '../../shared/schema.js';
import type { Plan, StoredEvent } from '../../shared/schema.js';
import type { Notice } from '../types.js';
import { MAX_EVENTS } from './data.js';

export type Workspace = {
  events: StoredEvent[];
  selectedId: string;
  corruptStorageProtected: boolean;
  notice: Notice | null;
};

export type WorkspaceAction =
  | { type: 'notice'; notice: Notice | null }
  | { type: 'select'; id: string }
  | { type: 'update-plan'; id: string; update: (plan: Plan) => Plan; updatedAt: string }
  | { type: 'save'; event: StoredEvent; editing: boolean; notice: Notice }
  | { type: 'import'; events: StoredEvent[] }
  | { type: 'delete'; id: string };

export function createWorkspace(
  events: StoredEvent[],
  warning: string,
  selectedId = '',
): Workspace {
  return {
    events,
    selectedId: events.some((event) => event.id === selectedId)
      ? selectedId
      : (events[0]?.id ?? ''),
    corruptStorageProtected: Boolean(warning),
    notice: warning ? { text: warning, kind: 'error' } : null,
  };
}

export function mergeImportedEvents(events: StoredEvent[], imported: StoredEvent[]): StoredEvent[] {
  if (!imported.length) throw new Error('Choose a backup containing at least one event.');
  const importedIds = new Set(imported.map((event) => event.id));
  if (importedIds.size !== imported.length)
    throw new Error('The backup contains duplicate event identifiers.');
  const merged = [...events.filter((event) => !importedIds.has(event.id)), ...imported];
  if (merged.length > MAX_EVENTS)
    throw new Error(
      'Import would exceed the 20-event limit. Export and remove older events first.',
    );
  return merged;
}

const rejectedChange: Notice = {
  text: 'This change could not be saved. Use valid amounts with up to two decimal places and keep allocations within the total budget.',
  kind: 'error',
};

/** Apply every mutation against the latest workspace, including changes queued during file reads. */
export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'notice':
      return { ...state, notice: action.notice };
    case 'select':
      return state.events.some((event) => event.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;
    case 'update-plan': {
      const current = state.events.find((event) => event.id === action.id);
      if (!current) return state;
      try {
        const candidate = storedEventSchema.safeParse({
          ...current,
          plan: action.update(current.plan),
          updatedAt: action.updatedAt,
        });
        if (!candidate.success) return { ...state, notice: rejectedChange };
        return {
          ...state,
          corruptStorageProtected: false,
          events: state.events.map((event) => (event.id === action.id ? candidate.data : event)),
        };
      } catch {
        return { ...state, notice: rejectedChange };
      }
    }
    case 'save': {
      const exists = state.events.some((event) => event.id === action.event.id);
      if (action.editing && !exists)
        return {
          ...state,
          notice: {
            text: 'This event was removed while planning. Create a new event to save this plan.',
            kind: 'error',
          },
        };
      if (!exists && state.events.length >= MAX_EVENTS)
        return {
          ...state,
          notice: {
            text: `You can keep up to ${MAX_EVENTS} events. Export and remove an older event to make room.`,
            kind: 'error',
          },
        };
      const parsed = storedEventSchema.safeParse(action.event);
      if (!parsed.success) return { ...state, notice: rejectedChange };
      return {
        ...state,
        events: exists
          ? state.events.map((event) => (event.id === parsed.data.id ? parsed.data : event))
          : [...state.events, parsed.data],
        selectedId: parsed.data.id,
        corruptStorageProtected: false,
        notice: action.notice,
      };
    }
    case 'import':
      try {
        const events = mergeImportedEvents(state.events, action.events);
        return {
          ...state,
          events,
          selectedId: action.events[0]?.id ?? state.selectedId,
          corruptStorageProtected: false,
          notice: {
            text: `Imported ${action.events.length} events. Matching event identifiers were updated.`,
            kind: 'success',
          },
        };
      } catch (error) {
        return {
          ...state,
          notice: {
            text: `Could not import events. ${error instanceof Error ? error.message : 'The backup contains missing or invalid event details.'}`,
            kind: 'error',
          },
        };
      }
    case 'delete': {
      if (!state.events.some((event) => event.id === action.id)) return state;
      const events = state.events.filter((event) => event.id !== action.id);
      return {
        ...state,
        events,
        selectedId: events.some((event) => event.id === state.selectedId)
          ? state.selectedId
          : (events[0]?.id ?? ''),
        corruptStorageProtected: false,
        notice: { text: 'Event deleted.', kind: 'success' },
      };
    }
  }
}
