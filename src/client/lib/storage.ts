import type { EventInput, StoredEvent } from "../../shared/schema.js";
import { generatePlan } from "../../shared/planner.js";
import { futureDate } from "./format.js";
import { parseBackup, STORAGE_KEY } from "./data.js";

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
export function loadInitial(): { events: StoredEvent[]; warning: string } {
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
