import React, { useId, useState } from 'react';
import { Store } from 'lucide-react';
import type { Plan, StoredEvent } from '../../shared/schema.js';
import { MoneySchema } from '../../shared/schema.js';
import {
  editVendorDetails,
  setVendorChecklistItem,
  type VendorDetails,
} from '../lib/plan-editors.js';

export function VendorsView({
  event,
  updatePlan,
}: {
  event: StoredEvent;
  updatePlan: (update: (plan: Plan) => Plan) => void;
}): React.ReactElement {
  const [vendorError, setVendorError] = useState<string | null>(null);
  const errorId = useId();
  const updateVendor = (id: string, changes: VendorDetails) =>
    updatePlan((plan) => editVendorDetails(plan, id, changes));
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">GOOD PEOPLE, GREAT CELEBRATIONS</p>
          <h2>Your vendor notebook</h2>
          <p>Keep conversations, quotes, and the important questions in one place.</p>
        </div>
        <span className="badge">
          {event.plan.vendors.filter((vendor) => vendor.status === 'booked').length} booked
        </span>
      </div>
      {vendorError && (
        <p id={errorId} role="alert" className="callout warning">
          Enter a quote between 0 and 100,000,000 with up to two decimal places.
        </p>
      )}
      <p className="callout">
        These are categories to research, not verified vendor recommendations. Confirm availability,
        contracts, accessibility, and final prices directly.
      </p>
      <div className="vendor-grid">
        {event.plan.vendors.map((vendor) => (
          <article className="card vendor-card" key={vendor.id}>
            <div className="card-heading">
              <h3>{vendor.category}</h3>
              <Store size={19} className="muted" />
            </div>
            <label>
              Vendor name
              <input
                aria-label={`Vendor name for ${vendor.category}`}
                maxLength={120}
                value={vendor.name}
                onChange={(changeEvent) =>
                  updateVendor(vendor.id, { name: changeEvent.target.value })
                }
                placeholder="Add a name or business"
              />
            </label>
            <div className="vendor-form-row">
              <label>
                Quote ({event.input.currency})
                <input
                  aria-label={`Quote for ${vendor.category}`}
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  value={vendor.quote}
                  aria-invalid={vendorError === vendor.id}
                  aria-describedby={vendorError === vendor.id ? errorId : undefined}
                  onChange={(changeEvent) => {
                    const quote = Number(changeEvent.target.value);
                    if (MoneySchema.safeParse(quote).success) {
                      setVendorError(null);
                      updateVendor(vendor.id, { quote });
                    } else setVendorError(vendor.id);
                  }}
                />
              </label>
              <label>
                Status
                <select
                  aria-label={`Status for ${vendor.category}`}
                  value={vendor.status}
                  onChange={(changeEvent) =>
                    updateVendor(vendor.id, {
                      status: changeEvent.target.value as Plan['vendors'][number]['status'],
                    })
                  }
                >
                  <option value="not-started">Not started</option>
                  <option value="contacted">Contacted</option>
                  <option value="booked">Booked</option>
                </select>
              </label>
            </div>
            <h4>Before you book</h4>
            <ul className="vendor-checklist">
              {vendor.checklist.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={vendor.completedChecklist.includes(item)}
                      aria-label={`${vendor.category}: ${item}`}
                      onChange={(changeEvent) => {
                        const completed = changeEvent.target.checked;
                        updatePlan((plan) =>
                          setVendorChecklistItem(plan, vendor.id, item, completed),
                        );
                      }}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
