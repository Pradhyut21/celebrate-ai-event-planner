# Contributing

Use Node.js 22.18 or newer and `npm ci`. Run `npm run dev`, then open the printed Vite address. Copy `.env.example` to `.env` only if enabling the optional AI provider; never commit keys or real event data.

Before committing, run `npm run typecheck`, `npm run lint`, `npm run test:coverage`, and `npm run build`. Install Chromium using `npx playwright install chromium` and run `npm run test:e2e`. Stage the intended source and run `npm run check:size`.

Keep business rules in `src/shared`, HTTP/provider code in `src/server`, and UI in `src/client`. Add behavior tests for changed logic and use semantic HTML with visible keyboard focus. Test both offline rules and provider failure paths. Describe the problem, resulting behavior, and validation in commits.

This challenge submission uses only `main`. Do not create additional repository branches or commit build output, recordings, dependencies, API keys, or personal data. Report vulnerabilities privately following `SECURITY.md`.
