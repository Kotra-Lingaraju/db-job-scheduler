import { pool } from './db.js';

export class Reaper {
  private timeoutSeconds: number;
  private isRunning: boolean = false;

  constructor(timeoutSeconds: number = 6) {
    this.timeoutSeconds = timeoutSeconds;
  }

  public async start() {
    this.isRunning = true;
    console.log(`[Reaper] Service started (Stale threshold: ${this.timeoutSeconds}s)`);

    while (this.isRunning) {
      try {
        await this.reapDeadJobs();
      } catch (err) {
        console.error('[Reaper] Error checking jobs:', err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async reapDeadJobs() {
    const query = `
      UPDATE jobs
      SET status = CASE 
            WHEN retry_count + 1 >= max_retries THEN 'FAILED'::job_status 
            ELSE 'PENDING'::job_status 
          END,
          retry_count = retry_count + 1,
          locked_by = NULL,
          locked_at = NULL,
          last_heartbeat = NULL,
          updated_at = NOW()
      WHERE status = 'RUNNING'
        AND last_heartbeat < NOW() - ($1 || ' seconds')::INTERVAL
      RETURNING id, org_id, retry_count, status;
    `;

    const res = await pool.query(query, [this.timeoutSeconds]);
    for (const job of res.rows) {
      console.warn(`[Reaper] RECLAIMED abandoned Job ${job.id} (Org: ${job.org_id}) -> Reset to ${job.status}`);
    }
  }
}