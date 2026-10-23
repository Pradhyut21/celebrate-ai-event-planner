import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function createBirthday(page: Page, name = 'Maya’s garden birthday') {
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Event name/).fill(name);
  await dialog.getByRole('combobox', { name: 'Event type', exact: true }).selectOption('birthday');
  const eventDate = new Date();
  eventDate.setUTCFullYear(eventDate.getUTCFullYear() + 1);
  await dialog.getByLabel(/^Event date/).fill(eventDate.toISOString().slice(0, 10));
  await dialog.getByLabel(/^Location/).fill('Community garden');
  await dialog.getByLabel(/^Total budget/).fill('12000');
  await dialog.getByLabel(/^Guest count/).fill('24');
  await dialog.getByLabel('Celebration style', { exact: true }).fill('A colourful, low-waste garden celebration');
  await dialog.getByLabel('Accessibility needs', { exact: true }).fill('Step-free access and quiet seating');
  await dialog.getByLabel('Dietary needs', { exact: true }).fill('Vegetarian; nut allergy');
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('creates a personal plan and preserves actual spend, task progress, and vendor details after reload', async ({ page }) => {
  await createBirthday(page);

  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  const actualSpend = page.getByRole('spinbutton', { name: /^Actual spend for / }).first();
  await actualSpend.fill('15000');
  await actualSpend.blur();
  await expect(page.getByText(/over budget|overspend/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  const firstTask = page.getByRole('checkbox').first();
  const taskName = await firstTask.getAttribute('aria-label');
  expect(taskName).toBeTruthy();
  await firstTask.check();

  await page.getByRole('button', { name: 'Vendors', exact: true }).click();
  const vendorName = page.getByRole('textbox', { name: /^Vendor name for / }).first();
  const vendorLabel = await vendorName.getAttribute('aria-label');
  expect(vendorLabel).toBeTruthy();
  await vendorName.fill('Neighbourhood kitchen');
  await vendorName.blur();
  const quote = page.getByRole('spinbutton', { name: /^Quote for / }).first();
  await quote.fill('2400');
  await quote.blur();
  const vendorStatus = page.getByRole('combobox', { name: /^Status for / }).first();
  await vendorStatus.selectOption('contacted');
  await page.getByRole('checkbox').first().check();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Maya’s garden birthday', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vendors', exact: true }).click();
  await expect(page.getByRole('textbox', { name: vendorLabel! })).toHaveValue('Neighbourhood kitchen');
  await expect(page.getByRole('spinbutton', { name: /^Quote for / }).first()).toHaveValue('2400');
  await expect(page.getByRole('combobox', { name: /^Status for / }).first()).toHaveValue('contacted');
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: taskName!, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: /^Actual spend for / }).first()).toHaveValue('15000');
});

test('exports a backup, rejects an invalid import, and restores a valid backup', async ({ page }) => {
  await createBirthday(page, 'Backup celebration');
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all events (JSON)', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const stream = await download.createReadStream();
  if (!stream) throw new Error('The backup download did not contain a readable file.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  const decoded = JSON.parse(backup.toString('utf8')) as { version: number; events: unknown[] };
  expect(decoded.version).toBe(1);
  expect(decoded.events).toHaveLength(2);
  expect(backup.toString('utf8')).toContain('Backup celebration');

  const importer = page.getByLabel('Import events (JSON)', { exact: true });
  await importer.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"events":[{"name":"Invalid"}]}') });
  await expect(page.getByRole('alert')).toContainText(/invalid|could not|failed/i);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup celebration', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await importer.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByRole('status')).toContainText(/import/i);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByLabel('Switch event', { exact: true }).selectOption({ label: 'Backup celebration' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Backup celebration', exact: true })).toBeVisible();
});

test('event names render as text and never execute as markup', async ({ page }) => {
  const hostileName = '<img src=x onerror=alert(1)>';
  let dialogOpened = false;
  page.on('dialog', async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
  });
  await createBirthday(page, hostileName);
  await page.reload();
  await expect(page.getByRole('heading', { name: hostileName, exact: true })).toBeVisible();
  expect(dialogOpened).toBe(false);
  await expect(page.locator('img[onerror]')).toHaveCount(0);
});

test('an invalid planning response falls back to an honestly labelled local plan', async ({ page }) => {
  await page.route('**/api/plan', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ plan: { summary: 'Incomplete response' } }),
  }));
  await createBirthday(page, 'Resilient celebration');
  await expect(page.getByRole('status')).toContainText(/local rules-based plan/i);
  await expect(page.getByText('Rules-based plan · no AI provider used', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resilient celebration', exact: true })).toBeVisible();
});

test('corrupted browser storage shows a recovery message and leaves planning usable', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('celebrate-ai.events.v1', '{broken JSON'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(/saved events could not be loaded/i);
  await expect(page.getByText('Sample event · explore freely', { exact: true })).toBeVisible();
  await createBirthday(page, 'Recovered workspace');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recovered workspace', exact: true })).toBeVisible();
});

test('desktop overview and creation dialog have no WCAG A/AA automated violations', async ({ page }) => {
  await expect(page.getByRole('main')).toBeVisible();
  const overview = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(overview.violations).toEqual([]);
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(dialog.violations).toEqual([]);
});

test('mobile layout supports keyboard navigation, modal focus, and accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to (main )?content/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Event name/)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation', exact: true })).toBeFocused();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});
