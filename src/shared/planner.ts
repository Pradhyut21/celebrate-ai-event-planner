import {
  DateOnlySchema,
  EventInputSchema,
  PlanSchema,
  type EventInput,
  type Plan,
} from './schema.js';

import { EVENT_TEMPLATES, VENDOR_CHECKLISTS } from './templates.js';

const DAY_MS = 86_400_000;
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
    if (remaining-- <= 0) break;
    amounts[item.index]! += 1;
  }
  return amounts;
}

function dueDate(eventDate: string, daysBefore: number, today: string): string {
  const proposed = new Date(new Date(`${eventDate}T00:00:00Z`).getTime() - daysBefore * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return proposed < today ? today : proposed;
}

/** Pure planning engine: no network, random IDs, location inference or supplier claims. */
export function generatePlan(raw: EventInput, today = utcToday()): Plan {
  const input = EventInputSchema.parse(raw);
  DateOnlySchema.parse(today);
  if (input.date < today) throw new RangeError('Choose today or a future event date.');
  const template = EVENT_TEMPLATES[input.type];
  const priorities = input.priorities.join(' ').toLowerCase().normalize('NFKD');
  const categories = template.categories.map((category) => ({
    ...category,
    weight:
      category.weight +
      (category.keywords.some((keyword) => priorities.includes(keyword)) ? 12 : 0),
  }));
  if (input.accessibility || priorities.includes('access')) {
    categories.push({
      id: 'accessibility',
      name: 'Accessibility & guest comfort',
      weight: 8,
      keywords: [],
    });
  }
  const totalCents = Math.round(input.budget * 100);
  const reserveCents = Math.round(totalCents * 0.1);
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

  const days = Math.round(
    (new Date(`${input.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
  const warnings = [
    'Allocations are planning targets, not vendor quotes. Confirm local prices, taxes, permits and availability before booking.',
  ];
  if (days < 30)
    warnings.push(
      'The timeline is compressed. Earlier milestones are due today; prioritize venue, essential suppliers and guest communication.',
    );
  const floor = { INR: 500, USD: 20, EUR: 20, GBP: 18 }[input.currency];
  if (input.budget / input.guests < floor)
    warnings.push(
      'Your budget per guest is lean by this planner’s rough heuristic. Consider a simpler venue, a shorter format or fewer paid services; validate with local quotes.',
    );
  if (input.guests > 300)
    warnings.push(
      'For a large gathering, confirm venue capacity, crowd flow, toilets, first aid coverage and local requirements with the responsible organizers.',
    );
  if (input.dietary)
    warnings.push(
      'Dietary notes are preferences to verify. Allergy-safe preparation and cross-contact controls must be confirmed directly with the caterer.',
    );
  return PlanSchema.parse({
    summary: `${input.name} is a ${input.vibe || 'warm and welcoming'} ${input.type} for ${input.guests} guests in ${input.location} on ${input.date}. Your ${input.currency} ${input.budget.toLocaleString('en-US', { maximumFractionDigits: 2 })} budget includes a 10% contingency reserve. ${input.priorities.length ? `Planning priorities: ${input.priorities.join(', ')}.` : 'Start with the venue, guest needs and essential suppliers.'}`,
    budget,
    tasks,
    vendors: categories.map((category) => ({
      id: category.id,
      category: category.name,
      checklist: [...VENDOR_CHECKLISTS[category.id]],
      completedChecklist: [],
      status: 'not-started',
      name: '',
      quote: 0,
    })),
    ideas: ideas.slice(0, 12),
    warnings,
    generatedBy: 'rules',
  });
}
