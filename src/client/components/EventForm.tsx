import React, { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { EventInput, StoredEvent } from "../../shared/schema.js";
import { eventInputSchema } from "../../shared/schema.js";
import { futureDate, localDate } from "../lib/format.js";
import { Dialog } from "./Dialog.js";

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

export function EventForm({
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
