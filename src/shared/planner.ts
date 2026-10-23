import {
  DateOnlySchema,
  EventInputSchema,
  PlanSchema,
  type EventInput,
  type Plan,
} from './schema.js';

import {
  EVENT_TEMPLATES,
  VENDOR_CHECKLISTS,
  type BudgetCategory,
  type EventTemplate,
} from './templates.js';

const DAY_MS = 86_400_000;
const CONTINGENCY_SHARE = 0.1;
const PRIORITY_WEIGHT_BOOST = 12;
const COMPRESSED_TIMELINE_DAYS = 30;
const LARGE_GATHERING_GUESTS = 300;
const LEAN_BUDGET_PER_GUEST: Readonly<Record<EventInput['currency'], number>> = {
  INR: 500,
  USD: 20,
  EUR: 20,
  GBP: 18,
};

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Hamilton allocation preserves every cent even for very small budgets. */
function allocateCents(total: number, weights: number[]): number[] {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const quotas = weights.map((weight) => (total * weight) / weightTotal);
  const amounts = quotas.map(Math.floor);
  let remaining = total - amounts.reduce((sum, value) => sum + value, 0);
  const order = quotas
    .map((quota, index) => ({ index, remainder: quota - amounts[index]! }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (remaining <= 0) break;
    amounts[item.index]! += 1;
    remaining -= 1;
  }
  return amounts;
}

function dueDate(eventDate: string, daysBefore: number, today: string): string {
  const proposed = new Date(new Date(`${eventDate}T00:00:00Z`).getTime() - daysBefore * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return proposed < today ? today : proposed;
}

function selectCategories(
  input: EventInput,
  template: EventTemplate,
  priorities: string,
): BudgetCategory[] {
  const categories = template.categories.map((category) => ({
    ...category,
    weight:
      category.weight +
      (category.keywords.some((keyword) => priorities.includes(keyword))
        ? PRIORITY_WEIGHT_BOOST
        : 0),
  }));
  if (input.accessibility || priorities.includes('access')) {
    categories.push({
      id: 'accessibility',
      name: 'Accessibility & guest comfort',
      weight: 8,
      keywords: [],
    });
  }
  return categories;
}

function buildBudget(input: EventInput, categories: readonly BudgetCategory[]): Plan['budget'] {
  const totalCents = Math.round(input.budget * 100);
  const reserveCents = Math.round(totalCents * CONTINGENCY_SHARE);
  const allocated = allocateCents(
    totalCents - reserveCents,
    categories.map((category) => category.weight),
  );
  const budget: Plan['budget'] = categories.map((category, index) => ({
    id: category.id,
    category: category.name,
    allocated: allocated[index]! / 100,
    actual: 0,
  }));
  budget.push({
    id: 'contingency',
    category: 'Contingency reserve',
    allocated: reserveCents / 100,
    actual: 0,
  });
  return budget;
}

function buildTimeline(input: EventInput, template: EventTemplate, today: string): Plan['tasks'] {
  const tasks: Plan['tasks'] = template.tasks.map(([id, title, days, category]) => ({
    id,
    title,
    dueDate: dueDate(input.date, days, today),
    completed: false,
    category,
  }));
  if (input.dietary)
    tasks.push({
      id: 'dietary',
      title: 'Confirm the requested dietary needs and allergy procedures with the food lead',
      dueDate: dueDate(input.date, 21, today),
      completed: false,
      category: 'Food',
    });
  if (input.accessibility)
    tasks.push({
      id: 'accessibility',
      title: 'Verify requested access arrangements with guests and the venue',
      dueDate: dueDate(input.date, 30, today),
      completed: false,
      category: 'Accessibility',
    });
  if (/outdoor|garden|park|beach/i.test(`${input.location} ${input.vibe} ${input.notes}`)) {
    tasks.push({
      id: 'weather',
      title: 'Confirm a sheltered backup, water and weather decision time',
      dueDate: dueDate(input.date, 14, today),
      completed: false,
      category: 'Operations',
    });
  }
  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return tasks;
}

function buildIdeas(input: EventInput, template: EventTemplate, priorities: string): Plan['ideas'] {
  const ideas = template.ideas.map((idea) => ({ ...idea }));
  ideas.push({
    id: 'personal-vibe',
    title: `Bring your ${input.vibe.slice(0, 80) || 'welcoming'} style to life`,
    description: `Choose one shared visual motif and one guest activity that suit ${input.name}. Reuse the motif on the welcome sign, invitations and table details to keep the plan cohesive.`,
  });
  if (input.dietary)
    ideas.push({
      id: 'dietary',
      title: 'A menu everyone can navigate',
      description: `Plan around these stated needs: ${input.dietary.slice(0, 250)}. Confirm ingredients and preparation with the caterer; use clear labels and provide an equivalent meal option.`,
    });
  if (input.accessibility)
    ideas.push({
      id: 'accessibility',
      title: 'Comfort is part of the celebration',
      description: `Start with your requested arrangements: ${input.accessibility.slice(0, 250)}. Confirm individual preferences with guests and share practical arrival information before the event.`,
    });
  if (/sustainab|eco|reus|zero.?waste/i.test(`${priorities} ${input.notes}`))
    ideas.push({
      id: 'reuse',
      title: 'Celebrate with less waste',
      description:
        'Use rented or reusable decor, refillable water stations and clearly labelled waste sorting. Confirm safe surplus-food handling with the caterer before arranging donations.',
    });
  if (input.notes)
    ideas.push({
      id: 'personal-notes',
      title: 'Keep your personal details visible',
      description: `Discuss these preferences with the planning team: ${input.notes.slice(0, 400)}. Confirm any cultural or family traditions with the people involved instead of assuming them from the location.`,
    });
  return ideas.slice(0, 12);
}

function buildWarnings(input: EventInput, today: string): Plan['warnings'] {
  const days = Math.round(
    (new Date(`${input.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
  const warnings = [
    'Allocations are planning targets, not vendor quotes. Confirm local prices, taxes, permits and availability before booking.',
  ];
  if (days < COMPRESSED_TIMELINE_DAYS)
    warnings.push(
      'The timeline is compressed. Earlier milestones are due today; prioritize venue, essential suppliers and guest communication.',
    );
  const floor = LEAN_BUDGET_PER_GUEST[input.currency];
  if (input.budget / input.guests < floor)
    warnings.push(
      'Your budget per guest is lean by this planner’s rough heuristic. Consider a simpler venue, a shorter format or fewer paid services; validate with local quotes.',
    );
  if (input.guests > LARGE_GATHERING_GUESTS)
    warnings.push(
      'For a large gathering, confirm venue capacity, crowd flow, toilets, first aid coverage and local requirements with the responsible organizers.',
    );
  if (input.dietary)
    warnings.push(
      'Dietary notes are preferences to verify. Allergy-safe preparation and cross-contact controls must be confirmed directly with the caterer.',
    );
  return warnings;
}

function buildSummary(input: EventInput): string {
  const formattedBudget = input.budget.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const prioritySummary = input.priorities.length
    ? `Planning priorities: ${input.priorities.join(', ')}.`
    : 'Start with the venue, guest needs and essential suppliers.';
  return [
    `${input.name} is a ${input.vibe || 'warm and welcoming'} ${input.type} for ${input.guests} guests in ${input.location} on ${input.date}.`,
    `Your ${input.currency} ${formattedBudget} budget includes a ${CONTINGENCY_SHARE * 100}% contingency reserve.`,
    prioritySummary,
  ].join(' ');
}

/** Pure planning engine: no network, random IDs, location inference or supplier claims. */
export function generatePlan(raw: EventInput, today = utcToday()): Plan {
  const input = EventInputSchema.parse(raw);
  DateOnlySchema.parse(today);
  if (input.date < today) throw new RangeError('Choose today or a future event date.');

  const template = EVENT_TEMPLATES[input.type];
  const priorities = input.priorities.join(' ').toLowerCase().normalize('NFKD');
  const categories = selectCategories(input, template, priorities);
  return PlanSchema.parse({
    summary: buildSummary(input),
    budget: buildBudget(input, categories),
    tasks: buildTimeline(input, template, today),
    vendors: categories.map((category) => ({
      id: category.id,
      category: category.name,
      checklist: [...VENDOR_CHECKLISTS[category.id]],
      completedChecklist: [],
      status: 'not-started',
      name: '',
      quote: 0,
    })),
    ideas: buildIdeas(input, template, priorities),
    warnings: buildWarnings(input, today),
    generatedBy: 'rules',
  });
}
