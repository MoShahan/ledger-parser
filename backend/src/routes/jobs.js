import express from 'express';

import { query } from '../db.js';
import { enqueueJob } from '../services/processJob.js';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    const job = result.rows[0];
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    const invoice = await query('SELECT id FROM invoices WHERE job_id = $1', [job.id]);
    res.json({
      ...job,
      invoiceId: invoice.rows[0]?.id || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load job.' });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const result = await query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    const job = result.rows[0];
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }
    await query('DELETE FROM invoices WHERE job_id = $1', [job.id]);
    await query(
      `UPDATE jobs
       SET status = 'queued', error_code = NULL, error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [job.id],
    );
    enqueueJob(job.id);
    res.json({ id: job.id, status: 'queued' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not retry.' });
  }
});

export default router;
