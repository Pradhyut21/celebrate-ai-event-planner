import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Dialog } from './Dialog.js';

export function HelpDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: () => void;
}): React.ReactElement {
  return (
    <Dialog title="A little help goes a long way" onClose={onClose}>
      <div className="help-content">
        <p>
          Create an event with your budget, guest count, location, date, and preferences. Your plan
          includes suggested allocations, a dated checklist, vendor questions, and personal ideas.
        </p>
        <h3>Make the plan yours</h3>
        <p>
          Edit budget allocations and actual spend in Budget. Check off tasks in Timeline. Add
          vendor names, quotes, and booking status in Vendors. Your changes are saved in this
          browser.
        </p>
        <h3>How AI works here</h3>
        <p>
          With a server-side AI key, the service uses your planning preferences to personalize a
          validated plan. If AI is unavailable, a transparent rules-based plan keeps you moving.
          Provider mode is shown below every plan.
        </p>
        <h3>A thoughtful starting point</h3>
        <p>
          Budget figures are estimates, and vendor categories are research checklists. Verify real
          quotes, safety arrangements, dietary needs, accessibility, permissions, and local
          requirements with your venue and suppliers.
        </p>
        <h3>Keep a copy</h3>
        <p>
          Use Settings & backups to export and import your events. Clearing browser data removes
          local plans. Your API access token is kept only for the current tab session.
        </p>
        <button className="button primary" onClick={onCreate}>
          Plan a celebration <ArrowRight size={16} />
        </button>
      </div>
    </Dialog>
  );
}
