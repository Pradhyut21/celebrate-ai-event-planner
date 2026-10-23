import { describe, expect, it } from 'vitest';
import {
  createWorkspace,
  mergeImportedEvents,
  workspaceReducer,
} from '../src/client/lib/workspace.js';
import { MAX_EVENTS } from '../src/client/lib/data.js';
import { savedEvent } from './fixtures.js';

const notice = { text: 'Ready', kind: 'success' } as const;

describe('workspace selection and recovery invariants', () => {
  it('restores only an existing selection and keeps corrupted storage protected', () => {
    const events = [savedEvent('first'), savedEvent('second')];
    expect(createWorkspace(events, '', 'second').selectedId).toBe('second');
    const recovery = createWorkspace(events, 'Unreadable backup', 'missing');
    expect(recovery.selectedId).toBe('first');
    expect(recovery.corruptStorageProtected).toBe(true);
    expect(recovery.notice).toEqual({ text: 'Unreadable backup', kind: 'error' });
    expect(createWorkspace([], '').selectedId).toBe('');
  });

  it('ignores stale selections and supports dismissing a notification', () => {
    const state = createWorkspace([savedEvent('first'), savedEvent('second')], 'Warning');
    expect(workspaceReducer(state, { type: 'select', id: 'missing' })).toBe(state);
    expect(workspaceReducer(state, { type: 'select', id: 'second' }).selectedId).toBe('second');
    expect(workspaceReducer(state, { type: 'notice', notice: null }).notice).toBeNull();
  });
});

describe('atomic event edits', () => {
  it('applies queued changes against the latest plan instead of losing earlier edits', () => {
    let state = createWorkspace([savedEvent()], 'Recovered');
    state = workspaceReducer(state, {
      type: 'update-plan',
      id: 'event-one',
      updatedAt: '2030-01-02T12:00:00.000Z',
      update: (plan) => ({
        ...plan,
        budget: plan.budget.map((row, index) => (index === 0 ? { ...row, actual: 12.34 } : row)),
      }),
    });
    state = workspaceReducer(state, {
      type: 'update-plan',
      id: 'event-one',
      updatedAt: '2030-01-03T12:00:00.000Z',
      update: (plan) => ({
        ...plan,
        tasks: plan.tasks.map((task) => ({ ...task, completed: true })),
      }),
    });
    expect(state.events[0]!.plan.budget[0]!.actual).toBe(12.34);
    expect(state.events[0]!.plan.tasks.every((task) => task.completed)).toBe(true);
    expect(state.events[0]!.updatedAt).toBe('2030-01-03T12:00:00.000Z');
    expect(state.corruptStorageProtected).toBe(false);
  });

  it('rejects invalid or failed edits without changing data or overwriting recovery bytes', () => {
    const state = createWorkspace([savedEvent()], 'Recovered');
    const invalid = workspaceReducer(state, {
      type: 'update-plan',
      id: 'event-one',
      updatedAt: '2030-01-02T12:00:00.000Z',
      update: (plan) => ({ ...plan, budget: [] }),
    });
    expect(invalid.events).toBe(state.events);
    expect(invalid.corruptStorageProtected).toBe(true);
    expect(invalid.notice?.kind).toBe('error');
    const failed = workspaceReducer(state, {
      type: 'update-plan',
      id: 'event-one',
      updatedAt: '2030-01-02T12:00:00.000Z',
      update: () => {
        throw new Error('Untrusted update details');
      },
    });
    expect(failed.events).toBe(state.events);
    expect(failed.notice?.text).not.toContain('Untrusted');
    expect(
      workspaceReducer(state, {
        type: 'update-plan',
        id: 'missing',
        updatedAt: '',
        update: (plan) => plan,
      }),
    ).toBe(state);
  });

  it('creates and edits validated plans while preserving other events', () => {
    const first = savedEvent('first');
    let state = createWorkspace([first], 'Recovered');
    state = workspaceReducer(state, {
      type: 'save',
      event: savedEvent('second'),
      editing: false,
      notice,
    });
    expect(state.events).toHaveLength(2);
    expect(state.selectedId).toBe('second');
    expect(state.corruptStorageProtected).toBe(false);
    const edited = savedEvent('second');
    edited.input.name = 'Updated name';
    state = workspaceReducer(state, { type: 'save', event: edited, editing: true, notice });
    expect(state.events[0]).toBe(first);
    expect(state.events[1]!.input.name).toBe('Updated name');
  });

  it('rejects a stale edit, an invalid generated plan and a new event beyond capacity', () => {
    const state = createWorkspace([savedEvent()], 'Recovered');
    expect(
      workspaceReducer(state, { type: 'save', event: savedEvent('removed'), editing: true, notice })
        .notice?.text,
    ).toContain('removed');
    const invalid = savedEvent('new');
    invalid.plan.budget = [];
    expect(
      workspaceReducer(state, { type: 'save', event: invalid, editing: false, notice }).events,
    ).toBe(state.events);
    const full = createWorkspace(
      Array.from({ length: MAX_EVENTS }, (_, index) => savedEvent(String(index))),
      '',
    );
    const rejected = workspaceReducer(full, {
      type: 'save',
      event: savedEvent('extra'),
      editing: false,
      notice,
    });
    expect(rejected.events).toBe(full.events);
    expect(rejected.notice?.text).toContain('up to 20');
    expect(
      workspaceReducer(full, { type: 'save', event: savedEvent('0'), editing: true, notice })
        .events,
    ).toHaveLength(MAX_EVENTS);
  });
});

describe('imports and deletion', () => {
  it('merges an import against the latest workspace and updates only matching IDs', () => {
    const untouched = savedEvent('keep');
    const imported = savedEvent('replace');
    imported.input.name = 'Imported version';
    const state = createWorkspace([untouched, savedEvent('replace')], 'Recovered');
    const next = workspaceReducer(state, { type: 'import', events: [imported, savedEvent('new')] });
    expect(next.events).toHaveLength(3);
    expect(next.events[0]).toBe(untouched);
    expect(next.events[1]!.input.name).toBe('Imported version');
    expect(next.selectedId).toBe('replace');
    expect(next.corruptStorageProtected).toBe(false);
    expect(next.notice?.kind).toBe('success');
  });

  it('rejects empty, duplicate and over-capacity imports without replacing the workspace', () => {
    const state = createWorkspace([savedEvent()], 'Recovered');
    expect(() => mergeImportedEvents(state.events, [])).toThrow('at least one');
    expect(() => mergeImportedEvents(state.events, [savedEvent(), savedEvent()])).toThrow(
      'duplicate',
    );
    const failed = workspaceReducer(state, { type: 'import', events: [] });
    expect(failed.events).toBe(state.events);
    expect(failed.corruptStorageProtected).toBe(true);
    expect(failed.notice?.text).toContain('Could not import');
    expect(() =>
      mergeImportedEvents(
        state.events,
        Array.from({ length: MAX_EVENTS }, (_, index) => savedEvent(String(index))),
      ),
    ).toThrow('exceed');
  });

  it('selects a surviving event and ignores deletion of an already-removed event', () => {
    const state = createWorkspace([savedEvent('first'), savedEvent('second')], '', 'second');
    const next = workspaceReducer(state, { type: 'delete', id: 'second' });
    expect(next.selectedId).toBe('first');
    expect(next.events).toHaveLength(1);
    expect(workspaceReducer(next, { type: 'delete', id: 'missing' })).toBe(next);
    expect(workspaceReducer(next, { type: 'delete', id: 'first' }).selectedId).toBe('');
    const remaining = workspaceReducer(state, { type: 'delete', id: 'first' });
    expect(remaining.selectedId).toBe('second');
  });
});
