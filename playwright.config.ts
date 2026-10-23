import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    env: { PORT: '4173', HOST: '127.0.0.1', OPENAI_API_KEY: '', PLANNER_ACCESS_TOKEN: '', APP_ORIGIN: 'http://127.0.0.1:4173' },
    timeout: 30000,
  },
});
