import React, { useEffect, useRef, useState } from "react";
import { Plus, Printer, Sparkles, X, Flower2 } from "lucide-react";
import type { EventInput, Plan, StoredEvent } from "../shared/schema.js";
import { createRoot } from "react-dom/client";
import { planResponseSchema, storedEventSchema } from "../shared/schema.js";
import { generatePlan } from "../shared/planner.js";
import type { Section, Notice } from "./types.js";
import {
  MAX_EVENTS,
  MAX_BACKUP_BYTES,
  parseBackup,
  SELECTION_KEY,
  serializeBackup,
  STORAGE_KEY,
} from "./lib/data.js";
import { loadInitial } from "./lib/storage.js";
import { download } from "./lib/download.js";
import { EventForm } from "./components/EventForm.js";
import { SettingsDialog } from "./components/SettingsDialog.js";
import { HelpDialog } from "./components/HelpDialog.js";
import { Overview } from "./views/Overview.js";
import { BudgetView } from "./views/BudgetView.js";
import { TimelineView } from "./views/TimelineView.js";
import { VendorsView } from "./views/VendorsView.js";
import { IdeasView } from "./views/IdeasView.js";
import { Sidebar } from "./components/Sidebar.js";
import { Topbar } from "./components/Topbar.js";
import "./styles.css";

function App(): React.ReactElement {
  const [initial] = useState(loadInitial);
  const [events, setEvents] = useState<StoredEvent[]>(initial.events);
  const [selectedId, setSelectedId] = useState(() => {
    try {
      const saved = localStorage.getItem(SELECTION_KEY);
      return initial.events.some((event) => event.id === saved)
        ? saved!
        : (initial.events[0]?.id ?? "");
    } catch {
      return initial.events[0]?.id ?? "";
    }
  });
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoredEvent | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(
    initial.warning ? { text: initial.warning, kind: "error" } : null,
  );
  const [storageWarning, setStorageWarning] = useState("");
  const [corruptStorageProtected, setCorruptStorageProtected] = useState(
    Boolean(initial.warning),
  );
  const [token, setToken] = useState("");
  const [health, setHealth] = useState<{
    aiEnabled: boolean;
    tokenRequired: boolean;
  } | null>(null);
  const [healthError, setHealthError] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const generatingRef = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainShellRef = useRef<HTMLDivElement>(null);
  const current = events.find((event) => event.id === selectedId) ?? events[0];

  useEffect(() => {
    if (corruptStorageProtected) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeBackup(events));
      localStorage.setItem(SELECTION_KEY, selectedId);
      // Storage is an external system; defer its status notification beyond effect setup.
      queueMicrotask(() => setStorageWarning(""));
    } catch {
      queueMicrotask(() =>
        setStorageWarning(
          "Your browser could not save changes. Keep this tab open and export a JSON backup from Settings.",
        ),
      );
    }
  }, [events, selectedId, corruptStorageProtected]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (!disposed) setHealthError(true);
    }, 8000);
    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Service unavailable");
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (disposed) return;
        if (
          !data ||
          typeof data !== "object" ||
          !("aiEnabled" in data) ||
          typeof data.aiEnabled !== "boolean" ||
          !("tokenRequired" in data) ||
          typeof data.tokenRequired !== "boolean"
        )
          throw new Error("Invalid service response");
        setHealth({
          aiEnabled: data.aiEnabled,
          tokenRequired: data.tokenRequired,
        });
        setHealthError(false);
      })
      .catch(() => {
        if (!disposed && !controller.signal.aborted) setHealthError(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const shell = mainShellRef.current;
    if (!sidebar || !shell) return;
    shell.inert = true;
    const controls = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),select",
        ),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      shell.inert = false;
      document.removeEventListener("keydown", handleKey);
      document.getElementById("mobile-nav-toggle")?.focus();
    };
  }, [mobileOpen]);
  const navigate = (next: Section) => {
    setSection(next);
    setMobileOpen(false);
    contentRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const updatePlan = (update: (plan: Plan) => Plan) => {
    if (!current) return;
    const candidate = storedEventSchema.safeParse({
      ...current,
      plan: update(current.plan),
      updatedAt: new Date().toISOString(),
    });
    if (!candidate.success) {
      setNotice({
        text: "This change could not be saved. Use valid amounts with up to two decimal places and keep allocations within the total budget.",
        kind: "error",
      });
      return;
    }
    setCorruptStorageProtected(false);
    setEvents((previous) =>
      previous.map((event) =>
        event.id === current.id ? candidate.data : event,
      ),
    );
  };
  const toggleTask = (id: string) =>
    updatePlan((plan) => ({
      ...plan,
      tasks: plan.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    }));
  const openNew = () => {
    if (events.length >= MAX_EVENTS) {
      setNotice({
        text: `You can keep up to ${MAX_EVENTS} events. Export and remove an older event to make room.`,
        kind: "error",
      });
      return;
    }
    setEditing(undefined);
    setFormOpen(true);
    setMobileOpen(false);
  };
  const generate = async (input: EventInput) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    let plan: Plan;
    let fallbackMessage = "";
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401)
          throw new Error(
            "The planning service needs an access token. Add it in Settings.",
          );
        if (response.status === 429)
          throw new Error(
            "The planning service is busy. Please try again later.",
          );
        if (response.status === 400) {
          const details = (await response.json()) as { error?: string };
          throw new Error(
            typeof details.error === "string"
              ? details.error.slice(0, 200)
              : "Check your event details and try again.",
          );
        }
        throw new Error("The planning service is temporarily unavailable.");
      }
      const parsed = planResponseSchema.safeParse(await response.json());
      if (!parsed.success)
        throw new Error("The planning service returned an incomplete plan.");
      plan = parsed.data.plan;
      storedEventSchema.parse({
        id: "validation",
        input,
        plan,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      fallbackMessage =
        error instanceof Error && error.name === "ZodError"
          ? "The planning service returned a plan that did not match your event."
          : error instanceof Error && error.name !== "AbortError"
            ? error.message.slice(0, 250)
            : "The planning service took too long to respond.";
      try {
        plan = generatePlan(input);
      } catch {
        setNotice({
          text: "We could not create this plan. Check that the event date is today or later and try again.",
          kind: "error",
        });
        setBusy(false);
        generatingRef.current = false;
        window.clearTimeout(timeout);
        return;
      }
      plan = {
        ...plan,
        warnings: [
          ...plan.warnings,
          `${fallbackMessage} A local rules-based plan was created so you can keep planning.`,
        ],
      };
    } finally {
      window.clearTimeout(timeout);
    }
    const id = editing?.id ?? crypto.randomUUID();
    const created = storedEventSchema.parse({
      id,
      input,
      plan,
      updatedAt: new Date().toISOString(),
    });
    setCorruptStorageProtected(false);
    setEvents((previous) =>
      editing
        ? previous.map((event) => (event.id === id ? created : event))
        : [...previous, created],
    );
    setSelectedId(id);
    setSection("overview");
    setFormOpen(false);
    setEditing(undefined);
    setBusy(false);
    generatingRef.current = false;
    setNotice({
      kind: fallbackMessage ? "info" : "success",
      text: fallbackMessage
        ? `${fallbackMessage} Your local rules-based plan is ready.`
        : plan.generatedBy === "openai"
          ? "Your AI-assisted celebration plan is ready. Review the estimates before booking."
          : "Your rules-based celebration plan is ready. No AI provider was used.",
    });
  };
  const exportEvents = () => {
    download(
      serializeBackup(events),
      "celebrate-events.json",
      "application/json",
    );
    setNotice({
      text: "Your event backup is ready. Keep it somewhere safe; it contains your planning details.",
      kind: "success",
    });
  };
  const importEvents = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Choose a JSON backup smaller than 2 MB.");
      const imported = parseBackup(await file.text());
      const merged = [
        ...events.filter(
          (event) => !imported.some((item) => item.id === event.id),
        ),
        ...imported,
      ];
      if (merged.length > MAX_EVENTS)
        throw new Error(
          "Import would exceed the 20-event limit. Export and remove older events first.",
        );
      setCorruptStorageProtected(false);
      setEvents(merged);
      setSelectedId(imported[0].id);
      setSection("overview");
      setNotice({
        text: `Imported ${imported.length} events. Matching event identifiers were updated.`,
        kind: "success",
      });
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? "The file is not valid JSON."
          : error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "The backup contains missing or invalid event details.";
      setNotice({ text: `Could not import events. ${message}`, kind: "error" });
    }
  };
  const deleteCurrent = () => {
    if (
      !current ||
      !window.confirm(
        `Delete “${current.input.name}”? Export a JSON backup first if you want to keep it. This cannot be undone.`,
      )
    )
      return;
    const remaining = events.filter((event) => event.id !== current.id);
    setCorruptStorageProtected(false);
    setEvents(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setSettingsOpen(false);
    setNotice({ text: "Event deleted.", kind: "success" });
  };
  const closeForm = () => {
    if (!busy) {
      setFormOpen(false);
      setEditing(undefined);
    }
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
            onClick={() => setMobileOpen(false)}
          />
        )}
        <Sidebar
          sidebarRef={sidebarRef}
          mobileOpen={mobileOpen}
          current={current}
          events={events}
          section={section}
          onSelectEvent={(id) => {
            setSelectedId(id);
            setSection("overview");
            setMobileOpen(false);
          }}
          navigate={navigate}
          openNew={openNew}
          onHelp={() => {
            setHelpOpen(true);
            setMobileOpen(false);
          }}
          onSettings={() => {
            setSettingsOpen(true);
            setMobileOpen(false);
          }}
        />
        <div ref={mainShellRef} className="main-shell">
          <Topbar
            mobileOpen={mobileOpen}
            section={section}
            onToggleNavigation={() => setMobileOpen(!mobileOpen)}
            onHelp={() => setHelpOpen(true)}
          />
          <main id="main-content" ref={contentRef} tabIndex={-1}>
            {storageWarning && (
              <div role="alert" className="notice error">
                <span>{storageWarning}</span>
              </div>
            )}
            {notice && !settingsOpen && (
              <div
                role={notice.kind === "error" ? "alert" : "status"}
                className={`notice ${notice.kind}`}
              >
                <span>{notice.text}</span>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => setNotice(null)}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {current ? (
              <>
                {section === "overview" && (
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
                {section === "budget" && (
                  <BudgetView
                    key={current.id}
                    event={current}
                    updatePlan={updatePlan}
                  />
                )}
                {section === "timeline" && (
                  <TimelineView
                    key={current.id}
                    event={current}
                    toggleTask={toggleTask}
                  />
                )}
                {section === "vendors" && (
                  <VendorsView event={current} updatePlan={updatePlan} />
                )}
                {section === "ideas" && <IdeasView event={current} />}
                {current.plan.warnings.length > 0 && (
                  <details className="plan-warnings">
                    <summary>
                      {current.plan.warnings.length} planning note
                      {current.plan.warnings.length === 1 ? "" : "s"} to keep in
                      mind
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
                    {current.id === "sample-celebration"
                      ? "Sample event · "
                      : ""}
                    {current.plan.generatedBy === "openai"
                      ? "AI-assisted plan · review before booking"
                      : "Rules-based plan · no AI provider used"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => window.print()}
                  >
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
            void generate(input);
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
          importEvents={importEvents}
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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
