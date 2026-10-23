import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/**/*.ts',
        'src/server/**/*.ts',
        'src/client/lib/**/*.ts',
        'src/client/services/**/*.ts',
      ],
      exclude: ['src/server/index.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 99, statements: 97, functions: 97, branches: 90 },
    },
  },
});
