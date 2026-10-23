import React from "react";
import type { Plan } from "../../shared/schema.js";
import { money } from "../lib/format.js";
import { sumMoney } from "../lib/data.js";

export function BudgetChart({
  budget,
  currency,
  total,
}: {
  budget: Plan["budget"];
  currency: string;
  total: number;
}): React.ReactElement {
  return (
    <div
      className="donut-chart"
      role="img"
      aria-label={`Budget allocations: ${budget.map((item) => `${item.category} ${money(item.allocated, currency)}`).join(", ")}`}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="chart-base" cx="100" cy="100" r="80" />
        {budget.map((item, index) => {
          const length = (item.allocated / total) * 100;
          const start =
            (sumMoney(budget.slice(0, index).map((entry) => entry.allocated)) /
              total) *
            100;
          return (
            <circle
              key={item.id}
              className={`chart-${index % 6}`}
              cx="100"
              cy="100"
              r="80"
              pathLength="100"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
            />
          );
        })}
      </svg>
      <div className="donut-label">
        <small>Allocated</small>
        <strong>{money(total, currency)}</strong>
      </div>
    </div>
  );
}
