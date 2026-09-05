import fs from 'node:fs/promises';

import { query } from '../db.js';

import { extractInvoiceFields } from './extract.js';
import { extractPdfText } from './pdfText.js';
import { validate } from './validate.js';

function publicError(err) {
  const map = {
    TIMEOUT: 'Extraction timed out. You can retry.',
    BAD_JSON: 'The extractor returned unreadable data. You can retry.',
    RATE_LIMIT: 'The extractor is rate-limited. Wait a moment and retry.',
    MODEL_OVERLOADED: 'Gemini is busy right now. Wait a few seconds and retry.',
    NO_API_KEY: 'The server is missing GEMINI_API_KEY.',
    MODEL_NOT_FOUND: 'Gemini model not found. Update GEMINI_MODEL.',
    EMPTY_TEXT: 'This PDF has no readable text. Digital PDFs only - not scans.',
    UNREADABLE: 'We could not read this PDF.',
  };
  return {
    code: err.code || 'EXTRACT_FAILED',
    message: map[err.code] || 'Extraction failed. You can retry.',
  };
}

export async function processJob(jobId) {
  console.log(`[job ${jobId}] start`);
  const jobRes = await query(
    `SELECT j.*, d.storage_path
     FROM jobs j
     JOIN documents d ON d.id = j.document_id
     WHERE j.id = $1`,
    [jobId],
  );
  const job = jobRes.rows[0];
  if (!job) {
    console.warn(`[job ${jobId}] not found`);
    return;
  }

  await query(`UPDATE jobs SET status = 'extracting', updated_at = now() WHERE id = $1`, [jobId]);
  console.log(`[job ${jobId}] extracting ${job.storage_path}`);

  try {
    const buffer = await fs.readFile(job.storage_path);
    console.log(`[job ${jobId}] read ${buffer.length} bytes`);

    let text;
    try {
      text = await extractPdfText(buffer);
    } catch (parseErr) {
      console.error(`[job ${jobId}] PDF text failed`, parseErr);
      const error = new Error('unreadable');
      error.code = 'UNREADABLE';
      throw error;
    }

    console.log(`[job ${jobId}] extracted ${text.length} chars of text`);
    if (!text) {
      const error = new Error('empty');
      error.code = 'EMPTY_TEXT';
      throw error;
    }

    const rawFields = await extractInvoiceFields(text);
    console.log(`[job ${jobId}] Gemini returned fields`, Object.keys(rawFields));
    const { fields, issues, invoiceStatus } = validate(rawFields);
    console.log(`[job ${jobId}] validated status=${invoiceStatus} issues=${issues.length}`);

    await query(
      `INSERT INTO invoices (document_id, job_id, status, fields, issues)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [job.document_id, jobId, invoiceStatus, JSON.stringify(fields), JSON.stringify(issues)],
    );

    await query(
      `UPDATE jobs SET status = $2, error_code = NULL, error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [jobId, invoiceStatus],
    );
    console.log(`[job ${jobId}] done ${invoiceStatus}`);
  } catch (err) {
    console.error(`[job ${jobId}] failed`, err.code || err.name, err.message, err);
    const { code, message } = publicError(err);
    await query(
      `UPDATE jobs
       SET status = 'failed', error_code = $2, error_message = $3, updated_at = now()
       WHERE id = $1`,
      [jobId, code, message],
    );
  }
}

export function enqueueJob(jobId) {
  setImmediate(() => {
    processJob(jobId).catch((err) => {
      console.error(`[job ${jobId}] unhandled`, err);
    });
  });
}
