# Verification record

Verified on **23 October 2026** using Node.js **22.18.0**, npm **10.2.5**, and Windows. The GitHub Actions workflow repeats installation and checks on Ubuntu with Node 22; its badge links to the current remote result.

| Check                          | Observed result                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`            | Pass; strict TypeScript with checked indexed access and unused-code checks                                                                         |
| `npm run lint`                 | Pass; zero warnings, React hooks and JSX accessibility rules included                                                                              |
| `npm run test:coverage`        | 157 tests passed across ten test files                                                                                                             |
| Coverage                       | Statements 99.41%; branches 95.71%; functions 99.19%; lines 100%                                                                                   |
| `npm run build`                | Pass; Vite browser bundle plus compiled Node server                                                                                                |
| `npm run test:e2e`             | All fourteen Chromium browser tests passed                                                                                                         |
| Accessibility scans            | Zero axe WCAG A/AA violations on the tested five planning views at desktop/mobile widths, desktop Create/Settings dialogs and mobile Create dialog |
| Keyboard/layout                | Skip link, main focus, navigation Escape, dialog focus/return and mobile page overflow checks passed                                               |
| `npm audit --audit-level=high` | Zero known vulnerabilities reported across installed dependencies                                                                                  |
| Development startup            | `npm run dev`: browser entry and API health both returned HTTP 200                                                                                 |
| Production startup             | `npm start`: built interface and API exercised by browser suite                                                                                    |
| `npm run check:size`           | Passed; tracked source below 1 MB, one local branch named `main`, generated folders excluded and no recognized secret patterns                     |
| GitHub visibility/branches     | Anonymous repository API reports public visibility and only `main`                                                                                 |

Coverage includes shared business logic/templates, all server policy/HTTP/provider modules and browser data/service modules. React views and side-effect hooks are exercised by browser tests, rather than included in this unit percentage. Gates now require 99% lines, 97% statements/functions and 90% branches.

Type-aware lint additionally checks promise handling and type imports, Prettier enforces consistent formatting, and compressed transfer budgets enforce JavaScript below 120,000 bytes and CSS below 10,000 bytes. Browser checks include WCAG 2.2 target size, 320-pixel reflow, invalid-field announcements/focus, mobile route focus and duplicate-submit/busy-state behavior. No runtime dependencies were added in this refactor.

The production browser assets are approximately **117.0 kB JavaScript** and **8.15 kB CSS**, gzip compressed. `docs/preview.png` is a genuine application capture, 170,155 bytes. No dependencies, builds, recordings, coverage output or browser binaries are tracked in Git.

## Scenarios verified

- Exact-cent allocations, including one-cent and large budgets; initial reserve and priority weighting; distinct logic for weddings, birthdays and community gatherings.
- Same-day and compressed schedules; invalid/past dates; access, dietary, outdoor and sustainability context.
- Malformed, unknown-field, oversized, compressed and unsupported HTTP requests; exact origins; token protection before provider calls; spoof-resistant address limits; expiration, storage and concurrency bounds; safe errors.
- Static pages and assets have a separate rate budget; exhausted page requests retain security headers while health checks and planning remain available.
- Provider success, refusal, incomplete output, malformed JSON, invalid fields, oversized responses, timeout and prompt-injection-shaped user notes. Trusted finances/tasks remain unchanged.
- Saved actual spend, rebalanced allocations, cent precision, timeline progress, vendor names/quotes/status/checklist completion and selected event across reloads.
- JSON backup round trip, invalid imports, corrupted storage recovery, spreadsheet formula neutralization and hostile-looking text rendered safely.
- Transparent browser-local fallback after an invalid API response.
- Positive sub-cent amounts rejected; CSV balances use exact cent subtraction; vendor checklist progress rejects duplicates and unrelated entries.
- Consecutive vendor checklist edits preserve each other; imported custom priorities remain visible, keyboard accessible and removable when editing.
- Daylight-saving countdowns and the UTC form/API date boundary; an event crossing midnight during generation can recover and retry with its error announced inside the dialog.
- Storage quota failure after import is announced inside Settings while current in-memory planning remains usable.

## Limits of this verification

Provider requests are mocked in automated tests. A live paid OpenAI call was not made because no provider credential was supplied. Real AI is implemented through the documented Responses API and can be enabled through server environment settings; account/model availability must be checked when deploying.

Chromium is the tested browser. Firefox, Safari, real assistive-technology sessions and all possible user environments have not been verified. Automated accessibility checks are not a WCAG conformance certification. Dependency audits and CodeQL are useful checks, not proof that the application is vulnerability-free.

See the current [quality workflow](https://github.com/Pradhyut21/celebrate-ai-event-planner/actions/workflows/ci.yml) and [CodeQL workflow](https://github.com/Pradhyut21/celebrate-ai-event-planner/actions/workflows/codeql.yml) for remote logs and artifacts. The competition submission itself is performed separately by submitting the public repository URL; no platform attempt is consumed by committing this source.
