import { expect, test } from 'vitest';

import { formatWhen } from './formatWhen';

test('invalid dates are labeled unknown', () => {
  const when = formatWhen('not-a-date');
  expect(when.date).toBe('Unknown date');
  expect(when.time).toBe('');
});

test('valid timestamps have a date and a time', () => {
  const when = formatWhen('2026-09-05T12:00:00.000Z');
  expect(when.date.length).toBeGreaterThan(0);
  expect(when.time.length).toBeGreaterThan(0);
  expect(when.date).not.toBe('Unknown date');
});
