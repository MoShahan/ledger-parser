import { expect, test } from 'vitest';

import { estimateProgress, progressLabel } from './progress';

test('starts at 1 percent', () => {
  expect(estimateProgress(undefined, 0)).toBe(1);
});

test('queued stays in the low teens', () => {
  expect(estimateProgress('queued', 0)).toBe(1);
  expect(estimateProgress('queued', 20_000)).toBe(13);
});

test('extracting climbs toward but not to 100', () => {
  const early = estimateProgress('extracting', 500);
  const late = estimateProgress('extracting', 60_000);
  expect(early).toBeGreaterThanOrEqual(14);
  expect(late).toBeLessThan(100);
  expect(late).toBe(92);
});

test('finished jobs are 100', () => {
  expect(estimateProgress('ready', 0)).toBe(100);
  expect(progressLabel(100)).toBe('Done');
});
