import { describe, expect, it } from 'vitest';
import {
  editBudgetAmount,
  editVendorDetails,
  setVendorChecklistItem,
} from '../src/client/lib/plan-editors.js';
import { sumMoney } from '../src/client/lib/budget.js';
import { savedEvent } from './fixtures.js';

describe('plan editing', () => {
  it('balances allocation edits while preserving spending, vendor data and the original plan', () => {
    const event = savedEvent();
    const previous = structuredClone(event.plan);
    const category = event.plan.budget[0]!;
    const updated = editBudgetAmount(event.plan, category.id, 'allocated', 100);
    expect(updated.budget[0]!.allocated).toBe(100);
    expect(sumMoney(updated.budget.map((item) => item.allocated))).toBe(event.input.budget);
    expect(updated.vendors).toBe(event.plan.vendors);
    expect(event.plan).toEqual(previous);
  });

  it('records actual spending independently from allocation and vendor quotes', () => {
    const plan = savedEvent().plan;
    const category = plan.budget[0]!;
    const updated = editBudgetAmount(plan, category.id, 'actual', 500.01);
    expect(updated.budget[0]).toEqual({ ...category, actual: 500.01 });
    expect(updated.budget.slice(1)).toEqual(plan.budget.slice(1));
    expect(updated.vendors).toBe(plan.vendors);
    expect(plan.budget[0]!.actual).toBe(0);
  });

  it('keeps vendor edits separate from spending and preserves other vendor details', () => {
    const plan = savedEvent().plan;
    const vendor = plan.vendors[0]!;
    const updated = editVendorDetails(plan, vendor.id, {
      name: 'Garden catering',
      quote: 600.25,
      status: 'contacted',
    });
    expect(updated.vendors[0]).toEqual({
      ...vendor,
      name: 'Garden catering',
      quote: 600.25,
      status: 'contacted',
    });
    expect(updated.vendors.slice(1)).toEqual(plan.vendors.slice(1));
    expect(updated.budget).toBe(plan.budget);
    expect(vendor.name).toBe('');
  });

  it('preserves consecutive checklist changes applied before the next render', () => {
    const original = savedEvent().plan;
    const vendor = original.vendors[0]!;
    const first = vendor.checklist[0]!;
    const second = vendor.checklist[1]!;
    const firstEdit = setVendorChecklistItem(original, vendor.id, first, true);
    const secondEdit = setVendorChecklistItem(firstEdit, vendor.id, second, true);
    expect(secondEdit.vendors[0]!.completedChecklist).toEqual([first, second]);
    expect(vendor.completedChecklist).toEqual([]);
  });

  it('treats repeated checks as idempotent and unchecks only the requested item', () => {
    const plan = savedEvent().plan;
    const vendor = plan.vendors[0]!;
    const item = vendor.checklist[0]!;
    const checked = setVendorChecklistItem(plan, vendor.id, item, true);
    const repeated = setVendorChecklistItem(checked, vendor.id, item, true);
    expect(repeated.vendors[0]!.completedChecklist).toEqual([item]);
    expect(
      setVendorChecklistItem(repeated, vendor.id, item, false).vendors[0]!.completedChecklist,
    ).toEqual([]);
  });

  it('ignores unknown vendors and checklist items without inventing completion data', () => {
    const plan = savedEvent().plan;
    const vendor = plan.vendors[0]!;
    expect(setVendorChecklistItem(plan, 'removed-vendor', vendor.checklist[0]!, true)).toEqual(
      plan,
    );
    expect(setVendorChecklistItem(plan, vendor.id, 'An unchecked external item', true)).toEqual(
      plan,
    );
    expect(editVendorDetails(plan, 'removed-vendor', { name: 'No longer here' })).toEqual(plan);
  });
});
