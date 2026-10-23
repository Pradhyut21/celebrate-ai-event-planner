import React, { useState } from 'react';
import { Plus, Printer, Sparkles, X, Flower2 } from 'lucide-react';
import type { Section } from './types.js';
import { navigation } from './navigation.js';
import { useWorkspace } from './hooks/useWorkspace.js';
import { usePlanningService } from './hooks/usePlanningService.js';
import { useMobileNavigation } from './hooks/useMobileNavigation.js';
import { useEventEditor } from './hooks/useEventEditor.js';
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

export function App(): React.ReactElement {
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
  const [dialog, setDialog] = useState<'settings' | 'help' | null>(null);
  const editor = useEventEditor({
    eventCount: events.length,
    busy,
    generate,
    onSave: (event, editing, notice) => {
      dispatch({ type: 'save', event, editing, notice });
      setSection('overview');
    },
    onOpen: closeNavigation,
    onNotice: setNotice,
  });
  const openNew = () => editor.open();
  const navigate = (next: Section) => {
    setSection(next);
    closeNavigation(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const deleteCurrent = () => {
    if (
      !current ||
      !window.confirm(
        `Delete “${current.input.name}”? Export a JSON backup first if you want to keep it. This cannot be undone.`,
      )
    )
      return;
    dispatch({ type: 'delete', id: current.id });
    setDialog(null);
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
            setDialog('help');
            closeNavigation();
          }}
          onSettings={() => {
            setDialog('settings');
            closeNavigation();
          }}
        />
        <div ref={mainShellRef} className="main-shell">
          <Topbar
            mobileOpen={mobileOpen}
            section={section}
            onToggleNavigation={() => setMobileOpen((open) => !open)}
            onHelp={() => setDialog('help')}
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
            {notice && dialog !== 'settings' && (
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
                    onEdit={() => editor.open(current)}
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
      {editor.isOpen && (
        <EventForm
          event={editor.editing}
          busy={busy}
          submissionError={editor.submissionError}
          onSubmit={(input) => {
            void editor.submit(input);
          }}
          onClose={editor.close}
        />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          current={current}
          notice={notice}
          storageWarning={storageWarning}
          health={health}
          healthError={healthError}
          token={token}
          setToken={setToken}
          eventCount={events.length}
          corruptStorageProtected={corruptStorageProtected}
          onClose={() => setDialog(null)}
          exportEvents={exportEvents}
          importEvents={async (file) => {
            await importEvents(file);
            setSection('overview');
          }}
          deleteCurrent={deleteCurrent}
          setNotice={setNotice}
        />
      )}
      {dialog === 'help' && (
        <HelpDialog
          onClose={() => setDialog(null)}
          onCreate={() => {
            setDialog(null);
            openNew();
          }}
        />
      )}
    </>
  );
}
