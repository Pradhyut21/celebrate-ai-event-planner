import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts', 'src/server/app.ts', 'src/server/provider.ts', 'src/client/lib/**/*.ts'],
      exclude: ['src/server/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
