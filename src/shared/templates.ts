import type { EventInput, Plan } from './schema.js';

/** Event-specific content is kept separate from the deterministic planning algorithms. */
export type CategoryId =
  | 'venue'
  | 'food'
  | 'decor'
  | 'experience'
  | 'photography'
  | 'equipment'
  | 'outreach'
  | 'staffing'
  | 'accessibility';

export interface BudgetCategory {
  readonly id: CategoryId;
  readonly name: string;
  readonly weight: number;
  readonly keywords: readonly string[];
}
export interface EventTemplate {
  readonly categories: readonly BudgetCategory[];
  readonly tasks: readonly (readonly [
    id: string,
    title: string,
    daysBefore: number,
    category: string,
  ])[];
  readonly ideas: readonly Plan['ideas'][number][];
}

export const EVENT_TEMPLATES: Readonly<Record<EventInput['type'], EventTemplate>> = {
  wedding: {
    categories: [
      { id: 'venue', name: 'Venue & ceremony', weight: 30, keywords: ['venue', 'ceremony'] },
      { id: 'food', name: 'Food & drink', weight: 26, keywords: ['food', 'catering', 'dining'] },
      {
        id: 'decor',
        name: 'Decor & flowers',
        weight: 12,
        keywords: ['decor', 'flowers', 'sustainab'],
      },
      {
        id: 'experience',
        name: 'Music & guest experience',
        weight: 10,
        keywords: ['entertainment', 'music', 'experience'],
      },
      {
        id: 'photography',
        name: 'Photography & memories',
        weight: 12,
        keywords: ['photo', 'memories'],
      },
    ],
    tasks: [
      [
        'guest-list',
        'Agree on the guest list, budget ceiling and decision makers',
        180,
        'Planning',
      ],
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
      {
        id: 'story-table',
        title: 'A table full of stories',
        description:
          'Invite guests to leave a favourite memory or a wish on cards. Collect them in a keepsake book after the celebration.',
      },
      {
        id: 'shared-ritual',
        title: 'Make room for meaningful rituals',
        description:
          'Ask the couple which family or cultural traditions they want to include. Build time around their choices and explain unfamiliar moments to guests.',
      },
      {
        id: 'welcome',
        title: 'A thoughtful guest welcome',
        description:
          'Offer a clear arrival map, drinking water and a quiet seating corner so guests can settle in comfortably.',
      },
    ],
  },
  birthday: {
    categories: [
      { id: 'venue', name: 'Venue & setup', weight: 20, keywords: ['venue'] },
      { id: 'food', name: 'Food & cake', weight: 30, keywords: ['food', 'cake', 'catering'] },
      {
        id: 'decor',
        name: 'Decor & invitations',
        weight: 15,
        keywords: ['decor', 'theme', 'sustainab'],
      },
      {
        id: 'experience',
        name: 'Activities & entertainment',
        weight: 15,
        keywords: ['entertainment', 'music', 'experience', 'activities'],
      },
      {
        id: 'photography',
        name: 'Photos & keepsakes',
        weight: 10,
        keywords: ['photo', 'memories'],
      },
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
      {
        id: 'memory-wall',
        title: 'A little wall of big memories',
        description:
          'Build a reusable photo wall with favourite milestones. Invite guests to add one happy memory without putting anyone on the spot.',
      },
      {
        id: 'activity-stations',
        title: 'Choose-your-own celebration',
        description:
          'Offer a creative station, a simple group game and a quiet activity. Guests can join at their own pace.',
      },
      {
        id: 'birthday-playlist',
        title: 'A playlist from your people',
        description:
          'Ask guests for one song that reminds them of the person being celebrated. Keep the volume comfortable and leave space for conversation.',
      },
    ],
  },
  community: {
    categories: [
      { id: 'venue', name: 'Venue & permits', weight: 22, keywords: ['venue'] },
      { id: 'food', name: 'Food & refreshments', weight: 20, keywords: ['food', 'catering'] },
      {
        id: 'equipment',
        name: 'Equipment & activities',
        weight: 18,
        keywords: ['equipment', 'entertainment', 'experience', 'activities'],
      },
      {
        id: 'outreach',
        name: 'Outreach & signage',
        weight: 12,
        keywords: ['outreach', 'decor', 'sustainab'],
      },
      {
        id: 'staffing',
        name: 'Volunteers & operations',
        weight: 18,
        keywords: ['volunteer', 'operations', 'safety'],
      },
    ],
    tasks: [
      [
        'purpose',
        'Agree on the event purpose, community partners and success measures',
        90,
        'Planning',
      ],
      ['venue', 'Confirm venue capacity and ask about local permits and insurance', 60, 'Venue'],
      ['volunteers', 'Recruit volunteers and assign a coordinator for each area', 45, 'Team'],
      ['outreach', 'Publish accessible invitations through community channels', 30, 'Outreach'],
      [
        'safety',
        'Review weather, first aid, lost-person and crowd plans with the venue',
        21,
        'Operations',
      ],
      ['rsvp', 'Confirm attendance, refreshments and support requirements', 10, 'Guests'],
      ['briefing', 'Brief volunteers on responsibilities and emergency contacts', 3, 'Team'],
      [
        'celebrate',
        'Complete the opening check and record attendance without unnecessary personal data',
        0,
        'Event day',
      ],
    ],
    ideas: [
      {
        id: 'skill-share',
        title: 'Let the community lead',
        description:
          'Invite residents to host short skill shares, performances or story circles. Give first-time contributors a clear time slot and a named helper.',
      },
      {
        id: 'connection',
        title: 'Make introductions easy',
        description:
          'Use optional interest cards and a welcome volunteer to help newcomers find someone to talk with. Avoid requiring personal contact information.',
      },
      {
        id: 'shared-impact',
        title: 'Celebrate a shared impact',
        description:
          'Choose one visible community outcome, such as a book exchange or neighbourhood art piece, and reserve volunteer time for cleanup.',
      },
    ],
  },
};

export const VENDOR_CHECKLISTS: Readonly<Record<CategoryId, readonly string[]>> = {
  venue: [
    'Confirm capacity, total hire cost, deposit and cancellation terms in writing.',
    'Walk the entrance, toilets and emergency exits; verify step-free routes.',
    'Ask about weather backup, setup hours, power and cleanup responsibilities.',
  ],
  food: [
    'Request an itemized quote with serving quantities, staffing, taxes and delivery.',
    'Confirm ingredient labels, separate preparation and cross-contact procedures for allergies.',
    'Agree on water, food storage and the final guest-count deadline.',
  ],
  decor: [
    'Agree on an itemized design and reuse or rental options.',
    'Check installation, flame restrictions, teardown and disposal responsibilities.',
  ],
  experience: [
    'Confirm the schedule, sound limits, equipment and backup arrangements.',
    'Offer a quiet alternative and obtain consent before recording guests.',
  ],
  photography: [
    'Review a portfolio and agree on coverage hours and delivery dates.',
    'Record guest photo preferences and agree on image use and retention.',
  ],
  equipment: [
    'Test power needs, cables, sound levels and backup equipment.',
    'Check accessibility, supervision and safe installation of all activity areas.',
  ],
  outreach: [
    'Use readable, high-contrast signage and accessible digital invitations.',
    'Confirm permissions before publishing any participant photographs.',
  ],
  staffing: [
    'Assign named leads, breaks and an emergency contact tree.',
    'Confirm volunteer briefing, first aid coverage and cleanup duties.',
  ],
  accessibility: [
    'Verify step-free entry, usable toilets, accessible seating and transport drop-off.',
    'Confirm requested communication support, quiet space and a named access contact.',
  ],
};
