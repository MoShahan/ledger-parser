import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyUserEdits, validate } from '../src/services/validate.js';

function field(value, extras = {}) {
  return {
    value,
    confidence: 0.9,
    sourceSnippet: '',
    status: 'trusted',
    sourceOfTruth: 'model',
    ...extras,
  };
}

function baseFields(overrides = {}) {
  return {
    vendor: field('Northline Supplies'),
    invoiceNumber: field('INV-1042'),
    invoiceDate: field('2026-03-12'),
    currency: field('USD'),
    subtotal: field('1284.60'),
    tax: field('0.00'),
    total: field('1284.60'),
    lineItems: field([
      { description: 'Copy paper', qty: 10, amount: '184.60' },
      { description: 'Toner cartridge', qty: 2, amount: '980.00' },
      { description: 'Freight', qty: 1, amount: '120.00' },
    ]),
    ...overrides,
  };
}

test('matching totals stay ready', () => {
  const result = validate(baseFields());
  assert.equal(result.invoiceStatus, 'ready');
  assert.equal(result.issues.length, 0);
});

test('line items vs total flags TOTAL_MISMATCH', () => {
  const result = validate(baseFields({ total: field('1184.60') }));
  assert.equal(result.invoiceStatus, 'needs_review');
  assert.equal(
    result.issues.some((issue) => issue.code === 'TOTAL_MISMATCH'),
    true,
  );
  assert.equal(result.fields.total.status, 'needs_review');
});

test('missing invoice number is flagged', () => {
  const result = validate(baseFields({ invoiceNumber: field('') }));
  assert.equal(
    result.issues.some((issue) => issue.code === 'MISSING_INVOICE_NUMBER'),
    true,
  );
});

test('bad date and currency are flagged', () => {
  const result = validate(
    baseFields({
      invoiceDate: field('not-a-date'),
      currency: field('dollars'),
    }),
  );
  assert.equal(
    result.issues.some((issue) => issue.code === 'BAD_DATE'),
    true,
  );
  assert.equal(
    result.issues.some((issue) => issue.code === 'BAD_CURRENCY'),
    true,
  );
});

test('user edit becomes source of truth and can clear a mismatch', () => {
  const broken = validate(baseFields({ total: field('1184.60') }));
  const fixed = applyUserEdits(broken.fields, { total: '1284.60' });
  assert.equal(fixed.fields.total.value, '1284.60');
  assert.equal(fixed.fields.total.sourceOfTruth, 'user');
  assert.equal(fixed.invoiceStatus, 'ready');
  assert.equal(
    fixed.issues.some((issue) => issue.code === 'TOTAL_MISMATCH'),
    false,
  );
});

test('confirming the same mismatched total still becomes ready', () => {
  const broken = validate(baseFields({ total: field('960.00') }));
  assert.equal(broken.invoiceStatus, 'needs_review');
  const confirmed = applyUserEdits(broken.fields, { total: '960.00' });
  assert.equal(confirmed.fields.total.value, '960.00');
  assert.equal(confirmed.fields.total.sourceOfTruth, 'user');
  assert.equal(confirmed.fields.total.status, 'trusted');
  assert.equal(confirmed.invoiceStatus, 'ready');
  assert.equal(
    confirmed.issues.some((issue) => issue.code === 'TOTAL_MISMATCH'),
    false,
  );
});
