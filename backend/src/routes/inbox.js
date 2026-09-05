import express from 'express';

import { query } from '../db.js';

const router = express.Router();

function leafText(value) {
  if (value && typeof value === 'object' && 'value' in value) return leafText(value.value);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function mapRow(row) {
  if (row.type === 'job') {
    return {
      type: 'job',
      id: row.id,
      jobId: row.job_id,
      status: 'failed',
      filename: row.filename,
      source: row.source,
      vendor: '',
      errorMessage: row.error_message,
      createdAt: row.created_at,
    };
  }
  return {
    type: 'invoice',
    id: row.id,
    jobId: row.job_id,
    status: row.status,
    filename: row.filename,
    source: row.source,
    vendor: leafText(row.fields?.vendor?.value),
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const count = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM invoices) +
         (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed') AS total`,
    );
    const total = count.rows[0]?.total || 0;

    const result = await query(
      `SELECT * FROM (
         SELECT i.id::text AS id,
                i.status,
                i.created_at,
                i.fields,
                d.filename,
                d.source,
                j.id::text AS job_id,
                NULL::text AS error_message,
                'invoice'::text AS type
         FROM invoices i
         JOIN documents d ON d.id = i.document_id
         JOIN jobs j ON j.id = i.job_id
         UNION ALL
         SELECT j.id::text,
                j.status,
                j.created_at,
                NULL::jsonb,
                d.filename,
                d.source,
                j.id::text,
                j.error_message,
                'job'::text
         FROM jobs j
         JOIN documents d ON d.id = j.document_id
         WHERE j.status = 'failed'
       ) AS inbox
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    res.json({
      items: result.rows.map(mapRow),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load inbox.' });
  }
});

export default router;
