import React from 'react';
import { ArrowDownToLine, ShieldCheck, Trash2 } from 'lucide-react';
import type { StoredEvent } from '../../shared/schema.js';
import type { Notice, Health } from '../types.js';
import { Dialog } from './Dialog.js';
import { download } from '../lib/download.js';
import { STORAGE_KEY } from '../lib/data.js';

type SettingsProps = {
  current?: StoredEvent;
  notice: Notice | null;
  storageWarning: string;
  health: Health | null;
  healthError: boolean;
  token: string;
  setToken: (value: string) => void;
  eventCount: number;
  corruptStorageProtected: boolean;
  onClose: () => void;
  exportEvents: () => void;
  importEvents: (file: File | undefined) => Promise<void>;
  deleteCurrent: () => void;
  setNotice: (notice: Notice) => void;
};
export function SettingsDialog({
  current,
  notice,
  storageWarning,
  health,
  healthError,
  token,
  setToken,
  eventCount,
  corruptStorageProtected,
  onClose,
  exportEvents,
  importEvents,
  deleteCurrent,
  setNotice,
}: SettingsProps): React.ReactElement {
  return (
    <Dialog title="Settings & backups" onClose={onClose}>
      {storageWarning && (
        <p role="alert" className="notice error">
          {storageWarning}
        </p>
      )}
      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`notice ${notice.kind}`}
        >
          {notice.text}
        </div>
      )}
      <p className="dialog-intro">
        Your events stay in this browser. Export a backup to keep them safe or move to another
        device.
      </p>
      <div className="settings-section">
        <h3>
          <ShieldCheck size={18} />
          Planning service
        </h3>
        <p>
          {healthError
            ? 'Server unavailable. Local rules-based planning is available.'
            : !health
              ? 'Checking the planning service…'
              : health.aiEnabled
                ? 'AI provider is configured. Event preferences are sent to the server and configured provider when generating a plan.'
                : 'Demo mode: useful rules-based planning is available. A server-side AI key enables generative personalization.'}
        </p>
        {health?.tokenRequired && (
          <p className="callout">
            This server requires an access token to generate a plan through the API.
          </p>
        )}
        <label>
          API access token (session only)
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={256}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Optional server access token"
          />
        </label>
        <p className="field-hint">
          Held in memory for this tab only. Never enter your AI provider API key here.
        </p>
      </div>
      {corruptStorageProtected && (
        <div className="callout warning">
          <p>
            Unreadable saved data has been preserved. Download it before creating, editing,
            importing, or deleting an event, which replaces the saved workspace.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              try {
                download(
                  localStorage.getItem(STORAGE_KEY) ?? '',
                  'celebrate-recovery.json',
                  'application/json',
                );
              } catch {
                setNotice({
                  text: 'Browser storage is unavailable. The recovery file could not be read.',
                  kind: 'error',
                });
              }
            }}
          >
            Download unreadable saved data
          </button>
        </div>
      )}
      <div className="settings-section">
        <h3>
          <ArrowDownToLine size={18} />
          Your data, in your hands
        </h3>
        <button className="button secondary" onClick={exportEvents} disabled={!eventCount}>
          <ArrowDownToLine size={16} />
          Export all events (JSON)
        </button>
        <label className="import-label">
          Import events (JSON)
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Import events (JSON)"
            onChange={(event) => {
              void importEvents(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        <p className="field-hint">
          Validated JSON backup, up to 2 MB and 20 events. Matching event identifiers are updated;
          other events are kept.
        </p>
      </div>
      {current && (
        <div className="settings-section danger-section">
          <h3>Remove this event</h3>
          <p>Delete “{current.input.name}” from this browser.</p>
          <button className="button danger" onClick={deleteCurrent}>
            <Trash2 size={16} />
            Delete event
          </button>
        </div>
      )}
    </Dialog>
  );
}
