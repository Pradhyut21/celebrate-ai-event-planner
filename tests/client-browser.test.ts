// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInitial } from '../src/client/lib/storage.js';
import {
  formatDate,
  futureDate,
  localDate,
  money,
  remainingDays,
} from '../src/client/lib/format.js';
import { download } from '../src/client/lib/download.js';
import { serializeBackup, STORAGE_KEY } from '../src/client/lib/data.js';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2030, 0, 10, 12));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('browser workspace recovery', () => {
  it('starts with an honestly labelled, usable sample when there is no saved workspace', () => {
    const initial = loadInitial();
    expect(initial.warning).toBe('');
    expect(initial.events).toHaveLength(1);
    expect(initial.events[0].id).toBe('sample-celebration');
    expect(initial.events[0].plan.generatedBy).toBe('rules');
    expect(initial.events[0].input.date).toBe(futureDate(150));
  });
  it('loads validated saved events and preserves an intentionally empty workspace', () => {
    const initial = loadInitial();
    localStorage.setItem(STORAGE_KEY, serializeBackup(initial.events));
    expect(loadInitial().events).toEqual(initial.events);
    localStorage.setItem(STORAGE_KEY, serializeBackup([]));
    expect(loadInitial()).toEqual({ events: [], warning: '' });
  });
  it('keeps corrupt source bytes intact and offers a sample with a recovery warning', () => {
    localStorage.setItem(STORAGE_KEY, '{broken JSON');
    const initial = loadInitial();
    expect(initial.warning).toContain('could not be loaded');
    expect(initial.events[0].id).toBe('sample-celebration');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken JSON');
  });
  it('remains usable when browser privacy settings deny storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError');
    });
    const initial = loadInitial();
    expect(initial.warning).toContain('could not be loaded');
    expect(initial.events[0].plan.tasks.length).toBeGreaterThan(0);
  });
});

describe('human-readable date and currency output', () => {
  it('uses local calendar dates with zero-padded months and days', () => {
    expect(localDate()).toBe('2030-01-10');
    expect(localDate(new Date(2032, 1, 29, 12))).toBe('2032-02-29');
    expect(futureDate(22)).toBe('2030-02-01');
  });
  it('keeps the date stable when formatting and supports compact task dates', () => {
    expect(formatDate('2030-06-01')).toBe('1 June 2030');
    expect(formatDate('2030-06-01', true)).toBe('1 Jun');
    expect(remainingDays('2030-01-12')).toBe(2);
    expect(remainingDays('2030-01-09')).toBe(-1);
    expect(remainingDays('2030-01-10')).toBe(0);
  });
  it('shows cents and currency symbols instead of silently rounding a financial amount', () => {
    expect(money(1234.56, 'INR')).toContain('1,234.56');
    expect(money(0.01, 'USD')).toContain('0.01');
    expect(money(-12.5, 'EUR')).toContain('12.5');
    expect(money(100, 'GBP')).toContain('100');
  });
});

describe('browser download lifecycle', () => {
  it('creates an attached download then revokes its temporary URL after the click', () => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('events.json');
      expect(this.href).toBe('blob:backup');
      expect(document.body.contains(this)).toBe(true);
    });
    download('{"version":1}', 'events.json', 'application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });
});
