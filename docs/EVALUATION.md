# Evaluation evidence

This index maps the challenge requirements to implementation and verification. It is a navigation guide, not a claim of a particular score or rank.

| Criterion     | Source evidence                                                                                                                                                                        | Verification                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code quality  | Strict TypeScript, shared Zod domain contracts, pure planner, separate provider/HTTP/client layers, pinned dependency lockfile.                                                        | `npm run typecheck`; `npm run lint`; documented architecture and setup.                                                                                 |
| Security      | Server-only provider key, strict validation, body/output bounds, origin checks, access-token protection, bounded rate/concurrency controls, safe text rendering and import validation. | API/provider negative tests, browser markup-injection regression, `npm audit`, CodeQL. See threat model for precise limits.                             |
| Efficiency    | Fixed-size templates, exact cent allocation, bounded provider requests, no server event database, no AI request on each checkbox/spend edit, minimal static assets.                    | Planner boundary tests, request-limit tests, Vite production bundle output, repository-size gate.                                                       |
| Testing       | Deterministic unit tests; mocked provider success/refusal/error tests; real HTTP integration tests; production browser workflows.                                                      | `npm run test:coverage`, `npm run build`, `npm run test:e2e`, CI artifacts.                                                                             |
| Accessibility | Landmarks, skip link, labels, keyboard focus, dialogs, live messages, mobile layout and reduced-motion support.                                                                        | ESLint JSX accessibility checks, axe WCAG A/AA scans, keyboard and focus assertions in Playwright. Manual screen-reader review remains a separate task. |
| Alignment     | Weddings, birthdays and community events; budget, timeline, vendors and personalized ideas; actual-cost and progress tracking.                                                         | Full browser workflow and domain tests for every event type and contextual rules.                                                                       |

## High-value organizer scenarios

Maintainability checks include a pure workspace reducer, focused side-effect hooks, a validated request service, immutable event templates and separate server configuration/security/resource modules. Type-aware lint rejects floating or misused promises; Prettier enforces a consistent style. `npm run check:bundle` protects JavaScript/CSS transfer budgets. Form error focus, screen-reader descriptions, mobile route focus, 320-pixel reflow and WCAG 2.2 target size are covered in browser regressions. See [maintenance guidance](MAINTENANCE.md).

The planner separates budget, schedule, ideas and warnings into private functions with named policies. Client budget arithmetic, CSV generation and typed plan editors are independently tested. Checked indexed access catches missing-row assumptions. Regression tests cover queued checklist edits, positive sub-cent budgets, daylight-saving transitions, custom-priority editing, and generation/storage failures announced inside active dialogs. Provider failures cancel streamed bodies and release their request deadline.

1. **Wedding:** prioritize food and photography, request access support, and create a budget whose allocations exactly match the total. See ceremony and RSVP tasks and track supplier confirmations.
2. **Birthday:** specify an outdoor location, dietary needs and a personal style. See weather-backup/dietary tasks and inclusive ideas; enter actual spending and detect overspend.
3. **Community event:** plan a large gathering with volunteer and safety priorities. See permit/capacity checks, outreach and volunteer coordination; use the print view for the organizing team.
4. **Short notice:** choose an event within 30 days. Old milestones move to today and a warning identifies the compressed schedule.
5. **Unavailable AI:** run without a key or simulate a provider failure. The complete planner remains usable and clearly identifies rules-based output.
6. **Portable progress:** complete tasks, update a supplier, export JSON and reimport a valid backup. Reject malformed or inconsistent imports without replacing the existing plan.

## Rules enforced outside application behavior

The public repository must remain publicly readable, below 10 MB, and contain only `main`. `npm run check:size` enforces the local tracked-source budget, branch count, excluded generated folders and recognized accidental-secret patterns. The final verification record includes anonymous GitHub visibility and remote branch checks. This helper is a guardrail, not a comprehensive secret scanner.

The platform allows a maximum of three submission attempts. Creating or pushing this repository does not submit it to the competition platform. Submit the repository URL deliberately; do not waste attempts on private links or stale code.
