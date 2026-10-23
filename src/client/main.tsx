import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Flower2,
  Heart,
  LayoutDashboard,
  Leaf,
  ListChecks,
  LoaderCircle,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Printer,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { EventInput, Plan, StoredEvent } from "../shared/schema.js";
import {
  eventInputSchema,
  planResponseSchema,
  storedEventSchema,
} from "../shared/schema.js";
import { generatePlan } from "../shared/planner.js";
import {
  csvCell,
  MAX_EVENTS,
  MAX_BACKUP_BYTES,
  parseBackup,
  reallocateBudget,
  SELECTION_KEY,
  serializeBackup,
  STORAGE_KEY,
  sumMoney,
} from "./lib/data.js";
import "./styles.css";

type Section = "overview" | "budget" | "timeline" | "vendors" | "ideas";
type Notice = { text: string; kind: "success" | "error" | "info" };
const navigation = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "budget", label: "Budget", Icon: Wallet },
  { id: "timeline", label: "Timeline", Icon: CalendarDays },
  { id: "vendors", label: "Vendors", Icon: Store },
  { id: "ideas", label: "Ideas & inspiration", Icon: Sparkles },
] as const;

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function futureDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}
function formatDate(value: string, short = false): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  });
}
function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
function remainingDays(date: string): number {
  const today = new Date(`${localDate()}T12:00:00`).getTime();
  return Math.ceil(
    (new Date(`${date}T12:00:00`).getTime() - today) / 86_400_000,
  );
}
function makeSample(): StoredEvent {
  const input: EventInput = {
    name: "Aanya & Rohan’s wedding",
    type: "wedding",
    date: futureDate(150),
    currency: "INR",
    budget: 800000,
    guests: 120,
    location: "Bengaluru, India",
    vibe: "Intimate garden celebration",
    priorities: ["Food & drinks", "Photography"],
    dietary: "Vegetarian menu with vegan options",
    accessibility: "Step-free access and a quiet seating area",
    notes:
      "A relaxed outdoor celebration with local flowers and thoughtful personal details.",
  };
  return {
    id: "sample-celebration",
    input,
    plan: generatePlan(input),
    updatedAt: new Date().toISOString(),
  };
}
function loadInitial(): { events: StoredEvent[]; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [makeSample()], warning: "" };
    const events = parseBackup(raw, true);
    return { events, warning: "" };
  } catch {
    return {
      events: [makeSample()],
      warning:
        "Your saved events could not be loaded. A sample is shown. Import a backup in Settings to restore your work.",
    };
  }
}
function download(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}): React.ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      if (
        opener &&
        getComputedStyle(opener).visibility !== "hidden" &&
        opener.getClientRects().length
      )
        opener.focus();
      else document.getElementById("mobile-nav-toggle")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "dialog dialog-wide" : "dialog"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <p className="eyebrow">MAKE ROOM FOR JOY</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

const blankInput = (): EventInput => ({
  name: "",
  type: "wedding",
  date: futureDate(90),
  location: "",
  budget: 100000,
  currency: "INR",
  guests: 50,
  vibe: "Warm & intimate",
  priorities: [],
  dietary: "",
  accessibility: "",
  notes: "",
});

function EventForm({
  event,
  busy,
  onSubmit,
  onClose,
}: {
  event?: StoredEvent;
  busy: boolean;
  onSubmit: (input: EventInput) => void;
  onClose: () => void;
}): React.ReactElement {
  const [input, setInput] = useState<EventInput>(event?.input ?? blankInput());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = <K extends keyof EventInput>(key: K, value: EventInput[K]) => {
    setInput((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
  };
  const field = (key: keyof EventInput) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `error-${key}` : undefined,
  });
  const error = (key: keyof EventInput) =>
    errors[key] ? (
      <span className="field-error" id={`error-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = eventInputSchema.safeParse(input);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        next[String(issue.path[0])] = issue.message;
      });
      setErrors(next);
      return;
    }
    onSubmit(result.data);
  };
  return (
    <Dialog
      title={event ? "Edit your event" : "Create an event"}
      onClose={onClose}
      wide
    >
      <p className="dialog-intro">
        Tell us a little about your celebration. We’ll bring the details
        together.
      </p>
      {event && (
        <p className="callout">
          Generating again refreshes this event’s budget, tasks, and vendor
          details. Export a backup first if you want to keep your current plan.
        </p>
      )}
      <form
        onSubmit={submit}
        onInvalid={(event) => {
          const control = event.target as HTMLInputElement;
          if (control.name)
            setErrors((previous) => ({
              ...previous,
              [control.name]: control.validationMessage,
            }));
        }}
      >
        <fieldset disabled={busy} className="form-fields">
          <div className="form-grid">
            <label className="span-two">
              Event name <span aria-hidden="true">*</span>
              <input
                data-initial-focus
                name="name"
                required
                maxLength={100}
                value={input.name}
                onChange={(event) => change("name", event.target.value)}
                placeholder="e.g. Meera’s milestone birthday"
                {...field("name")}
              />
              {error("name")}
            </label>
            <label>
              Event type
              <select
                name="type"
                value={input.type}
                onChange={(event) =>
                  change("type", event.target.value as EventInput["type"])
                }
              >
                <option value="wedding">Wedding</option>
                <option value="birthday">Birthday</option>
                <option value="community">Community event</option>
              </select>
            </label>
            <label>
              Event date <span aria-hidden="true">*</span>
              <input
                type="date"
                name="date"
                required
                min={localDate()}
                value={input.date}
                onChange={(event) => change("date", event.target.value)}
                {...field("date")}
              />
              {error("date")}
            </label>
            <label className="span-two">
              Location <span aria-hidden="true">*</span>
              <input
                name="location"
                required
                maxLength={120}
                value={input.location}
                onChange={(event) => change("location", event.target.value)}
                placeholder="City or venue"
                {...field("location")}
              />
              {error("location")}
            </label>
            <label>
              Total budget <span aria-hidden="true">*</span>
              <input
                type="number"
                name="budget"
                required
                min="0.01"
                max="100000000"
                step="0.01"
                value={input.budget || ""}
                onChange={(event) =>
                  change("budget", Number(event.target.value))
                }
                {...field("budget")}
              />
              {error("budget")}
            </label>
            <label>
              Currency
              <select
                name="currency"
                value={input.currency}
                onChange={(event) =>
                  change(
                    "currency",
                    event.target.value as EventInput["currency"],
                  )
                }
              >
                <option value="INR">INR · Indian rupee</option>
                <option value="USD">USD · US dollar</option>
                <option value="EUR">EUR · Euro</option>
                <option value="GBP">GBP · British pound</option>
              </select>
            </label>
            <label>
              Guest count <span aria-hidden="true">*</span>
              <input
                type="number"
                name="guests"
                required
                min="1"
                max="10000"
                step="1"
                value={input.guests || ""}
                onChange={(event) =>
                  change("guests", Number(event.target.value))
                }
                {...field("guests")}
              />
              {error("guests")}
            </label>
            <label>
              Celebration style
              <input
                name="vibe"
                maxLength={100}
                value={input.vibe}
                onChange={(event) => change("vibe", event.target.value)}
                placeholder="e.g. Colorful, relaxed, outdoors"
                {...field("vibe")}
              />
              {error("vibe")}
            </label>
            <fieldset className="priority-fieldset span-two">
              <legend>
                What matters most? <span className="muted">Choose up to 3</span>
              </legend>
              <div className="priority-options">
                {[
                  "Food & drinks",
                  "Venue",
                  "Photography",
                  "Decor & flowers",
                  "Entertainment",
                  "Guest experience",
                ].map((priority) => (
                  <label
                    className={`choice-chip ${input.priorities.includes(priority) ? "selected" : ""}`}
                    key={priority}
                  >
                    <input
                      type="checkbox"
                      checked={input.priorities.includes(priority)}
                      disabled={
                        !input.priorities.includes(priority) &&
                        input.priorities.length >= 3
                      }
                      onChange={(event) =>
                        change(
                          "priorities",
                          event.target.checked
                            ? [...input.priorities, priority]
                            : input.priorities.filter(
                                (item) => item !== priority,
                              ),
                        )
                      }
                    />
                    {priority}
                  </label>
                ))}
              </div>
              {error("priorities")}
            </fieldset>
            <label>
              Accessibility needs
              <textarea
                name="accessibility"
                rows={2}
                maxLength={500}
                value={input.accessibility}
                onChange={(event) =>
                  change("accessibility", event.target.value)
                }
                placeholder="Step-free routes, quiet space, captions…"
                {...field("accessibility")}
              />
              {error("accessibility")}
            </label>
            <label>
              Dietary needs
              <textarea
                name="dietary"
                rows={2}
                maxLength={500}
                value={input.dietary}
                onChange={(event) => change("dietary", event.target.value)}
                placeholder="Allergies, vegetarian, halal…"
                {...field("dietary")}
              />
              {error("dietary")}
            </label>
            <label className="span-two">
              Additional notes
              <textarea
                name="notes"
                rows={3}
                maxLength={1000}
                value={input.notes}
                onChange={(event) => change("notes", event.target.value)}
                placeholder="Traditions, favorite things, or anything we should know."
                {...field("notes")}
              />
              {error("notes")}
              <span className="field-hint">
                Avoid private guest details. When AI is enabled, these planning
                preferences are sent to the configured AI provider.
              </span>
            </label>
          </div>
          <div className="dialog-footer">
            <span className="field-hint">* Required fields</span>
            <button className="button primary" type="submit">
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {busy ? "Creating your plan…" : "Generate my plan"}
            </button>
          </div>
        </fieldset>
        {busy && (
          <p role="status" className="generation-status">
            Gathering your priorities, balancing the budget, and building your
            timeline…
          </p>
        )}
      </form>
    </Dialog>
  );
}

function BotanicalIllustration(): React.ReactElement {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 300 230"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="161" cy="117" r="91" fill="#e9eddb" />
      <path
        d="M169 197c-5-50 18-91 50-131M173 163c-36-10-54-32-53-65M180 140c28-1 51-19 54-43"
        stroke="#526c4b"
        strokeWidth="2.5"
      />
      <path
        d="M193 113c-4-31 2-43 23-47 5 22-2 39-23 47ZM174 151c-35-4-44-19-40-35 20 1 35 12 40 35ZM182 138c9-28 29-40 49-37-1 20-20 36-49 37Z"
        fill="#92a783"
      />
      <path
        d="M116 198c8-49-5-87-32-112M116 172c29-9 41-29 37-53"
        stroke="#8a8764"
        strokeWidth="2.5"
      />
      <path
        d="M111 151c-25-7-35-21-32-40 19 3 31 16 32 40ZM119 174c22-8 35-22 32-38-18 5-30 17-32 38Z"
        fill="#bdc19a"
      />
      <path
        d="M100 85c7 1 16 9 12 17-5 7-16 5-22-2-6 10-18 11-23 4-5-8 3-18 11-20-11-3-15-14-9-21 8-7 18 0 20 10 3-11 15-16 21-8 6 8-1 17-10 20Z"
        fill="#d69c84"
      />
      <circle cx="89" cy="85" r="8" fill="#faf1df" />
      <path
        d="M217 54c4-4 12-4 14 1 2 5-4 10-10 10 3 7 0 14-6 13-7-1-8-9-4-14-8 2-14-3-11-9 4-6 11-4 14 1 0-7 4-12 9-9"
        fill="#bf785c"
      />
      <circle cx="217" cy="61" r="4" fill="#f4d79e" />
      <path d="M118 192h67l-9 29h-49l-9-29Z" fill="#caa27f" />
      <path d="M127 196h48" stroke="#e5c8a6" strokeWidth="3" />
      <path
        d="m64 137 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8ZM244 155l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"
        fill="#b18b53"
      />
      <circle cx="143" cy="54" r="3" fill="#caa27f" />
      <circle cx="238" cy="195" r="3" fill="#caa27f" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  detail,
  Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  Icon: typeof Wallet;
  tone?: string;
}): React.ReactElement {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <p>{label}</p>
        <span className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

function TaskRow({
  task,
  onChange,
  compact = false,
}: {
  task: Plan["tasks"][number];
  onChange: () => void;
  compact?: boolean;
}): React.ReactElement {
  const overdue = !task.completed && task.dueDate < localDate();
  return (
    <div className={`task-row ${task.completed ? "task-complete" : ""}`}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={onChange}
          aria-label={task.title}
        />
        <span>
          <strong>{task.title}</strong>
          <small>{task.category}</small>
        </span>
      </label>
      <span className={`due-tag ${overdue ? "overdue" : ""}`}>
        {task.completed
          ? "Complete"
          : `${overdue ? "Overdue · " : ""}${formatDate(task.dueDate, compact)}`}
      </span>
    </div>
  );
}

function BudgetView({
  event,
  updatePlan,
}: {
  event: StoredEvent;
  updatePlan: (update: (plan: Plan) => Plan) => void;
}): React.ReactElement {
  const allocated = sumMoney(event.plan.budget.map((item) => item.allocated));
  const actual = sumMoney(event.plan.budget.map((item) => item.actual));
  const [editingError, setEditingError] = useState("");
  const change = (id: string, field: "allocated" | "actual", value: string) => {
    const amount = Number(value);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 100000000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    ) {
      setEditingError(
        "Enter an amount between 0 and 100,000,000 with up to two decimal places.",
      );
      return;
    }
    setEditingError("");
    try {
      const budget =
        field === "allocated"
          ? reallocateBudget(event.plan.budget, id, amount)
          : event.plan.budget.map((item) =>
              item.id === id ? { ...item, actual: amount } : item,
            );
      updatePlan((plan) => ({ ...plan, budget }));
    } catch (error) {
      setEditingError(
        error instanceof Error
          ? error.message
          : "Could not update this allocation.",
      );
    }
  };
  const exportBudget = () =>
    download(
      "\uFEFF" +
        [
          [
            "Category",
            `Allocated (${event.input.currency})`,
            `Actual (${event.input.currency})`,
            "Remaining",
          ],
          ...event.plan.budget.map((item) => [
            item.category,
            item.allocated,
            item.actual,
            item.allocated - item.actual,
          ]),
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
      "celebrate-budget.csv",
      "text/csv;charset=utf-8",
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">A PLAN FOR EVERY PENNY</p>
          <h2>Your celebration budget</h2>
          <p>
            Adjust allocations and record spending as your plans come together.
          </p>
        </div>
        <button className="button secondary" onClick={exportBudget}>
          <ArrowDownToLine size={17} />
          Export budget (CSV)
        </button>
      </div>
      <div className="stats-grid three">
        <StatCard
          label="Total budget"
          value={money(event.input.budget, event.input.currency)}
          detail={`${money(event.input.budget / event.input.guests, event.input.currency)} per guest`}
          Icon={Wallet}
        />
        <StatCard
          label="Actual spend"
          value={money(actual, event.input.currency)}
          detail={`${money(allocated, event.input.currency)} allocated`}
          Icon={ClipboardList}
          tone="peach"
        />
        <StatCard
          label={actual > event.input.budget ? "Over budget" : "Remaining"}
          value={money(
            Math.abs(event.input.budget - actual),
            event.input.currency,
          )}
          detail={
            actual > event.input.budget
              ? "Review spending before new bookings"
              : "Available for your celebration"
          }
          Icon={Leaf}
          tone={actual > event.input.budget ? "red" : "green"}
        />
      </div>
      {(allocated > event.input.budget || actual > event.input.budget) && (
        <p role="alert" className="callout warning">
          {actual > event.input.budget
            ? `Actual spending is ${money(actual - event.input.budget, event.input.currency)} over your total budget.`
            : `Allocations exceed your budget by ${money(allocated - event.input.budget, event.input.currency)}.`}{" "}
          Reduce a category or edit the event budget.
        </p>
      )}
      {editingError && (
        <p role="alert" className="callout warning">
          {editingError}
        </p>
      )}
      <article className="card budget-table-card">
        <div className="card-heading">
          <h3>Make it add up</h3>
          <span className="badge">{event.input.currency}</span>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Budget allocations and actual spending by category, in{" "}
              {event.input.currency}
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Allocated</th>
                <th scope="col">Actual spend</th>
                <th scope="col">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {event.plan.budget.map((item, index) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className={`category-dot dot-${index % 6}`} />
                    {item.category}
                  </th>
                  <td>
                    <input
                      aria-label={`Allocation for ${item.category}`}
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={item.allocated}
                      onChange={(changeEvent) =>
                        change(item.id, "allocated", changeEvent.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Actual spend for ${item.category}`}
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={item.actual}
                      onChange={(changeEvent) =>
                        change(item.id, "actual", changeEvent.target.value)
                      }
                    />
                  </td>
                  <td
                    className={
                      item.actual > item.allocated ? "text-danger" : ""
                    }
                  >
                    {money(item.allocated - item.actual, event.input.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{money(allocated, event.input.currency)}</td>
                <td>{money(actual, event.input.currency)}</td>
                <td>{money(allocated - actual, event.input.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="table-note">
          Allocation changes are balanced against the other categories, starting
          with the final category, to keep the total exact. Figures are
          estimates. Actual spend is separate from vendor quotes.
        </p>
      </article>
    </>
  );
}

function TimelineView({
  event,
  toggleTask,
}: {
  event: StoredEvent;
  toggleTask: (id: string) => void;
}): React.ReactElement {
  const [filter, setFilter] = useState("all");
  const tasks = event.plan.tasks.filter(
    (task) =>
      filter === "all" ||
      (filter === "done" ? task.completed : !task.completed),
  );
  const completed = event.plan.tasks.filter((task) => task.completed).length;
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ONE STEP AT A TIME</p>
          <h2>A little less last-minute</h2>
          <p>Your dates, your priorities, and a clear path to the big day.</p>
        </div>
        <span className="badge green">
          {completed} of {event.plan.tasks.length} complete
        </span>
      </div>
      <article className="card">
        <div className="card-heading">
          <h3>Your planning timeline</h3>
          <label className="filter-label">
            Show tasks
            <select
              aria-label="Show tasks"
              value={filter}
              onChange={(changeEvent) => setFilter(changeEvent.target.value)}
            >
              <option value="all">All tasks</option>
              <option value="open">To do</option>
              <option value="done">Completed</option>
            </select>
          </label>
        </div>
        <progress
          className="timeline-progress"
          max={Math.max(1, event.plan.tasks.length)}
          value={completed}
          aria-label="Planning task completion"
        />
        {tasks.length ? (
          <div className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onChange={() => toggleTask(task.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <CheckCheck size={30} />
            <h3>
              {filter === "open" ? "All caught up!" : "No tasks here yet"}
            </h3>
            <p>
              {filter === "open"
                ? "Take a breath and enjoy the anticipation."
                : "Completed tasks will appear here as you make progress."}
            </p>
          </div>
        )}
      </article>
    </>
  );
}

function VendorsView({
  event,
  updatePlan,
}: {
  event: StoredEvent;
  updatePlan: (update: (plan: Plan) => Plan) => void;
}): React.ReactElement {
  const [vendorError, setVendorError] = useState("");
  const updateVendor = (
    id: string,
    changes: Partial<Plan["vendors"][number]>,
  ) =>
    updatePlan((plan) => ({
      ...plan,
      vendors: plan.vendors.map((vendor) =>
        vendor.id === id ? { ...vendor, ...changes } : vendor,
      ),
    }));
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">GOOD PEOPLE, GREAT CELEBRATIONS</p>
          <h2>Your vendor notebook</h2>
          <p>
            Keep conversations, quotes, and the important questions in one
            place.
          </p>
        </div>
        <span className="badge">
          {
            event.plan.vendors.filter((vendor) => vendor.status === "booked")
              .length
          }{" "}
          booked
        </span>
      </div>
      {vendorError && (
        <p role="alert" className="callout warning">
          {vendorError}
        </p>
      )}
      <p className="callout">
        These are categories to research, not verified vendor recommendations.
        Confirm availability, contracts, accessibility, and final prices
        directly.
      </p>
      <div className="vendor-grid">
        {event.plan.vendors.map((vendor) => (
          <article className="card vendor-card" key={vendor.id}>
            <div className="card-heading">
              <h3>{vendor.category}</h3>
              <Store size={19} className="muted" />
            </div>
            <label>
              Vendor name
              <input
                aria-label={`Vendor name for ${vendor.category}`}
                maxLength={120}
                value={vendor.name}
                onChange={(changeEvent) =>
                  updateVendor(vendor.id, { name: changeEvent.target.value })
                }
                placeholder="Add a name or business"
              />
            </label>
            <div className="vendor-form-row">
              <label>
                Quote ({event.input.currency})
                <input
                  aria-label={`Quote for ${vendor.category}`}
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  value={vendor.quote}
                  onChange={(changeEvent) => {
                    const quote = Number(changeEvent.target.value);
                    if (
                      Number.isFinite(quote) &&
                      quote >= 0 &&
                      quote <= 100000000 &&
                      Math.abs(quote * 100 - Math.round(quote * 100)) < 0.00001
                    ) {
                      setVendorError("");
                      updateVendor(vendor.id, { quote });
                    } else
                      setVendorError(
                        "Enter a quote between 0 and 100,000,000 with up to two decimal places.",
                      );
                  }}
                />
              </label>
              <label>
                Status
                <select
                  aria-label={`Status for ${vendor.category}`}
                  value={vendor.status}
                  onChange={(changeEvent) =>
                    updateVendor(vendor.id, {
                      status: changeEvent.target
                        .value as Plan["vendors"][number]["status"],
                    })
                  }
                >
                  <option value="not-started">Not started</option>
                  <option value="contacted">Contacted</option>
                  <option value="booked">Booked</option>
                </select>
              </label>
            </div>
            <h4>Before you book</h4>
            <ul className="vendor-checklist">
              {vendor.checklist.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={vendor.completedChecklist.includes(item)}
                      aria-label={`${vendor.category}: ${item}`}
                      onChange={(changeEvent) =>
                        updateVendor(vendor.id, {
                          completedChecklist: changeEvent.target.checked
                            ? [...vendor.completedChecklist, item]
                            : vendor.completedChecklist.filter(
                                (entry) => entry !== item,
                              ),
                        })
                      }
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}

function IdeasView({ event }: { event: StoredEvent }): React.ReactElement {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE DETAILS THAT FEEL LIKE YOU</p>
          <h2>A little inspiration</h2>
          <p>
            Thoughtful ideas shaped around your people, place, and priorities.
          </p>
        </div>
        <Flower2 className="section-flower" size={37} />
      </div>
      <div className="ideas-grid">
        {event.plan.ideas.map((idea, index) => (
          <article className={`card idea-card idea-${index % 3}`} key={idea.id}>
            <div className="idea-number">
              0{index + 1}
              <Sparkles size={18} />
            </div>
            <h3>{idea.title}</h3>
            <p>{idea.description}</p>
            <span className="idea-tag">
              Made for your{" "}
              {event.input.type === "community"
                ? "community event"
                : event.input.type}
            </span>
          </article>
        ))}
      </div>
      <article className="card preferences-card">
        <Leaf size={26} />
        <div>
          <h3>The thought behind the details</h3>
          <p>
            <strong>Your style:</strong>{" "}
            {event.input.vibe || "A celebration that feels like you"}
          </p>
          {event.input.priorities.length > 0 && (
            <p>
              <strong>Your priorities:</strong>{" "}
              {event.input.priorities.join(" · ")}
            </p>
          )}
          <p>
            <strong>Accessibility:</strong>{" "}
            {event.input.accessibility ||
              "Confirm access needs with guests and check venue routes."}
          </p>
          <p>
            <strong>Dietary needs:</strong>{" "}
            {event.input.dietary ||
              "Ask guests about allergies and food preferences before finalizing the menu."}
          </p>
        </div>
      </article>
    </>
  );
}

function BudgetChart({
  budget,
  currency,
  total,
}: {
  budget: Plan["budget"];
  currency: string;
  total: number;
}): React.ReactElement {
  return (
    <div
      className="donut-chart"
      role="img"
      aria-label={`Budget allocations: ${budget.map((item) => `${item.category} ${money(item.allocated, currency)}`).join(", ")}`}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="chart-base" cx="100" cy="100" r="80" />
        {budget.map((item, index) => {
          const length = (item.allocated / total) * 100;
          const start =
            (sumMoney(budget.slice(0, index).map((entry) => entry.allocated)) /
              total) *
            100;
          return (
            <circle
              key={item.id}
              className={`chart-${index % 6}`}
              cx="100"
              cy="100"
              r="80"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
            />
          );
        })}
      </svg>
      <div className="donut-label">
        <small>Allocated</small>
        <strong>{money(total, currency)}</strong>
      </div>
    </div>
  );
}

function Overview({
  event,
  setSection,
  toggleTask,
  onEdit,
}: {
  event: StoredEvent;
  setSection: (section: Section) => void;
  toggleTask: (id: string) => void;
  onEdit: () => void;
}): React.ReactElement {
  const completed = event.plan.tasks.filter((task) => task.completed).length;
  const allocated = sumMoney(event.plan.budget.map((item) => item.allocated));
  const actual = sumMoney(event.plan.budget.map((item) => item.actual));
  const nextTasks = [
    ...event.plan.tasks.filter((task) => !task.completed),
    ...event.plan.tasks.filter((task) => task.completed),
  ].slice(0, 3);
  const booked = event.plan.vendors.filter(
    (vendor) => vendor.status === "booked",
  ).length;
  const days = remainingDays(event.input.date);
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">
            <span className="tiny-flower">✳</span> LESS STRESS. MORE
            CELEBRATING.
          </p>
          <h1>Celebrate beautifully.</h1>
          <p>Big moments start with a little thoughtful planning.</p>
        </div>
        <span className="today-date">
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </section>
      <article className="event-hero">
        <div className="event-hero-content">
          <span className="badge paper">
            YOUR{" "}
            {event.input.type === "community"
              ? "COMMUNITY EVENT"
              : event.input.type.toUpperCase()}
          </span>
          <h2>{event.input.name}</h2>
          <div className="event-meta">
            <span>
              <CalendarDays size={15} />
              {formatDate(event.input.date)}
            </span>
            <span>
              <MapPin size={15} />
              {event.input.location}
            </span>
            <span>
              <Users size={15} />
              {event.input.guests} guests
            </span>
          </div>
          <div className="hero-bottom">
            <span className="countdown">
              <span className="countdown-dot" />
              {days > 0
                ? `${days} days to make it wonderful`
                : days === 0
                  ? "Today is your day. Enjoy every moment."
                  : "Your celebration memories start here"}
            </span>
            <button className="text-button" onClick={onEdit}>
              Edit event <Pencil size={13} />
            </button>
          </div>
        </div>
        <BotanicalIllustration />
      </article>
      <div className="stats-grid">
        <StatCard
          label="Total budget"
          value={money(event.input.budget, event.input.currency)}
          detail={
            <>
              <span
                className={actual > event.input.budget ? "text-danger" : ""}
              >
                {money(
                  Math.abs(event.input.budget - actual),
                  event.input.currency,
                )}{" "}
                {actual > event.input.budget ? "over budget" : "remaining"}
              </span>
            </>
          }
          Icon={Wallet}
        />
        <StatCard
          label="Planning progress"
          value={`${Math.round((completed / Math.max(1, event.plan.tasks.length)) * 100)}%`}
          detail={
            <>
              <progress
                className="mini-progress"
                max={Math.max(1, event.plan.tasks.length)}
                value={completed}
                aria-label="Planning task completion"
              />
              {completed} of {event.plan.tasks.length} tasks done
            </>
          }
          Icon={ListChecks}
          tone="peach"
        />
        <StatCard
          label="Guest count"
          value={String(event.input.guests)}
          detail={`${money(event.input.budget / event.input.guests, event.input.currency)} budget per person`}
          Icon={Users}
          tone="lavender"
        />
        <StatCard
          label="Vendors booked"
          value={`${booked} / ${event.plan.vendors.length}`}
          detail={
            booked === event.plan.vendors.length
              ? "Your team is coming together"
              : "Find your perfect celebration team"
          }
          Icon={Store}
          tone="yellow"
        />
      </div>
      <div className="overview-columns">
        <article className="card next-tasks">
          <div className="card-heading">
            <div>
              <h3>A little progress, every day</h3>
              <p>Let’s take care of what’s next.</p>
            </div>
            <button
              className="text-button"
              onClick={() => setSection("timeline")}
            >
              View timeline <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="task-list">
            {nextTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onChange={() => toggleTask(task.id)}
                compact
              />
            ))}
          </div>
          <div className="card-footer">
            <span>
              <span className="status-dot" />
              {completed === event.plan.tasks.length
                ? "Everything is checked off. You did it!"
                : "Small steps. A celebration to remember."}
            </span>
            <Heart size={15} />
          </div>
        </article>
        <article className="card budget-preview">
          <div className="card-heading">
            <div>
              <h3>Room for what matters</h3>
              <p>Your budget at a glance.</p>
            </div>
            <Wallet size={18} className="muted" />
          </div>
          <div className="budget-glance">
            <BudgetChart
              budget={event.plan.budget}
              currency={event.input.currency}
              total={allocated}
            />
            <ul className="budget-legend">
              {event.plan.budget.slice(0, 4).map((item, index) => (
                <li key={item.id}>
                  <span className={`category-dot dot-${index}`} />
                  <span>{item.category}</span>
                  <strong>
                    {Math.round((item.allocated / event.input.budget) * 100)}%
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          <button
            className="full-width-link"
            onClick={() => setSection("budget")}
          >
            Manage budget <ArrowRight size={15} />
          </button>
        </article>
      </div>
      <div className="inspiration-heading">
        <div>
          <p className="eyebrow">A FEW THOUGHTFUL TOUCHES</p>
          <h2>Make it feel like you.</h2>
        </div>
        <button className="text-button" onClick={() => setSection("ideas")}>
          Explore ideas <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="inspiration-row">
        {event.plan.ideas.slice(0, 3).map((idea, index) => (
          <button
            className={`inspiration-tile inspiration-${index}`}
            key={idea.id}
            onClick={() => setSection("ideas")}
          >
            <span className="idea-icon">
              {index === 0 ? (
                <Flower2 size={26} />
              ) : index === 1 ? (
                <Leaf size={26} />
              ) : (
                <Heart size={26} />
              )}
            </span>
            <span>
              <strong>{idea.title}</strong>
              <small>{idea.description}</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <div className="plan-summary">
        <Sparkles size={18} />
        <p>{event.plan.summary}</p>
      </div>
    </>
  );
}

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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Service unavailable");
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
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
      })
      .catch(() => {
        if (
          !controller.signal.aborted ||
          document.visibilityState === "visible"
        )
          setHealthError(true);
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
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
        <aside
          ref={sidebarRef}
          className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
          aria-label="Event workspace"
        >
          <a
            className="brand"
            href="#main-content"
            onClick={() => navigate("overview")}
          >
            <span className="brand-mark">✳</span>
            <span>
              celebrate<span className="brand-ai">AI</span>
              <small>A LITTLE PLANNING. A LOT OF JOY.</small>
            </span>
          </a>
          <p className="sidebar-label">YOUR CELEBRATION</p>
          <div className="event-switch-wrap">
            <label className="sr-only" htmlFor="event-switch">
              Switch event
            </label>
            <select
              id="event-switch"
              value={current?.id ?? ""}
              onChange={(changeEvent) => {
                setSelectedId(changeEvent.target.value);
                setSection("overview");
                setMobileOpen(false);
              }}
            >
              <option value="" disabled>
                {events.length ? "Choose an event" : "No events yet"}
              </option>
              {events.map((event) => (
                <option value={event.id} key={event.id}>
                  {event.input.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
          {current?.id === "sample-celebration" && (
            <span className="sample-label">Sample event · explore freely</span>
          )}
          <nav aria-label="Main navigation">
            <p className="sidebar-label planning-label">THE PLANNING SPACE</p>
            {navigation.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-current={section === id ? "page" : undefined}
                className={`nav-item ${section === id ? "active" : ""}`}
                onClick={() => navigate(id)}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
                {section === id && <span className="nav-active-dot" />}
              </button>
            ))}
          </nav>
          <button className="new-event-button" onClick={openNew}>
            <Plus size={17} />
            New event
          </button>
          <div className="sidebar-note">
            <Flower2 size={29} strokeWidth={1.3} />
            <p>
              The best celebrations
              <br />
              feel like <em>you.</em>
            </p>
            <span>We’ll help with the rest.</span>
          </div>
          <div className="sidebar-bottom">
            <button
              onClick={() => {
                setHelpOpen(true);
                setMobileOpen(false);
              }}
            >
              <CircleHelp size={17} />A little help
            </button>
            <button
              aria-label="Open settings"
              onClick={() => {
                setSettingsOpen(true);
                setMobileOpen(false);
              }}
            >
              <Settings2 size={17} />
              Settings & backups
            </button>
            <div className="workspace-person">
              <span className="avatar">
                <Heart size={17} />
              </span>
              <div>
                <strong>Your happy place</strong>
                <small>Personal planning workspace</small>
              </div>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
        <div ref={mainShellRef} className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <button
                id="mobile-nav-toggle"
                className="icon-button mobile-menu"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <Menu size={22} />
              </button>
              <span className="breadcrumb">
                My celebrations <ChevronRight size={13} />
                <strong>
                  {navigation.find((item) => item.id === section)?.label}
                </strong>
              </span>
            </div>
            <div className="topbar-right">
              <span className="private-label">
                <ShieldCheck size={14} />
                Stored in this browser
              </span>
              <button
                className="topbar-help"
                aria-label="Planning help"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp size={18} />
              </button>
              <span className="topbar-avatar" aria-hidden="true">
                Y
              </span>
            </div>
          </header>
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
        <Dialog
          title="Settings & backups"
          onClose={() => setSettingsOpen(false)}
        >
          {notice && (
            <div
              role={notice.kind === "error" ? "alert" : "status"}
              className={`notice ${notice.kind}`}
            >
              {notice.text}
            </div>
          )}
          <p className="dialog-intro">
            Your events stay in this browser. Export a backup to keep them safe
            or move to another device.
          </p>
          <div className="settings-section">
            <h3>
              <ShieldCheck size={18} />
              Planning service
            </h3>
            <p>
              {healthError
                ? "Server unavailable. Local rules-based planning is available."
                : !health
                  ? "Checking the planning service…"
                  : health.aiEnabled
                    ? "AI provider is configured. Event preferences are sent to the server and configured provider when generating a plan."
                    : "Demo mode: useful rules-based planning is available. A server-side AI key enables generative personalization."}
            </p>
            {health?.tokenRequired && (
              <p className="callout">
                This server requires an access token to generate a plan through
                the API.
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
              Held in memory for this tab only. Never enter your AI provider API
              key here.
            </p>
          </div>
          {corruptStorageProtected && (
            <div className="callout warning">
              <p>
                Unreadable saved data has been preserved. Download it before
                creating, editing, importing, or deleting an event, which
                replaces the saved workspace.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  try {
                    download(
                      localStorage.getItem(STORAGE_KEY) ?? "",
                      "celebrate-recovery.json",
                      "application/json",
                    );
                  } catch {
                    setNotice({
                      text: "Browser storage is unavailable. The recovery file could not be read.",
                      kind: "error",
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
            <button
              className="button secondary"
              onClick={exportEvents}
              disabled={!events.length}
            >
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
                  event.target.value = "";
                }}
              />
            </label>
            <p className="field-hint">
              Validated JSON backup, up to 2 MB and 20 events. Matching event
              identifiers are updated; other events are kept.
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
      )}
      {helpOpen && (
        <Dialog
          title="A little help goes a long way"
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <p>
              Create an event with your budget, guest count, location, date, and
              preferences. Your plan includes suggested allocations, a dated
              checklist, vendor questions, and personal ideas.
            </p>
            <h3>Make the plan yours</h3>
            <p>
              Edit budget allocations and actual spend in Budget. Check off
              tasks in Timeline. Add vendor names, quotes, and booking status in
              Vendors. Your changes are saved in this browser.
            </p>
            <h3>How AI works here</h3>
            <p>
              With a server-side AI key, the service uses your planning
              preferences to personalize a validated plan. If AI is unavailable,
              a transparent rules-based plan keeps you moving. Provider mode is
              shown below every plan.
            </p>
            <h3>A thoughtful starting point</h3>
            <p>
              Budget figures are estimates, and vendor categories are research
              checklists. Verify real quotes, safety arrangements, dietary
              needs, accessibility, permissions, and local requirements with
              your venue and suppliers.
            </p>
            <h3>Keep a copy</h3>
            <p>
              Use Settings & backups to export and import your events. Clearing
              browser data removes local plans. Your API access token is kept
              only for the current tab session.
            </p>
            <button
              className="button primary"
              onClick={() => {
                setHelpOpen(false);
                openNew();
              }}
            >
              Plan a celebration <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
