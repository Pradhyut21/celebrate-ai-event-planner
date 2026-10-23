# Maintaining Celebrate AI

## Dependency direction

`shared` defines contracts and pure planning behavior. It imports neither browser nor server code. Browser views call focused hooks; hooks use the validated HTTP service and a pure workspace reducer. The Express composition uses security/configuration/resource modules and the provider adapter. Modules do not import the application entry points.

| Change                     | Place to work                                  | Contract to preserve                                                             |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Event content              | `src/shared/templates.ts`                      | Distinct event logic; no invented suppliers or quotes                            |
| Allocation or deadlines    | `src/shared/planner.ts`                        | Exact cent totals, initial reserve, valid dates within the event schedule        |
| Budget edits and exports   | `src/client/lib/budget.ts`, `budget-export.ts` | Cent arithmetic for totals and differences; formula-safe CSV cells               |
| Supplier and cost edits    | `src/client/lib/plan-editors.ts`               | Typed editable fields; checklist edits derive from the latest plan               |
| Persisted event changes    | `src/client/lib/workspace.ts`                  | Apply against the latest state; validate before replacing saved data             |
| HTTP requests and fallback | `src/client/services/planning.ts`              | Unknown responses validated, explicit local fallback, cancellation and deadlines |
| UI behavior                | `src/client/views`, `components`, `hooks`      | Labels, keyboard access, focus restoration, no unsolicited provider calls        |
| Access policy              | `src/server/config.ts`, `middleware.ts`        | Exact origins, production HTTPS, server-only secrets and safe errors             |
| Resource limits            | `src/server/resources.ts`                      | Bounded address state, expiring windows, idempotent concurrency release          |

## State and async work

Every saved event must satisfy `StoredEventSchema`, including budget totals and task dates. Reducer actions operate on the current workspace; asynchronous file reads must not merge against an earlier captured event list. A failed mutation preserves existing events and any unreadable recovery data. Supplier quotes and actual spend remain independent.

Money must round-trip exactly through integer cents: tiny positive fractions must not become zero-budget events. Completed vendor checklist entries must be unique and belong to that vendor's checklist. Preserve these checks when evolving the backup format. TypeScript's checked indexed access requires missing rows to be handled explicitly; non-null assertions in fixture-based tests refer to known generated rows.

The planning hook permits one active generation, aborts it on unmount and releases its guard in `finally`. The HTTP service distinguishes cancellation from failure: cancelling never creates a fallback event. Timeouts produce a usable, honestly labeled local plan. Neither provider output nor HTTP error bodies are treated as executable content.

The editor uses a discriminated create/edit state and announces generation errors inside its modal. Settings also announces persistence failures within its dialog. Keep imported custom-priority choices visible for the lifetime of the editor so unchecking does not remove keyboard focus or prevent reconsideration. Form validation uses the same UTC day boundary as the API; display countdowns use local calendar days with UTC arithmetic to avoid daylight-saving drift.

## Checks before a change ships

Run `npm run format`, `npm run check` and `npm run test:e2e`. The browser suite retains all original workflows and adds invalid-field announcements, duplicate-submit protection, 320-pixel reflow, mobile route focus and WCAG 2.2 target-size checks. Changes must stay within the 120,000-byte JavaScript and 10,000-byte CSS gzip budgets. Coverage gates apply to business, server and browser data/service modules; browser tests verify rendered views and hooks.

CI uses a clean install, dependency auditing and CodeQL. Review security results as well as workflow completion; the security gate rejects open high or critical findings. Preserve the challenge's public repository, single `main` branch and size below 10 MB. Record actual verification results instead of predicting evaluator scores.
