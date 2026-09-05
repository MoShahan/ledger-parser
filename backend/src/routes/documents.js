import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import multer from 'multer';

import { query } from '../db.js';
import { repoRoot } from '../env.js';
import { SAMPLE_KEYS } from '../samples.js';
import { enqueueJob } from '../services/processJob.js';

const router = express.Router();
const sampleDir = path.join(repoRoot, 'sample-docs');

const maxMb = Number(process.env.MAX_UPLOAD_MB || 10);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(repoRoot, 'uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(Object.assign(new Error('Only PDF files are accepted.'), { code: 'BAD_TYPE' }));
      return;
    }
    cb(null, true);
  },
});

async function createDocumentJob({ filename, storagePath, source }) {
  const doc = await query(
    `INSERT INTO documents (filename, storage_path, source)
     VALUES ($1, $2, $3) RETURNING *`,
    [filename, storagePath, source],
  );
  const job = await query(
    `INSERT INTO jobs (document_id, status) VALUES ($1, 'queued') RETURNING *`,
    [doc.rows[0].id],
  );
  console.log(`[upload] ${source} ${filename} -> job ${job.rows[0].id}`);
  enqueueJob(job.rows[0].id);
  return { document: doc.rows[0], job: job.rows[0] };
}

router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: `File is too large. Max ${maxMb}MB.`,
        });
        return;
      }
      if (err.code === 'BAD_TYPE') {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Upload failed.' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Choose a PDF to upload.' });
      return;
    }
    try {
      const result = await createDocumentJob({
        filename: req.file.originalname,
        storagePath: req.file.path,
        source: 'upload',
      });
      res.status(201).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Could not start extraction.' });
    }
  });
});

router.post('/samples/:key', async (req, res) => {
  const { key } = req.params;
  if (!SAMPLE_KEYS.includes(key)) {
    res.status(404).json({ error: 'Unknown sample.' });
    return;
  }

  const src = path.join(sampleDir, `${key}.pdf`);
  if (!fs.existsSync(src)) {
    res.status(500).json({ error: 'Sample PDF is missing from the repo.' });
    return;
  }

  try {
    const dest = path.join(uploadDir, `${key}-${Date.now()}.pdf`);
    fs.copyFileSync(src, dest);
    const result = await createDocumentJob({
      filename: `${key}.pdf`,
      storagePath: dest,
      source: 'sample',
    });
    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not start the sample.' });
  }
});

router.get('/:id/file', async (req, res) => {
  try {
    const result = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    const doc = result.rows[0];
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(path.resolve(doc.storage_path));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load the PDF.' });
  }
});

export default router;
