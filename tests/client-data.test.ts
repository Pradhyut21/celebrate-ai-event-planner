import { describe, expect, it } from "vitest";
import {
  csvCell,
  MAX_BACKUP_BYTES,
  parseBackup,
  reallocateBudget,
  serializeBackup,
  sumMoney,
} from "../src/client/lib/data.js";
import { generatePlan } from "../src/shared/planner.js";
import type { EventInput, StoredEvent } from "../src/shared/schema.js";

const input: EventInput = {
  name: "Neighborhood lunch",
  type: "community",
  date: "2030-06-10",
  currency: "USD",
  budget: 1234.56,
  guests: 50,
  location: "Community garden",
  vibe: "Relaxed and inclusive",
  priorities: ["Food"],
  dietary: "Vegetarian",
  accessibility: "Step-free access",
  notes: "",
};
const event: StoredEvent = {
  id: "test-event",
  input,
  plan: generatePlan(input, "2030-01-01"),
  updatedAt: "2030-01-01T12:00:00.000Z",
};

describe("backup boundary", () => {
  it("round-trips meaningful event data, completed tasks, quotes, and checklist progress", () => {
    const copy = structuredClone(event);
    copy.plan.tasks[0].completed = true;
    copy.plan.vendors[0].quote = 300.25;
    copy.plan.vendors[0].completedChecklist = [
      copy.plan.vendors[0].checklist[0],
    ];
    expect(parseBackup(serializeBackup([copy]))).toEqual([copy]);
  });

  it.each([
    "null",
    "[]",
    "{}",
    '{"version":2,"events":[]}',
    '{"version":1,"events":[]}',
    '{"version":1,"events":[{}]}',
    "{bad json",
  ])(
    "rejects malformed or incompatible data before replacing events: %s",
    (raw) => {
      expect(() => parseBackup(raw)).toThrow();
    },
  );

  it("can load an intentionally empty saved workspace without recreating sample data", () => {
    expect(parseBackup('{"version":1,"events":[]}', true)).toEqual([]);
  });

  it("rejects duplicate identifiers and over-limit collections", () => {
    expect(() => parseBackup(serializeBackup([event, event]))).toThrow(
      /duplicate/,
    );
    expect(() =>
      parseBackup(
        serializeBackup(
          Array.from({ length: 21 }, (_, index) => ({
            ...event,
            id: String(index),
          })),
        ),
      ),
    ).toThrow(/1–20/);
  });

  it("measures backup size in bytes rather than character count", () => {
    expect(() =>
      parseBackup("界".repeat(Math.ceil(MAX_BACKUP_BYTES / 3) + 1)),
    ).toThrow(/2 MB/);
  });

  it("rejects structurally plausible plans with a broken financial invariant", () => {
    const damaged = structuredClone(event);
    damaged.plan.budget[0].allocated += 1;
    expect(() => parseBackup(serializeBackup([damaged]))).toThrow(
      /allocation/i,
    );
  });
});

describe("spreadsheet export safety", () => {
  it.each([
    '=HYPERLINK("https://example.test")',
    "+SUM(A1:A2)",
    "-1+2",
    "@SUM(1)",
    "  =SUM(A1)",
    "\t=1",
    "\r=1",
  ])("neutralizes potentially executable cell: %s", (value) => {
    expect(csvCell(value).startsWith("\"'")).toBe(true);
  });
  it("quotes punctuation, embedded quotes, and line breaks while keeping ordinary values", () => {
    expect(csvCell('Dinner, "garden"\nparty')).toBe(
      '"Dinner, ""garden""\nparty"',
    );
    expect(csvCell(123.45)).toBe('"123.45"');
    expect(csvCell("Food & drinks")).toBe('"Food & drinks"');
  });
});

describe("financial editing", () => {
  const budget = [
    { id: "food", category: "Food", allocated: 70.1, actual: 0 },
    { id: "decor", category: "Decor", allocated: 20.2, actual: 0 },
    { id: "reserve", category: "Reserve", allocated: 9.7, actual: 0 },
  ];
  it("adds cents accurately across many amounts", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
    expect(sumMoney([])).toBe(0);
    expect(sumMoney(budget.map((item) => item.allocated))).toBe(100);
  });
  it("uses the reserve first, then other categories, without mutating the source", () => {
    const adjusted = reallocateBudget(budget, "food", 90.25);
    expect(adjusted.map((item) => item.allocated)).toEqual([90.25, 9.75, 0]);
    expect(sumMoney(adjusted.map((item) => item.allocated))).toBe(100);
    expect(budget[0].allocated).toBe(70.1);
  });
  it("returns reductions to the final other category", () => {
    expect(reallocateBudget(budget, "food", 60)[2].allocated).toBe(19.8);
    expect(reallocateBudget(budget, "reserve", 9)[1].allocated).toBe(20.9);
    expect(reallocateBudget(budget, "food", 70.1)).toEqual(budget);
  });
  it.each([-1, 100.01, 1.001, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid allocation %s",
    (amount) => {
      expect(() => reallocateBudget(budget, "food", amount)).toThrow();
    },
  );
  it("rejects unknown IDs and a changing single-category total", () => {
    expect(() => reallocateBudget(budget, "missing", 1)).toThrow(/not found/);
    expect(() => reallocateBudget([budget[0]], "food", 70)).toThrow(
      /single category/,
    );
    expect(reallocateBudget([budget[0]], "food", 70.1)).toEqual([budget[0]]);
  });
});
