import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

pg.types.setTypeParser(1082, (v) => v); // DATE -> 'YYYY-MM-DD'
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT -> number

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://krconnect:krconnect@localhost:5432/krconnect',
  max: 10,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export const q = (text, params = []) => pool.query(text, params);
export const rows = async (text, params = []) => (await pool.query(text, params)).rows;
export const one = async (text, params = []) => (await pool.query(text, params)).rows[0] || null;

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function migrate() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
}

export async function bulkInsert(table, cols, data, client = pool, chunk = 400) {
  for (let i = 0; i < data.length; i += chunk) {
    const part = data.slice(i, i + chunk);
    const params = [];
    const values = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${values.join(',')}`, params);
  }
}
