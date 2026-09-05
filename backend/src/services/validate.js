export function parseMoney(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function flag(fields, issues, key, code, message) {
  if (fields[key]) {
    fields[key] = { ...fields[key], status: 'needs_review' };
  }
  issues.push({ code, message, field: key });
}

export function validate(inputFields) {
  const fields = structuredClone(inputFields);
  const issues = [];

  if (!fields.invoiceNumber?.value || !String(fields.invoiceNumber.value).trim()) {
    flag(fields, issues, 'invoiceNumber', 'MISSING_INVOICE_NUMBER', 'Invoice number is missing.');
  }

  const date = fields.invoiceDate?.value;
  if (!date || Number.isNaN(Date.parse(date))) {
    flag(fields, issues, 'invoiceDate', 'BAD_DATE', 'Invoice date is missing or unparseable.');
  }

  const currency = fields.currency?.value;
  if (!currency || !/^[A-Z]{3}$/.test(String(currency).trim())) {
    flag(fields, issues, 'currency', 'BAD_CURRENCY', 'Currency is missing or not a 3-letter code.');
  }

  const lines = Array.isArray(fields.lineItems?.value) ? fields.lineItems.value : [];
  const sum = lines.reduce((acc, line) => acc + (parseMoney(line?.amount) || 0), 0);
  const total = parseMoney(fields.total?.value);

  if (total == null) {
    flag(fields, issues, 'total', 'BAD_TOTAL', 'Total is missing or unparseable.');
  } else if (Math.abs(sum - total) > 0.01) {
    flag(
      fields,
      issues,
      'total',
      'TOTAL_MISMATCH',
      `Line items sum to ${sum.toFixed(2)} but total is ${total.toFixed(2)}.`,
    );
  }

  const anyReview = Object.values(fields).some((field) => field && field.status === 'needs_review');
  const invoiceStatus = issues.length || anyReview ? 'needs_review' : 'ready';

  return { fields, issues, invoiceStatus };
}

export function applyUserEdits(fields, edits) {
  const next = structuredClone(fields);

  for (const [key, value] of Object.entries(edits || {})) {
    if (!next[key]) continue;
    next[key] = {
      ...next[key],
      value,
      sourceOfTruth: 'user',
      status: 'trusted',
    };
  }

  return validate(next);
}
