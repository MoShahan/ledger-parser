import { expect, test } from 'vitest';

import { errorMessage, fieldText } from './text';

test('reads Error messages', () => {
  expect(errorMessage(new Error('Upload failed'))).toBe('Upload failed');
});

test('falls back for unknown values', () => {
  expect(errorMessage('nope')).toBe('Something went wrong');
});

test('fieldText unwraps nested extract objects', () => {
  expect(fieldText({ value: { value: 'INV-1042', confidence: 0.9, sourceSnippet: 'x' } })).toBe(
    'INV-1042',
  );
});
