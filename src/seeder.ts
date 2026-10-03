import { pool } from './db.js';

async function seed() {
  console.log('Clearing database and enqueuing test jobs...');
  await pool.query('TRUNCATE TABLE jobs;');

  const jobs = [];

  // Org A: 45 Rapid short jobs
  for (let i = 1; i <= 45; i++) {
    jobs.push({
      org_id: 'org_alpha',
      payload: JSON.stringify({ task_name: `Alpha Job #${i}`, duration_ms: 100 }),
      scheduled_at: new Date(Date.now() - 5000),
    });
  }

  // Org B: 5 Heavy jobs
  for (let i = 1; i <= 5; i++) {
    jobs.push({
      org_id: 'org_beta',
      payload: JSON.stringify({ task_name: `Beta Heavy Job #${i}`, duration_ms: 1200 }),
      scheduled_at: new Date(Date.now() - 5000),
    });
  }

  // Org C: 5 Future scheduled jobs
  for (let i = 1; i <= 5; i++) {
    jobs.push({
      org_id: 'org_gamma',
      payload: JSON.stringify({ task_name: `Gamma Future Job #${i}`, duration_ms: 150 }),
      scheduled_at: new Date(Date.now() + 8000),
    });
  }

  for (const job of jobs) {
    await pool.query(
      `INSERT INTO jobs (org_id, payload, scheduled_at) VALUES ($1, $2, $3)`,
      [job.org_id, job.payload, job.scheduled_at]
    );
  }

  console.log(`Enqueued ${jobs.length} jobs across 3 organizations.`);
  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});