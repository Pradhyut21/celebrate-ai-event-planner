import type { Plan } from '../../shared/schema.js';
import { reallocateBudget } from './budget.js';

type Vendor = Plan['vendors'][number];
export type VendorDetails = Partial<Pick<Vendor, 'name' | 'quote' | 'status'>>;
export type BudgetField = 'allocated' | 'actual';

export function editBudgetAmount(plan: Plan, id: string, field: BudgetField, amount: number): Plan {
  return {
    ...plan,
    budget:
      field === 'allocated'
        ? reallocateBudget(plan.budget, id, amount)
        : plan.budget.map((item) => (item.id === id ? { ...item, actual: amount } : item)),
  };
}

export function editVendorDetails(plan: Plan, id: string, changes: VendorDetails): Plan {
  return {
    ...plan,
    vendors: plan.vendors.map((vendor) => (vendor.id === id ? { ...vendor, ...changes } : vendor)),
  };
}

/** Compute from the current plan so queued checkbox edits cannot overwrite each other. */
export function setVendorChecklistItem(
  plan: Plan,
  id: string,
  item: string,
  completed: boolean,
): Plan {
  return {
    ...plan,
    vendors: plan.vendors.map((vendor) => {
      if (vendor.id !== id || !vendor.checklist.includes(item)) return vendor;
      return {
        ...vendor,
        completedChecklist: completed
          ? [...new Set([...vendor.completedChecklist, item])]
          : vendor.completedChecklist.filter((entry) => entry !== item),
      };
    }),
  };
}
