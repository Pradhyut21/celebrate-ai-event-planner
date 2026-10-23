import type { Plan } from '../../shared/schema.js';
import { MoneySchema } from '../../shared/schema.js';

/** Sum in minor units so a displayed financial total has no floating-point drift. */
export function sumMoney(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

/** Rebalance other categories atomically, preserving the exact total allocation. */
export function reallocateBudget(
  budget: Plan['budget'],
  id: string,
  amount: number,
): Plan['budget'] {
  const target = budget.find((item) => item.id === id);
  if (!target) throw new Error('Budget category not found.');
  const cents = Math.round(amount * 100);
  const total = budget.reduce((sum, item) => sum + Math.round(item.allocated * 100), 0);
  if (!MoneySchema.safeParse(amount).success || cents > total)
    throw new Error('Use up to two decimal places and an allocation within the total budget.');
  const next = budget.map((item) => ({
    ...item,
    allocated: item.id === id ? cents / 100 : item.allocated,
  }));
  let delta = cents - Math.round(target.allocated * 100);
  const others = next.filter((item) => item.id !== id).reverse();
  if (!others.length && delta !== 0)
    throw new Error('A single category must equal the total budget.');
  for (const item of others) {
    if (delta === 0) break;
    const available = Math.round(item.allocated * 100);
    const adjustment = delta > 0 ? Math.min(available, delta) : delta;
    item.allocated = (available - adjustment) / 100;
    delta -= adjustment;
  }
  if (delta !== 0) throw new Error('There is not enough budget in other categories.');
  return next;
}
