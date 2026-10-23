import { describe, expect, it } from 'vitest';
import {
  EventInputSchema,
  MoneySchema,
  PlanSchema,
  StoredEventSchema,
  type EventInput,
} from '../src/shared/schema.js';
import { generatePlan } from '../src/shared/planner.js';

const today = '2027-01-01';
const input: EventInput = {
  name: 'Asha & Dev',
  type: 'wedding',
  date: '2027-07-10',
  currency: 'INR',
  budget: 250_000,
  guests: 80,
  location: 'Bengaluru',
  vibe: 'Garden gathering',
  priorities: ['Food'],
  accessibility: '',
  dietary: '',
  notes: '',
};
const cents = (value: number) => Math.round(value * 100);

describe('trusted event planning engine', () => {
  it('adds capacity and crowd planning guidance for a large community gathering', () => {
    const plan = generatePlan({ ...input, type: 'community', guests: 500 }, today);
    expect(plan.warnings.some((warning) => warning.includes('crowd flow'))).toBe(true);
    expect(plan.tasks.some((task) => task.id === 'volunteers')).toBe(true);
  });
  it('creates a complete reproducible plan without external services', () => {
    const plan = generatePlan(input, today);
    expect(plan).toEqual(generatePlan(input, today));
    expect(PlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.generatedBy).toBe('rules');
    expect(plan.vendors.length).toBeGreaterThan(3);
    expect(
      plan.vendors.every(
        (vendor) => !vendor.name && vendor.quote === 0 && vendor.checklist.length > 1,
      ),
    ).toBe(true);
    expect(plan.tasks.some((task) => task.dueDate === input.date)).toBe(true);
  });

  it('keeps template content and later plans independent of edits to an earlier plan', () => {
    const expected = generatePlan(input, today);
    const edited = generatePlan(input, today);
    edited.budget[0]!.allocated = 0;
    edited.tasks[0]!.completed = true;
    edited.ideas[0]!.description = 'Changed for this event only';
    edited.vendors[0]!.checklist.push('A private event-specific reminder');
    edited.vendors[0]!.completedChecklist.push(edited.vendors[0]!.checklist[0]!);

    expect(generatePlan(input, today)).toEqual(expected);
    expect(input.priorities).toEqual(['Food']);
  });

  it('preserves every cent across types, priorities and tiny or large budgets', () => {
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      for (const budget of [
        0.01, 0.03, 0.09, 1, 12.99, 100.01, 2_501.37, 99_999_999.99, 100_000_000,
      ]) {
        for (const accessibility of ['', 'Step-free route and captions']) {
          const plan = generatePlan(
            {
              ...input,
              type,
              budget,
              accessibility,
              priorities: ['Food', 'Photography', 'Sustainability'],
            },
            today,
          );
          expect(plan.budget.reduce((sum, item) => sum + cents(item.allocated), 0)).toBe(
            cents(budget),
          );
          expect(
            plan.budget.every(
              (item) =>
                item.allocated >= 0 &&
                Math.abs(cents(item.allocated) - item.allocated * 100) < 0.00001,
            ),
          ).toBe(true);
          expect(cents(plan.budget.find((item) => item.id === 'contingency')!.allocated)).toBe(
            Math.round(cents(budget) * 0.1),
          );
        }
      }
    }
  });

  it('shifts flexible allocation towards selected priorities and keeps the reserve', () => {
    const base = generatePlan({ ...input, priorities: [] }, today);
    const food = generatePlan({ ...input, priorities: ['Food'] }, today);
    expect(food.budget.find((item) => item.id === 'food')!.allocated).toBeGreaterThan(
      base.budget.find((item) => item.id === 'food')!.allocated,
    );
    expect(food.budget.find((item) => item.id === 'contingency')).toEqual(
      base.budget.find((item) => item.id === 'contingency'),
    );
  });

  it('uses distinct event logic rather than relabelling one generic checklist', () => {
    const wedding = generatePlan(input, today);
    const birthday = generatePlan({ ...input, type: 'birthday' }, today);
    const community = generatePlan({ ...input, type: 'community' }, today);
    expect(wedding.tasks.some((task) => task.id === 'ceremony')).toBe(true);
    expect(birthday.tasks.some((task) => task.id === 'activities')).toBe(true);
    expect(community.tasks.some((task) => task.id === 'volunteers')).toBe(true);
    expect(community.budget.some((item) => item.id === 'outreach')).toBe(true);
    expect(wedding.ideas[0]).not.toEqual(birthday.ideas[0]);
  });

  it('reflects requested access, dietary, cultural and sustainable preferences', () => {
    const plan = generatePlan(
      {
        ...input,
        accessibility: 'Captions and step-free seating',
        dietary: 'Vegan and peanut allergy',
        priorities: ['Sustainability'],
        notes: 'Include a Tamil welcome with family approval',
      },
      today,
    );
    expect(plan.budget.some((item) => item.id === 'accessibility')).toBe(true);
    expect(plan.tasks.some((task) => task.id === 'dietary')).toBe(true);
    expect(plan.ideas.map((idea) => idea.description).join(' ')).toContain('Tamil welcome');
    expect(plan.ideas.some((idea) => idea.id === 'reuse')).toBe(true);
    expect(plan.warnings.join(' ')).toContain('cross-contact');
  });

  it('clamps overdue milestones to today, warns on compressed timelines and never schedules after the event', () => {
    const plan = generatePlan({ ...input, date: '2027-01-03' }, today);
    expect(plan.tasks.every((task) => task.dueDate >= today && task.dueDate <= '2027-01-03')).toBe(
      true,
    );
    expect(plan.tasks.some((task) => task.dueDate === today)).toBe(true);
    expect(plan.warnings.join(' ')).toContain('compressed');
    const sameDay = generatePlan({ ...input, date: today }, today);
    expect(sameDay.tasks.every((task) => task.dueDate === today)).toBe(true);
    expect(() => generatePlan({ ...input, date: '2026-12-31' }, today)).toThrow(RangeError);
  });

  it('applies compressed-timeline and crowd warnings only past their policy boundaries', () => {
    const boundary = generatePlan({ ...input, date: '2027-01-31', guests: 300 }, today);
    expect(boundary.warnings.some((warning) => warning.includes('compressed'))).toBe(false);
    expect(boundary.warnings.some((warning) => warning.includes('crowd flow'))).toBe(false);

    const beyond = generatePlan({ ...input, date: '2027-01-30', guests: 301 }, today);
    expect(beyond.warnings.some((warning) => warning.includes('compressed'))).toBe(true);
    expect(beyond.warnings.some((warning) => warning.includes('crowd flow'))).toBe(true);
  });

  it.each([
    ['INR', 500],
    ['USD', 20],
    ['EUR', 20],
    ['GBP', 18],
  ] as const)(
    'uses the stated %s budget heuristic without treating it as a vendor quote',
    (currency, floor) => {
      const atFloor = generatePlan({ ...input, currency, guests: 1, budget: floor }, today);
      const below = generatePlan({ ...input, currency, guests: 1, budget: floor - 0.01 }, today);
      expect(atFloor.warnings.some((warning) => warning.includes('budget per guest is lean'))).toBe(
        false,
      );
      expect(below.warnings.some((warning) => warning.includes('budget per guest is lean'))).toBe(
        true,
      );
      expect(atFloor.warnings[0]).toContain('not vendor quotes');
    },
  );

  it('handles maximum permitted text fields without producing an invalid plan', () => {
    const large = {
      ...input,
      name: 'n'.repeat(100),
      location: 'l'.repeat(120),
      vibe: 'v'.repeat(100),
      priorities: Array.from({ length: 8 }, () => 'p'.repeat(60)),
      dietary: 'd'.repeat(500),
      accessibility: 'a'.repeat(500),
      notes: 't'.repeat(1_000),
    };
    expect(() => generatePlan(large, today)).not.toThrow();
  });

  it('adds weather planning only when the user supplies outdoor context', () => {
    expect(generatePlan(input, today).tasks.some((task) => task.id === 'weather')).toBe(true);
    expect(
      generatePlan({ ...input, vibe: 'Intimate indoor dinner' }, today).tasks.some(
        (task) => task.id === 'weather',
      ),
    ).toBe(false);
  });
});

describe('input and import boundary validation', () => {
  it('accepts canonical currency values including zero, ordinary fractions and the upper limit', () => {
    for (const value of [0, 0.01, 0.29, 1.1, 12.99, 2_501.37, 99_999_999.99, 100_000_000]) {
      expect(MoneySchema.parse(value)).toBe(value);
    }
  });

  it.each([1e-8, 0.010000001, 1.100000001])(
    'rejects sub-cent precision %s before a positive event budget can round to zero',
    (budget) => {
      expect(MoneySchema.safeParse(budget).success).toBe(false);
      expect(() => generatePlan({ ...input, budget }, today)).toThrow();
    },
  );

  it.each([
    { budget: -1 },
    { budget: 0 },
    { budget: 10.001 },
    { budget: Number.POSITIVE_INFINITY },
    { budget: 100_000_001 },
    { guests: 0 },
    { guests: 2.5 },
    { guests: 10_001 },
    { currency: 'BTC' },
    { type: 'anything' },
    { date: '2027-02-29' },
    { date: '2027-02-31' },
    { date: '2027-1-02' },
    { name: '  ' },
    { name: '\u0000unsafe' },
    { notes: 'n'.repeat(1_001) },
    { admin: true },
  ])('rejects invalid input %j', (patch) => {
    expect(EventInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });

  it('accepts a leap-day date and trims user-entered strings', () => {
    expect(EventInputSchema.parse({ ...input, date: '2028-02-29', name: '  Welcome  ' }).name).toBe(
      'Welcome',
    );
  });

  it('rejects imported allocation tampering, duplicate item IDs and post-event tasks', () => {
    const valid = {
      id: 'event-1',
      input,
      plan: generatePlan(input, today),
      updatedAt: '2027-01-01T12:00:00.000Z',
    };
    expect(StoredEventSchema.safeParse(valid).success).toBe(true);
    const wrongBudget = structuredClone(valid);
    wrongBudget.plan.budget[0]!.allocated += 1;
    expect(StoredEventSchema.safeParse(wrongBudget).success).toBe(false);
    const duplicate = structuredClone(valid);
    duplicate.plan.tasks[1]!.id = duplicate.plan.tasks[0]!.id;
    expect(StoredEventSchema.safeParse(duplicate).success).toBe(false);
    const late = structuredClone(valid);
    late.plan.tasks[0]!.dueDate = '2028-01-01';
    expect(StoredEventSchema.safeParse(late).success).toBe(false);
  });

  it('validates vendor progress against its own unique checklist', () => {
    const valid = {
      id: 'event-1',
      input,
      plan: generatePlan(input, today),
      updatedAt: '2027-01-01T12:00:00.000Z',
    };
    const vendor = valid.plan.vendors[0]!;
    vendor.completedChecklist = [vendor.checklist[0]!];
    expect(StoredEventSchema.safeParse(valid).success).toBe(true);

    const unknownItem = structuredClone(valid);
    unknownItem.plan.vendors[0]!.completedChecklist.push('Not a task on this checklist');
    expect(StoredEventSchema.safeParse(unknownItem).success).toBe(false);

    const duplicateProgress = structuredClone(valid);
    duplicateProgress.plan.vendors[0]!.completedChecklist.push(vendor.checklist[0]!);
    expect(StoredEventSchema.safeParse(duplicateProgress).success).toBe(false);

    const duplicateTask = structuredClone(valid);
    duplicateTask.plan.vendors[0]!.checklist.push(vendor.checklist[0]!);
    expect(StoredEventSchema.safeParse(duplicateTask).success).toBe(false);
  });
});
