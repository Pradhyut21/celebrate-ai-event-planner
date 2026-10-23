import { useReducer } from 'react';
import type { Plan } from '../../shared/schema.js';
import { MAX_BACKUP_BYTES, parseBackup, SELECTION_KEY, serializeBackup } from '../lib/data.js';
import { download } from '../lib/download.js';
import { loadInitial } from '../lib/storage.js';
import { createWorkspace, workspaceReducer } from '../lib/workspace.js';
import type { Notice } from '../types.js';
import { useWorkspacePersistence } from './useWorkspacePersistence.js';

function loadWorkspace() {
  const initial = loadInitial();
  let selectedId = '';
  try {
    selectedId = localStorage.getItem(SELECTION_KEY) ?? '';
  } catch {
    /* Saving reports unavailable storage separately. */
  }
  return createWorkspace(initial.events, initial.warning, selectedId);
}

/** Browser I/O stays here; the reducer is deterministic and independently testable. */
export function useWorkspace() {
  const [workspace, dispatch] = useReducer(workspaceReducer, undefined, loadWorkspace);
  const storageWarning = useWorkspacePersistence(workspace);
  const current = workspace.events.find((event) => event.id === workspace.selectedId);
  const setNotice = (notice: Notice | null) => dispatch({ type: 'notice', notice });
  const updatePlan = (update: (plan: Plan) => Plan) => {
    if (current)
      dispatch({
        type: 'update-plan',
        id: current.id,
        update,
        updatedAt: new Date().toISOString(),
      });
  };
  const toggleTask = (id: string) =>
    updatePlan((plan) => ({
      ...plan,
      tasks: plan.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    }));
  const exportEvents = () => {
    download(serializeBackup(workspace.events), 'celebrate-events.json', 'application/json');
    setNotice({
      text: 'Your event backup is ready. Keep it somewhere safe; it contains your planning details.',
      kind: 'success',
    });
  };
  const importEvents = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Choose a JSON backup smaller than 2 MB.');
      const events = parseBackup(await file.text());
      dispatch({ type: 'import', events });
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? 'The file is not valid JSON.'
          : error instanceof Error && error.name !== 'ZodError'
            ? error.message
            : 'The backup contains missing or invalid event details.';
      setNotice({ text: `Could not import events. ${message}`, kind: 'error' });
    }
  };
  return {
    ...workspace,
    current,
    dispatch,
    storageWarning,
    setNotice,
    updatePlan,
    toggleTask,
    exportEvents,
    importEvents,
  };
}
