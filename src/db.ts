import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  user: process.env.DB_USER || 'scheduler_user',
  password: process.env.DB_PASSWORD || 'scheduler_pass',
  database: process.env.DB_NAME || 'scheduler_db',
  max: 20,
  idleTimeoutMillis: 30000,
});