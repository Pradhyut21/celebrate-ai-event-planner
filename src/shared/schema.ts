import { z } from 'zod';

/** Currency amounts are major units, with at most two decimal places. */
export const MoneySchema = z
  .number()
  .finite()
  .min(0)
  .max(100_000_000)
  .refine(
    (value) => value === Math.round(value * 100) / 100,
    'Use no more than two decimal places.',
  );

/** Rejects rollover dates such as 2027-02-31, which Date otherwise accepts. */
export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a real calendar date.');

// eslint-disable-next-line no-control-regex -- Reject control characters at the untrusted text boundary.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !CONTROL_CHARACTERS.test(value), 'Remove control characters.');

export const EventInputSchema = z
  .object({
    name: text(100).pipe(z.string().min(1, 'Give your celebration a name.')),
    type: z.enum(['wedding', 'birthday', 'community']),
    date: DateOnlySchema,
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
    budget: MoneySchema.refine((value) => value > 0, 'Budget must be greater than zero.'),
    guests: z.number().int().min(1).max(10_000),
    location: text(120).pipe(z.string().min(1, 'Enter a location.')),
    vibe: text(100).default('Warm and welcoming'),
    priorities: z
      .array(text(60).pipe(z.string().min(1)))
      .max(8)
      .default([]),
    accessibility: text(500).default(''),
    dietary: text(500).default(''),
    notes: text(1_000).default(''),
  })
  .strict();
export type EventInput = z.infer<typeof EventInputSchema>;

const ChecklistSchema = z
  .array(text(300))
  .max(15)
  .refine((items) => new Set(items).size === items.length, 'Checklist items must be unique.');

const VendorSchema = z
  .object({
    id: z.string().min(1).max(80),
    category: text(100),
    checklist: ChecklistSchema,
    completedChecklist: ChecklistSchema.default([]),
    status: z.enum(['not-started', 'contacted', 'booked']),
    name: text(120),
    quote: MoneySchema,
  })
  .strict()
  .refine((vendor) => vendor.completedChecklist.every((item) => vendor.checklist.includes(item)), {
    path: ['completedChecklist'],
    message: 'Completed items must belong to the vendor checklist.',
  });

export const PlanSchema = z
  .object({
    summary: text(1_400).pipe(z.string().min(1)),
    budget: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            category: text(100),
            allocated: MoneySchema,
            actual: MoneySchema,
          })
          .strict(),
      )
      .min(1)
      .max(20),
    tasks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: text(250),
            dueDate: DateOnlySchema,
            completed: z.boolean(),
            category: text(80),
          })
          .strict(),
      )
      .max(60),
    vendors: z.array(VendorSchema).max(20),
    ideas: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            title: text(120),
            description: text(600),
          })
          .strict(),
      )
      .max(12),
    warnings: z.array(text(600)).max(20),
    generatedBy: z.enum(['rules', 'openai']),
  })
  .strict();
export type Plan = z.infer<typeof PlanSchema>;

export const StoredEventSchema = z
  .object({
    id: z.string().min(1).max(100),
    input: EventInputSchema,
    plan: PlanSchema,
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((event, ctx) => {
    const expected = Math.round(event.input.budget * 100);
    const allocated = event.plan.budget.reduce(
      (sum, item) => sum + Math.round(item.allocated * 100),
      0,
    );
    if (allocated !== expected)
      ctx.addIssue({
        code: 'custom',
        path: ['plan', 'budget'],
        message: 'Budget allocation must match the event total.',
      });
    if (event.plan.tasks.some((task) => task.dueDate > event.input.date)) {
      ctx.addIssue({
        code: 'custom',
        path: ['plan', 'tasks'],
        message: 'Tasks cannot be due after the event.',
      });
    }
    for (const key of ['budget', 'tasks', 'vendors', 'ideas'] as const) {
      const ids = event.plan[key].map((item) => item.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', path: ['plan', key], message: 'IDs must be unique.' });
    }
  });
export type StoredEvent = z.infer<typeof StoredEventSchema>;
export const PlanResponseSchema = z.object({ plan: PlanSchema }).strict();

// Readable aliases for browser persistence and response validation.
export const eventInputSchema = EventInputSchema;
export const planSchema = PlanSchema;
export const storedEventSchema = StoredEventSchema;
export const planResponseSchema = PlanResponseSchema;
