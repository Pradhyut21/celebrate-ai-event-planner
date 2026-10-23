import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serializeBackup, STORAGE_KEY } from '../../src/client/lib/data.js';
import { savedEvent } from '../fixtures.js';

async function expectAccessible(page: Page, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  if (result.violations.length) {
    await test.info().attach(`${name}-accessibility`, {
      body: JSON.stringify(result.violations, null, 2),
      contentType: 'application/json',
    });
  }
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
}

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
  await dialog
    .getByLabel('Celebration style', { exact: true })
    .fill('A colourful, low-waste garden celebration');
  await dialog
    .getByLabel('Accessibility needs', { exact: true })
    .fill('Step-free access and quiet seating');
  await dialog.getByLabel('Dietary needs', { exact: true }).fill('Vegetarian; nut allergy');
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('invalid event details announce errors, focus the first invalid field, and allow correction', async ({
  page,
}) => {
  let planningRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/plan') planningRequests += 1;
  });
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  const name = dialog.getByLabel(/^Event name/);
  const location = dialog.getByLabel(/^Location/);
  const submit = dialog.getByRole('button', { name: 'Generate my plan', exact: true });

  await submit.click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toContainText('Review the highlighted fields');

  // Spaces satisfy native required validation but must fail the shared schema.
  await name.fill('   ');
  await location.fill('   ');
  await submit.click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAccessibleDescription('Give your celebration a name.');
  expect(planningRequests).toBe(0);

  await name.fill('Accessible celebration');
  await submit.click();
  await expect(location).toBeFocused();
  await expect(location).toHaveAccessibleDescription('Enter a location.');
  await location.fill('Step-free community hall');
  await submit.click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Accessible celebration', exact: true }),
  ).toBeVisible();
  expect(planningRequests).toBe(1);
});

test('creates a personal plan and preserves actual spend, task progress, and vendor details after reload', async ({
  page,
}) => {
  await createBirthday(page);

  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  const allocation = page.getByRole('spinbutton', { name: /^Allocation for / }).first();
  const adjustedAllocation =
    (Math.round(Number(await allocation.inputValue()) * 100) + 10001) / 100;
  await allocation.fill(String(adjustedAllocation));
  await allocation.blur();
  const actualSpend = page.getByRole('spinbutton', { name: /^Actual spend for / }).first();
  await actualSpend.fill('15000.25');
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
  await quote.fill('2400.75');
  await quote.blur();
  const vendorStatus = page.getByRole('combobox', { name: /^Status for / }).first();
  await vendorStatus.selectOption('contacted');
  await page.getByRole('checkbox').first().check();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Maya’s garden birthday', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vendors', exact: true }).click();
  await expect(page.getByRole('textbox', { name: vendorLabel! })).toHaveValue(
    'Neighbourhood kitchen',
  );
  await expect(page.getByRole('spinbutton', { name: /^Quote for / }).first()).toHaveValue(
    '2400.75',
  );
  await expect(page.getByRole('combobox', { name: /^Status for / }).first()).toHaveValue(
    'contacted',
  );
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: taskName!, exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Budget', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: /^Allocation for / }).first()).toHaveValue(
    String(adjustedAllocation),
  );
  await expect(page.getByRole('spinbutton', { name: /^Actual spend for / }).first()).toHaveValue(
    '15000.25',
  );
});

test('exports a backup, rejects an invalid import, and restores a valid backup', async ({
  page,
}) => {
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
  await importer.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1,"events":[{"name":"Invalid"}]}'),
  });
  await expect(page.getByRole('alert')).toContainText(/invalid|could not|failed/i);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Backup celebration', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await importer.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: backup,
  });
  await expect(page.getByRole('status')).toContainText(/import/i);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page
    .getByLabel('Switch event', { exact: true })
    .selectOption({ label: 'Backup celebration' });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Backup celebration', exact: true }),
  ).toBeVisible();
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

test('an invalid planning response falls back to an honestly labelled local plan', async ({
  page,
}) => {
  await page.route('**/api/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: { summary: 'Incomplete response' } }),
    }),
  );
  await createBirthday(page, 'Resilient celebration');
  await expect(page.getByRole('status')).toContainText(/local rules-based plan/i);
  await expect(
    page.getByText('Rules-based plan · no AI provider used', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resilient celebration', exact: true }),
  ).toBeVisible();
});

test('corrupted browser storage shows a recovery message and leaves planning usable', async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem('celebrate-ai.events.v1', '{broken JSON'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(/saved events could not be loaded/i);
  await expect(page.getByText('Sample event · explore freely', { exact: true })).toBeVisible();
  await createBirthday(page, 'Recovered workspace');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Recovered workspace', exact: true }),
  ).toBeVisible();
});

test('desktop planning views and dialogs have no WCAG A/AA automated violations', async ({
  page,
}) => {
  await expect(page.getByRole('main')).toBeVisible();
  await expectAccessible(page, 'desktop-overview');
  for (const section of ['Budget', 'Timeline', 'Vendors', 'Ideas & inspiration']) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectAccessible(page, `desktop-${section}`);
  }
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await expectAccessible(page, 'creation-dialog');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await expectAccessible(page, 'settings-dialog');
});

test('mobile layout supports keyboard navigation, modal focus, and accessibility checks', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to (main )?content/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle navigation', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Event name/)).toBeFocused();
  await expectAccessible(page, 'mobile-creation-dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation', exact: true })).toBeFocused();
  await expectAccessible(page, 'mobile-overview');
  for (const section of ['Budget', 'Timeline', 'Vendors', 'Ideas & inspiration']) {
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
    await page.getByRole('button', { name: section, exact: true }).click();
    await expect(page.getByRole('main')).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expectAccessible(page, `mobile-${section}`);
  }
});

test('small-screen views reflow at 320 pixels and retain usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.reload();
  for (const section of ['Overview', 'Budget', 'Timeline', 'Vendors', 'Ideas & inspiration']) {
    await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
    await page.getByRole('button', { name: section, exact: true }).click();
    await expect(page.getByRole('main')).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }
});

test('duplicate submissions share one in-flight generation and release the busy state', async ({
  page,
}) => {
  let requests = 0;
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/plan', async (route) => {
    requests += 1;
    await waiting;
    await route.continue();
  });
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await dialog.getByLabel(/^Event name/).fill('One generation');
  await dialog.getByLabel(/^Location/).fill('Community hall');
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Creating your plan…', exact: true }),
  ).toBeDisabled();
  await dialog.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => requests).toBe(1);
  release?.();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'One generation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate my plan', exact: true })).toBeEnabled();
});

test('generation failure is announced inside the active dialog and a corrected date can retry', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2030-01-01T23:59:00Z'));
  await page.route('**/api/plan', async (route) => {
    // The brief becomes past-dated while its request is in flight across UTC midnight.
    await page.clock.setFixedTime(new Date('2030-01-02T00:01:00Z'));
    await route.fulfill({ status: 503, json: { error: 'Unavailable' } });
  });
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create an event' });
  await dialog.getByLabel(/^Event name/).fill('Midnight celebration');
  await dialog.getByLabel(/^Location/).fill('Community hall');
  await dialog.getByLabel(/^Event date/).fill('2030-01-01');
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not create this plan');
  await expect(dialog.getByRole('button', { name: 'Generate my plan', exact: true })).toBeEnabled();
  await expect(dialog.getByLabel(/^Event name/)).toHaveValue('Midnight celebration');
  await expectAccessible(page, 'generation-failure-dialog');
  await dialog.getByLabel(/^Event date/).fill('2030-01-03');
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Midnight celebration', exact: true }),
  ).toBeVisible();
});

test('an imported custom priority stays visible and removable when editing', async ({ page }) => {
  const imported = savedEvent('custom-priorities');
  imported.input.priorities = ['Local artists', 'Food & drinks', 'Venue', 'Photography'];
  await page.evaluate(({ key, backup }) => localStorage.setItem(key, backup), {
    key: STORAGE_KEY,
    backup: serializeBackup([imported]),
  });
  await page.reload();
  await page.getByRole('button', { name: 'Edit event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit your event' });
  const customPriority = dialog.getByRole('checkbox', { name: 'Local artists', exact: true });
  await expect(customPriority).toBeChecked();
  await expect(customPriority).toBeEnabled();
  await customPriority.uncheck();
  await expect(customPriority).toBeVisible();
  await expect(customPriority).not.toBeChecked();
  await expect(customPriority).toBeEnabled();
  await customPriority.check();
  await expect(customPriority).toBeChecked();
  await customPriority.uncheck();
  await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const priorities = await page.evaluate((key) => {
    const backup = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      events: { input: { priorities: string[] } }[];
    };
    return backup.events[0]?.input.priorities;
  }, STORAGE_KEY);
  expect(priorities).toEqual(['Food & drinks', 'Venue', 'Photography']);
});

test('storage failures are announced inside Settings after an import', async ({ page }) => {
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings & backups' });
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    };
  });
  await dialog.getByLabel('Import events (JSON)', { exact: true }).setInputFiles({
    name: 'events.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBackup([savedEvent('imported')])),
  });
  await expect(dialog.getByRole('alert')).toContainText('could not save changes');
  await expectAccessible(page, 'storage-failure-settings');
});

test.describe('planning calendar in an American timezone', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('uses the same UTC date boundary as the API and local planning engine', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2030-01-02T01:00:00Z'));
    let requests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/plan') requests += 1;
    });
    await page.getByRole('button', { name: 'New event', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create an event' });
    await dialog.getByLabel(/^Event name/).fill('Calendar boundary');
    await dialog.getByLabel(/^Location/).fill('Community hall');
    const date = dialog.getByLabel(/^Event date/);
    await expect(date).toHaveAttribute('min', '2030-01-02');
    await date.fill('2030-01-01');
    // Exercise application validation as well as the native minimum-date constraint.
    await dialog
      .locator('form')
      .evaluate((form) =>
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
      );
    await expect(date).toBeFocused();
    await expect(date).toHaveAccessibleDescription(/Choose today or a future date using UTC\./);
    expect(requests).toBe(0);
    await date.fill('2030-01-02');
    await dialog.getByRole('button', { name: 'Generate my plan', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(requests).toBe(1);
  });
});
