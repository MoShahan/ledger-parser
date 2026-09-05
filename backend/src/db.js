import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import './env.js';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
