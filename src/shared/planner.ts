import { DateOnlySchema, EventInputSchema, PlanSchema, type EventInput, type Plan } from './schema.js';

const DAY_MS = 86_400_000;
type Category = { id: string; name: string; weight: number; keywords: string[] };
type Template = {
  categories: Category[];
  tasks: [id: string, title: string, daysBefore: number, category: string][];
  ideas: { id: string; title: string; description: string }[];
};

const TEMPLATES: Record<EventInput['type'], Template> = {
  wedding: {
    categories: [
      {id: 'venue', name: 'Venue & ceremony', weight: 30, keywords: ['venue', 'ceremony']},
      {id: 'food', name: 'Food & drink', weight: 26, keywords: ['food', 'catering', 'dining']},
      {id: 'decor', name: 'Decor & flowers', weight: 12, keywords: ['decor', 'flowers', 'sustainab']},
      {id: 'experience', name: 'Music & guest experience', weight: 10, keywords: ['entertainment', 'music', 'experience']},
      {id: 'photography', name: 'Photography & memories', weight: 12, keywords: ['photo', 'memories']},
    ],
    tasks: [
      ['guest-list', 'Agree on the guest list, budget ceiling and decision makers', 180, 'Planning'],
      ['venue', 'Compare ceremony and reception venues; confirm total fees', 150, 'Venue'],
      ['vendors', 'Request three written quotes from each key supplier', 120, 'Vendors'],
      ['invites', 'Send invitations with RSVP, dietary and access questions', 90, 'Guests'],
      ['ceremony', 'Confirm ceremony customs and a realistic order of events', 45, 'Ceremony'],
      ['rsvp', 'Close RSVPs and draft the seating and meal plan', 21, 'Guests'],
      ['confirm', 'Confirm supplier arrival times, balances and backup contacts', 7, 'Vendors'],
      ['run-sheet', 'Share the final run sheet with your celebration team', 2, 'Coordination'],
      ['celebrate', 'Check the venue, emergency contacts and guest welcome', 0, 'Event day'],
    ],
    ideas: [
      {id: 'story-table', title: 'A table full of stories', description: 'Invite guests to leave a favourite memory or a wish on cards. Collect them in a keepsake book after the celebration.'},
      {id: 'shared-ritual', title: 'Make room for meaningful rituals', description: 'Ask the couple which family or cultural traditions they want to include. Build time around their choices and explain unfamiliar moments to guests.'},
      {id: 'welcome', title: 'A thoughtful guest welcome', description: 'Offer a clear arrival map, drinking water and a quiet seating corner so guests can settle in comfortably.'},
    ],
  },
  birthday: {
    categories: [
      {id: 'venue', name: 'Venue & setup', weight: 20, keywords: ['venue']},
      {id: 'food', name: 'Food & cake', weight: 30, keywords: ['food', 'cake', 'catering']},
      {id: 'decor', name: 'Decor & invitations', weight: 15, keywords: ['decor', 'theme', 'sustainab']},
      {id: 'experience', name: 'Activities & entertainment', weight: 15, keywords: ['entertainment', 'music', 'experience', 'activities']},
      {id: 'photography', name: 'Photos & keepsakes', weight: 10, keywords: ['photo', 'memories']},
    ],
    tasks: [
      ['guest-list', 'Confirm the guest list, interests and celebration format', 60, 'Planning'],
      ['venue', 'Reserve the venue and check age-appropriate facilities', 45, 'Venue'],
      ['invites', 'Send invitations with RSVP, dietary and access questions', 30, 'Guests'],
      ['activities', 'Plan inclusive activities and a quiet alternative', 21, 'Activities'],
      ['food', 'Confirm the cake, menu and allergy labels', 14, 'Food'],
      ['rsvp', 'Confirm attendance and any support needs', 7, 'Guests'],
      ['run-sheet', 'Pack supplies and share setup and pickup responsibilities', 2, 'Coordination'],
      ['celebrate', 'Set up water, seating, first aid and the welcome area', 0, 'Event day'],
    ],
    ideas: [
      {id: 'memory-wall', title: 'A little wall of big memories', description: 'Build a reusable photo wall with favourite milestones. Invite guests to add one happy memory without putting anyone on the spot.'},
      {id: 'activity-stations', title: 'Choose-your-own celebration', description: 'Offer a creative station, a simple group game and a quiet activity. Guests can join at their own pace.'},
      {id: 'birthday-playlist', title: 'A playlist from your people', description: 'Ask guests for one song that reminds them of the person being celebrated. Keep the volume comfortable and leave space for conversation.'},
    ],
  },
  community: {
    categories: [
      {id: 'venue', name: 'Venue & permits', weight: 22, keywords: ['venue']},
      {id: 'food', name: 'Food & refreshments', weight: 20, keywords: ['food', 'catering']},
      {id: 'equipment', name: 'Equipment & activities', weight: 18, keywords: ['equipment', 'entertainment', 'experience', 'activities']},
      {id: 'outreach', name: 'Outreach & signage', weight: 12, keywords: ['outreach', 'decor', 'sustainab']},
      {id: 'staffing', name: 'Volunteers & operations', weight: 18, keywords: ['volunteer', 'operations', 'safety']},
    ],
    tasks: [
      ['purpose', 'Agree on the event purpose, community partners and success measures', 90, 'Planning'],
      ['venue', 'Confirm venue capacity and ask about local permits and insurance', 60, 'Venue'],
      ['volunteers', 'Recruit volunteers and assign a coordinator for each area', 45, 'Team'],
      ['outreach', 'Publish accessible invitations through community channels', 30, 'Outreach'],
      ['safety', 'Review weather, first aid, lost-person and crowd plans with the venue', 21, 'Operations'],
      ['rsvp', 'Confirm attendance, refreshments and support requirements', 10, 'Guests'],
      ['briefing', 'Brief volunteers on responsibilities and emergency contacts', 3, 'Team'],
      ['celebrate', 'Complete the opening check and record attendance without unnecessary personal data', 0, 'Event day'],
    ],
    ideas: [
      {id: 'skill-share', title: 'Let the community lead', description: 'Invite residents to host short skill shares, performances or story circles. Give first-time contributors a clear time slot and a named helper.'},
      {id: 'connection', title: 'Make introductions easy', description: 'Use optional interest cards and a welcome volunteer to help newcomers find someone to talk with. Avoid requiring personal contact information.'},
      {id: 'shared-impact', title: 'Celebrate a shared impact', description: 'Choose one visible community outcome, such as a book exchange or neighbourhood art piece, and reserve volunteer time for cleanup.'},
    ],
  },
};

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Hamilton allocation preserves every cent even for very small budgets. */
function allocateCents(total: number, weights: number[]): number[] {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const quotas = weights.map((weight) => total * weight / weightTotal);
  const amounts = quotas.map(Math.floor);
  let remaining = total - amounts.reduce((sum, value) => sum + value, 0);
  const order = quotas.map((quota, index) => ({index, remainder: quota - amounts[index]!}))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (remaining-- <= 0) break;
    amounts[item.index]! += 1;
  }
  return amounts;
}

function dueDate(eventDate: string, daysBefore: number, today: string): string {
  const proposed = new Date(new Date(`${eventDate}T00:00:00Z`).getTime() - daysBefore * DAY_MS)
    .toISOString().slice(0, 10);
  return proposed < today ? today : proposed;
}

const vendorChecklist: Record<string, string[]> = {
  venue: ['Confirm capacity, total hire cost, deposit and cancellation terms in writing.', 'Walk the entrance, toilets and emergency exits; verify step-free routes.', 'Ask about weather backup, setup hours, power and cleanup responsibilities.'],
  food: ['Request an itemized quote with serving quantities, staffing, taxes and delivery.', 'Confirm ingredient labels, separate preparation and cross-contact procedures for allergies.', 'Agree on water, food storage and the final guest-count deadline.'],
  decor: ['Agree on an itemized design and reuse or rental options.', 'Check installation, flame restrictions, teardown and disposal responsibilities.'],
  experience: ['Confirm the schedule, sound limits, equipment and backup arrangements.', 'Offer a quiet alternative and obtain consent before recording guests.'],
  photography: ['Review a portfolio and agree on coverage hours and delivery dates.', 'Record guest photo preferences and agree on image use and retention.'],
  equipment: ['Test power needs, cables, sound levels and backup equipment.', 'Check accessibility, supervision and safe installation of all activity areas.'],
  outreach: ['Use readable, high-contrast signage and accessible digital invitations.', 'Confirm permissions before publishing any participant photographs.'],
  staffing: ['Assign named leads, breaks and an emergency contact tree.', 'Confirm volunteer briefing, first aid coverage and cleanup duties.'],
  accessibility: ['Verify step-free entry, usable toilets, accessible seating and transport drop-off.', 'Confirm requested communication support, quiet space and a named access contact.'],
};

/** Pure planning engine: no network, random IDs, location inference or supplier claims. */
export function generatePlan(raw: EventInput, today = utcToday()): Plan {
  const input = EventInputSchema.parse(raw);
  DateOnlySchema.parse(today);
  if (input.date < today) throw new RangeError('Choose today or a future event date.');
  const template = TEMPLATES[input.type];
  const priorities = input.priorities.join(' ').toLowerCase().normalize('NFKD');
  const categories = template.categories.map((category) => ({...category,
    weight: category.weight + (category.keywords.some((keyword) => priorities.includes(keyword)) ? 12 : 0),
  }));
  if (input.accessibility || priorities.includes('access')) {
    categories.push({id: 'accessibility', name: 'Accessibility & guest comfort', weight: 8, keywords: []});
  }
  const totalCents = Math.round(input.budget * 100);
  const reserveCents = Math.round(totalCents * 0.1);
  const allocated = allocateCents(totalCents - reserveCents, categories.map((category) => category.weight));
  const budget: Plan['budget'] = categories.map((category, index) => ({
    id: category.id, category: category.name, allocated: allocated[index]! / 100, actual: 0,
  }));
  budget.push({id: 'contingency', category: 'Contingency reserve', allocated: reserveCents / 100, actual: 0});

  const tasks: Plan['tasks'] = template.tasks.map(([id, title, days, category]) => ({
    id, title, dueDate: dueDate(input.date, days, today), completed: false, category,
  }));
  if (input.dietary) tasks.push({id: 'dietary', title: 'Confirm the requested dietary needs and allergy procedures with the food lead',
    dueDate: dueDate(input.date, 21, today), completed: false, category: 'Food'});
  if (input.accessibility) tasks.push({id: 'accessibility', title: 'Verify requested access arrangements with guests and the venue',
    dueDate: dueDate(input.date, 30, today), completed: false, category: 'Accessibility'});
  if (/outdoor|garden|park|beach/i.test(`${input.location} ${input.vibe} ${input.notes}`)) {
    tasks.push({id: 'weather', title: 'Confirm a sheltered backup, water and weather decision time',
      dueDate: dueDate(input.date, 14, today), completed: false, category: 'Operations'});
  }
  tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const ideas = template.ideas.map((idea) => ({...idea}));
  ideas.push({id: 'personal-vibe', title: `Bring your ${input.vibe.slice(0, 80) || 'welcoming'} style to life`,
    description: `Choose one shared visual motif and one guest activity that suit ${input.name}. Reuse the motif on the welcome sign, invitations and table details to keep the plan cohesive.`});
  if (input.dietary) ideas.push({id: 'dietary', title: 'A menu everyone can navigate',
    description: `Plan around these stated needs: ${input.dietary.slice(0, 250)}. Confirm ingredients and preparation with the caterer; use clear labels and provide an equivalent meal option.`});
  if (input.accessibility) ideas.push({id: 'accessibility', title: 'Comfort is part of the celebration',
    description: `Start with your requested arrangements: ${input.accessibility.slice(0, 250)}. Confirm individual preferences with guests and share practical arrival information before the event.`});
  if (/sustainab|eco|reus|zero.?waste/i.test(`${priorities} ${input.notes}`)) ideas.push({id: 'reuse', title: 'Celebrate with less waste',
    description: 'Use rented or reusable decor, refillable water stations and clearly labelled waste sorting. Confirm safe surplus-food handling with the caterer before arranging donations.'});
  if (input.notes) ideas.push({id: 'personal-notes', title: 'Keep your personal details visible',
    description: `Discuss these preferences with the planning team: ${input.notes.slice(0, 400)}. Confirm any cultural or family traditions with the people involved instead of assuming them from the location.`});

  const days = Math.round((new Date(`${input.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
  const warnings = ['Allocations are planning targets, not vendor quotes. Confirm local prices, taxes, permits and availability before booking.'];
  if (days < 30) warnings.push('The timeline is compressed. Earlier milestones are due today; prioritize venue, essential suppliers and guest communication.');
  const floor = {INR: 500, USD: 20, EUR: 20, GBP: 18}[input.currency];
  if (input.budget / input.guests < floor) warnings.push('Your budget per guest is lean by this planner’s rough heuristic. Consider a simpler venue, a shorter format or fewer paid services; validate with local quotes.');
  if (input.guests > 300) warnings.push('For a large gathering, confirm venue capacity, crowd flow, toilets, first aid coverage and local requirements with the responsible organizers.');
  if (input.dietary) warnings.push('Dietary notes are preferences to verify. Allergy-safe preparation and cross-contact controls must be confirmed directly with the caterer.');
  return PlanSchema.parse({
    summary: `${input.name} is a ${input.vibe || 'warm and welcoming'} ${input.type} for ${input.guests} guests in ${input.location} on ${input.date}. Your ${input.currency} ${input.budget.toLocaleString('en-US', {maximumFractionDigits: 2})} budget includes a 10% contingency reserve. ${input.priorities.length ? `Planning priorities: ${input.priorities.join(', ')}.` : 'Start with the venue, guest needs and essential suppliers.'}`,
    budget, tasks,
    vendors: categories.map((category) => ({id: category.id, category: category.name,
      checklist: [...(vendorChecklist[category.id] ?? [])], completedChecklist: [], status: 'not-started', name: '', quote: 0})),
    ideas: ideas.slice(0, 12), warnings, generatedBy: 'rules',
  });
}
