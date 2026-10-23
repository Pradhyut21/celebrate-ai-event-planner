import React, { useState } from "react";
import { ArrowDownToLine, ClipboardList, Leaf, Wallet } from "lucide-react";
import type { Plan, StoredEvent } from "../../shared/schema.js";
import { csvCell, reallocateBudget, sumMoney } from "../lib/data.js";
import { money } from "../lib/format.js";
import { download } from "../lib/download.js";
import { StatCard } from "../components/StatCard.js";

export function BudgetView({
  event,
  updatePlan,
}: {
  event: StoredEvent;
  updatePlan: (update: (plan: Plan) => Plan) => void;
}): React.ReactElement {
  const allocated = sumMoney(event.plan.budget.map((item) => item.allocated));
  const actual = sumMoney(event.plan.budget.map((item) => item.actual));
  const [editingError, setEditingError] = useState("");
  const change = (id: string, field: "allocated" | "actual", value: string) => {
    const amount = Number(value);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 100000000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    ) {
      setEditingError(
        "Enter an amount between 0 and 100,000,000 with up to two decimal places.",
      );
      return;
    }
    setEditingError("");
    try {
      const budget =
        field === "allocated"
          ? reallocateBudget(event.plan.budget, id, amount)
          : event.plan.budget.map((item) =>
              item.id === id ? { ...item, actual: amount } : item,
            );
      updatePlan((plan) => ({ ...plan, budget }));
    } catch (error) {
      setEditingError(
        error instanceof Error
          ? error.message
          : "Could not update this allocation.",
      );
    }
  };
  const exportBudget = () =>
    download(
      "\uFEFF" +
        [
          [
            "Category",
            `Allocated (${event.input.currency})`,
            `Actual (${event.input.currency})`,
            "Remaining",
          ],
          ...event.plan.budget.map((item) => [
            item.category,
            item.allocated,
            item.actual,
            item.allocated - item.actual,
          ]),
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n"),
      "celebrate-budget.csv",
      "text/csv;charset=utf-8",
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">A PLAN FOR EVERY PENNY</p>
          <h2>Your celebration budget</h2>
          <p>
            Adjust allocations and record spending as your plans come together.
          </p>
        </div>
        <button className="button secondary" onClick={exportBudget}>
          <ArrowDownToLine size={17} />
          Export budget (CSV)
        </button>
      </div>
      <div className="stats-grid three">
        <StatCard
          label="Total budget"
          value={money(event.input.budget, event.input.currency)}
          detail={`${money(event.input.budget / event.input.guests, event.input.currency)} per guest`}
          Icon={Wallet}
        />
        <StatCard
          label="Actual spend"
          value={money(actual, event.input.currency)}
          detail={`${money(allocated, event.input.currency)} allocated`}
          Icon={ClipboardList}
          tone="peach"
        />
        <StatCard
          label={actual > event.input.budget ? "Over budget" : "Remaining"}
          value={money(
            Math.abs(event.input.budget - actual),
            event.input.currency,
          )}
          detail={
            actual > event.input.budget
              ? "Review spending before new bookings"
              : "Available for your celebration"
          }
          Icon={Leaf}
          tone={actual > event.input.budget ? "red" : "green"}
        />
      </div>
      {(allocated > event.input.budget || actual > event.input.budget) && (
        <p role="alert" className="callout warning">
          {actual > event.input.budget
            ? `Actual spending is ${money(actual - event.input.budget, event.input.currency)} over your total budget.`
            : `Allocations exceed your budget by ${money(allocated - event.input.budget, event.input.currency)}.`}{" "}
          Reduce a category or edit the event budget.
        </p>
      )}
      {editingError && (
        <p role="alert" className="callout warning">
          {editingError}
        </p>
      )}
      <article className="card budget-table-card">
        <div className="card-heading">
          <h3>Make it add up</h3>
          <span className="badge">{event.input.currency}</span>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Budget allocations and actual spending by category, in{" "}
              {event.input.currency}
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Allocated</th>
                <th scope="col">Actual spend</th>
                <th scope="col">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {event.plan.budget.map((item, index) => (
                <tr key={item.id}>
                  <th scope="row">
                    <span className={`category-dot dot-${index % 6}`} />
                    {item.category}
                  </th>
                  <td>
                    <input
                      aria-label={`Allocation for ${item.category}`}
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={item.allocated}
                      onChange={(changeEvent) =>
                        change(item.id, "allocated", changeEvent.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Actual spend for ${item.category}`}
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={item.actual}
                      onChange={(changeEvent) =>
                        change(item.id, "actual", changeEvent.target.value)
                      }
                    />
                  </td>
                  <td
                    className={
                      item.actual > item.allocated ? "text-danger" : ""
                    }
                  >
                    {money(item.allocated - item.actual, event.input.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{money(allocated, event.input.currency)}</td>
                <td>{money(actual, event.input.currency)}</td>
                <td>{money(allocated - actual, event.input.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="table-note">
          Allocation changes are balanced against the other categories, starting
          with the final category, to keep the total exact. Figures are
          estimates. Actual spend is separate from vendor quotes.
        </p>
      </article>
    </>
  );
}
