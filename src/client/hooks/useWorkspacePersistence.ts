import { useEffect, useState } from 'react';
import { SELECTION_KEY, serializeBackup, STORAGE_KEY } from '../lib/data.js';
import type { Workspace } from '../lib/workspace.js';

export function useWorkspacePersistence({
  events,
  selectedId,
  corruptStorageProtected,
}: Workspace): string {
  const [warning, setWarning] = useState('');
  useEffect(() => {
    if (corruptStorageProtected) return;
    let disposed = false;
    let nextWarning = '';
    try {
      localStorage.setItem(STORAGE_KEY, serializeBackup(events));
      localStorage.setItem(SELECTION_KEY, selectedId);
    } catch {
      nextWarning =
        'Your browser could not save changes. Keep this tab open and export a JSON backup from Settings.';
    }
    queueMicrotask(() => {
      if (!disposed) setWarning(nextWarning);
    });
    return () => {
      disposed = true;
    };
  }, [events, selectedId, corruptStorageProtected]);
  return warning;
}
