import type { EventInput, Plan } from '../../shared/schema.js';
import { sumMoney } from './budget.js';

/** Quote CSV fields and neutralize spreadsheet formulas, including whitespace-prefixed ones. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Use exact cent differences, quoted cells, CRLF rows and a UTF-8 BOM for spreadsheet tools. */
export function createBudgetCsv(budget: Plan['budget'], currency: EventInput['currency']): string {
  const rows: (string | number)[][] = [
    ['Category', `Allocated (${currency})`, `Actual (${currency})`, 'Remaining'],
    ...budget.map((item) => [
      item.category,
      item.allocated,
      item.actual,
      sumMoney([item.allocated, -item.actual]),
    ]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
