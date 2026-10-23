import React, { useRef, useState } from 'react';
import { Plus, Printer, Sparkles, X, Flower2 } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { storedEventSchema } from '../shared/schema.js';
import type { EventInput, StoredEvent } from '../shared/schema.js';
import type { Section } from './types.js';
import { navigation } from './navigation.js';
import { MAX_EVENTS } from './lib/data.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { usePlanningService } from './hooks/usePlanningService.js';
import { useMobileNavigation } from './hooks/useMobileNavigation.js';
import { EventForm } from './components/EventForm.js';
import { SettingsDialog } from './components/SettingsDialog.js';
import { HelpDialog } from './components/HelpDialog.js';
import { Overview } from './views/Overview.js';
import { BudgetView } from './views/BudgetView.js';
import { TimelineView } from './views/TimelineView.js';
import { VendorsView } from './views/VendorsView.js';
import { IdeasView } from './views/IdeasView.js';
import { Sidebar } from './components/Sidebar.js';
import { Topbar } from './components/Topbar.js';
import './styles.css';

function App(): React.ReactElement {
  const {
    events,
    current,
    notice,
    corruptStorageProtected,
    storageWarning,
    dispatch,
    setNotice,
    updatePlan,
    toggleTask,
    exportEvents,
    importEvents,
  } = useWorkspace();
  const { health, healthError, token, setToken, busy, generate } = usePlanningService();
  const { mobileOpen, setMobileOpen, closeNavigation, sidebarRef, mainShellRef, contentRef } =
    useMobileNavigation();
  const [section, setSection] = useState<Section>('overview');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoredEvent | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const formReturnFocus = useRef<HTMLElement | null>(null);
  const navigate = (next: Section) => {
    setSection(next);
    closeNavigation(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openNew = () => {
    if (events.length >= MAX_EVENTS) {
      setNotice({
        text: `You can keep up to ${MAX_EVENTS} events. Export and remove an older event to make room.`,
        kind: 'error',
      });
      return;
    }
    formReturnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(undefined);
    setFormOpen(true);
    closeNavigation();
  };
  const createEvent = (input: EventInput) =>
    generate(
      input,
      ({ plan, fallbackMessage }) => {
        const event = storedEventSchema.parse({
          id: editing?.id ?? crypto.randomUUID(),
          input,
          plan,
          updatedAt: new Date().toISOString(),
        });
        dispatch({
          type: 'save',
          event,
          editing: Boolean(editing),
          notice: {
            kind: fallbackMessage ? 'info' : 'success',
            text: fallbackMessage
              ? `${fallbackMessage} Your local rules-based plan is ready.`
              : plan.generatedBy === 'openai'
                ? 'Your AI-assisted celebration plan is ready. Review the estimates before booking.'
                : 'Your rules-based celebration plan is ready. No AI provider was used.',
          },
        });
        setSection('overview');
        setFormOpen(false);
        setEditing(undefined);
      },
      setNotice,
    );
  const deleteCurrent = () => {
    if (
      !current ||
      !window.confirm(
        `Delete “${current.input.name}”? Export a JSON backup first if you want to keep it. This cannot be undone.`,
      )
    )
      return;
    dispatch({ type: 'delete', id: current.id });
    setSettingsOpen(false);
  };
  const closeForm = () => {
    if (busy) return;
    setFormOpen(false);
    setEditing(undefined);
    formReturnFocus.current?.focus();
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell">
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            className="nav-backdrop"
            onClick={() => closeNavigation()}
          />
        )}
        <Sidebar
          sidebarRef={sidebarRef}
          mobileOpen={mobileOpen}
          current={current}
          events={events}
          section={section}
          onSelectEvent={(id) => {
            dispatch({ type: 'select', id });
            setSection('overview');
            closeNavigation();
          }}
          navigate={navigate}
          openNew={openNew}
          onHelp={() => {
            setHelpOpen(true);
            closeNavigation();
          }}
          onSettings={() => {
            setSettingsOpen(true);
            closeNavigation();
          }}
        />
        <div ref={mainShellRef} className="main-shell">
          <Topbar
            mobileOpen={mobileOpen}
            section={section}
            onToggleNavigation={() => setMobileOpen((open) => !open)}
            onHelp={() => setHelpOpen(true)}
          />
          <main id="main-content" ref={contentRef} tabIndex={-1}>
            {current && section !== 'overview' && (
              <h1 className="sr-only">
                {navigation.find((item) => item.id === section)?.label ?? 'Event planning'}
              </h1>
            )}
            {storageWarning && (
              <div role="alert" className="notice error">
                <span>{storageWarning}</span>
              </div>
            )}
            {notice && !settingsOpen && (
              <div
                role={notice.kind === 'error' ? 'alert' : 'status'}
                className={`notice ${notice.kind}`}
              >
                <span>{notice.text}</span>
                <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
                  <X size={17} />
                </button>
              </div>
            )}
            {current ? (
              <>
                {section === 'overview' && (
                  <Overview
                    event={current}
                    setSection={navigate}
                    toggleTask={toggleTask}
                    onEdit={() => {
                      setEditing(current);
                      setFormOpen(true);
                    }}
                  />
                )}
                {section === 'budget' && (
                  <BudgetView key={current.id} event={current} updatePlan={updatePlan} />
                )}
                {section === 'timeline' && (
                  <TimelineView key={current.id} event={current} toggleTask={toggleTask} />
                )}
                {section === 'vendors' && (
                  <VendorsView key={current.id} event={current} updatePlan={updatePlan} />
                )}
                {section === 'ideas' && <IdeasView event={current} />}
                {current.plan.warnings.length > 0 && (
                  <details className="plan-warnings">
                    <summary>
                      {current.plan.warnings.length} planning note
                      {current.plan.warnings.length === 1 ? '' : 's'} to keep in mind
                    </summary>
                    <ul>
                      {current.plan.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <footer className="page-footer">
                  <span>
                    <Sparkles size={13} />
                    {current.id === 'sample-celebration' ? 'Sample event · ' : ''}
                    {current.plan.generatedBy === 'openai'
                      ? 'AI-assisted plan · review before booking'
                      : 'Rules-based plan · no AI provider used'}
                  </span>
                  <button className="text-button" onClick={() => window.print()}>
                    <Printer size={14} />
                    Print this view
                  </button>
                </footer>
              </>
            ) : (
              <section className="empty-workspace">
                <div className="empty-art">
                  <Flower2 size={66} strokeWidth={1} />
                </div>
                <p className="eyebrow">SOMETHING WONDERFUL STARTS HERE</p>
                <h1>Your next happy memory.</h1>
                <p>
                  A wedding, a birthday, a neighborhood get-together.
                  <br />
                  Let’s give your celebration a thoughtful beginning.
                </p>
                <button className="button primary" onClick={openNew}>
                  <Plus size={17} />
                  Create your first event
                </button>
              </section>
            )}
          </main>
        </div>
      </div>
      {formOpen && (
        <EventForm
          event={editing}
          busy={busy}
          onSubmit={(input) => {
            void createEvent(input);
          }}
          onClose={closeForm}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          current={current}
          notice={notice}
          health={health}
          healthError={healthError}
          token={token}
          setToken={setToken}
          eventCount={events.length}
          corruptStorageProtected={corruptStorageProtected}
          onClose={() => setSettingsOpen(false)}
          exportEvents={exportEvents}
          importEvents={async (file) => {
            await importEvents(file);
            setSection('overview');
          }}
          deleteCurrent={deleteCurrent}
          setNotice={setNotice}
        />
      )}
      {helpOpen && (
        <HelpDialog
          onClose={() => setHelpOpen(false)}
          onCreate={() => {
            setHelpOpen(false);
            openNew();
          }}
        />
      )}
    </>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('The application root element is missing.');
createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
