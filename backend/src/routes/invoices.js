import express from 'express';

import { query } from '../db.js';
import { applyUserEdits } from '../services/validate.js';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT i.*, d.filename
       FROM invoices i
       JOIN documents d ON d.id = i.document_id
       WHERE i.id = $1`,
      [req.params.id],
    );
    const invoice = result.rows[0];
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    res.json({
      ...invoice,
      previewUrl: `/api/documents/${invoice.document_id}/file`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load invoice.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    const invoice = result.rows[0];
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }

    const { fields, issues, invoiceStatus } = applyUserEdits(invoice.fields, req.body.fields || {});
    const updated = await query(
      `UPDATE invoices
       SET fields = $2::jsonb, issues = $3::jsonb, status = $4, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [invoice.id, JSON.stringify(fields), JSON.stringify(issues), invoiceStatus],
    );
    await query(`UPDATE jobs SET status = $2, updated_at = now() WHERE id = $1`, [
      invoice.job_id,
      invoiceStatus,
    ]);
    res.json({
      ...updated.rows[0],
      previewUrl: `/api/documents/${invoice.document_id}/file`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not save your edits.' });
  }
});

export default router;
