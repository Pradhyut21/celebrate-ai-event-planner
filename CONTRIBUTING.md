# Contributing

Use Node.js 22.18 or newer and `npm ci`. Run `npm run dev`, then open the printed Vite address. Copy `.env.example` to `.env` only if enabling the optional AI provider; never commit keys or real event data.

Before committing, run `npm run format`, stage the intended source and run `npm run check`. This enforces strict types, type-aware lint, formatting, coverage gates, build, compressed-asset budgets and repository-size rules. Install Chromium using `npx playwright install chromium` and run `npm run test:e2e`. Avoid adding runtime dependencies for changes that standard browser/Node APIs can handle.

Keep business rules in `src/shared`, HTTP/provider code in `src/server`, and UI in `src/client`. Apply event changes through the workspace reducer and keep side effects in focused hooks/services. Add behavior tests for changed logic and use semantic HTML with visible keyboard focus. Test both offline rules and provider failure paths. Describe the problem, resulting behavior, and validation in commits. [Maintenance guidance](docs/MAINTENANCE.md) explains the module boundaries.

This challenge submission uses only `main`. Do not create additional repository branches or commit build output, recordings, dependencies, API keys, or personal data. Report vulnerabilities privately following `SECURITY.md`.
