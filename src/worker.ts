import { pool } from './db.js';

export interface Job {
  id: string;
  org_id: string;
  payload: { duration_ms?: number; task_name?: string };
  scheduled_at: Date;
  retry_count: number;
}

export class JobWorker {
  private workerId: string;
  private isRunning: boolean = false;
  private concurrency: number;
  private activeJobs: Set<string> = new Set();

  constructor(workerId: string, concurrency: number = 3) {
    this.workerId = workerId;
    this.concurrency = concurrency;
  }

  public async start() {
    this.isRunning = true;
    console.log(`[Worker ${this.workerId}] Started with concurrency limit ${this.concurrency}`);

    while (this.isRunning) {
      try {
        const availableSlots = this.concurrency - this.activeJobs.size;
        if (availableSlots > 0) {
          const jobs = await this.claimJobs(availableSlots);
          for (const job of jobs) {
            this.activeJobs.add(job.id);
            this.executeJob(job);
          }
        }
      } catch (err) {
        console.error(`[Worker ${this.workerId}] Error in claim loop:`, err);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  public stop() {
    this.isRunning = false;
    console.log(`[Worker ${this.workerId}] Stopping...`);
  }

  private async claimJobs(batchSize: number): Promise<Job[]> {
    const client = await pool.connect();
    try {
      const claimQuery = `
        WITH eligible_jobs AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY org_id 
                   ORDER BY scheduled_at ASC
                 ) as tenant_rank
          FROM jobs
          WHERE status = 'PENDING'
            AND scheduled_at <= NOW()
          ORDER BY scheduled_at ASC
          LIMIT 100
        ),
        fair_selection AS (
          SELECT j.id
          FROM jobs j
          JOIN eligible_jobs ej ON j.id = ej.id
          ORDER BY ej.tenant_rank ASC, j.scheduled_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE jobs
        SET status = 'RUNNING',
            locked_by = $2,
            locked_at = NOW(),
            last_heartbeat = NOW(),
            updated_at = NOW()
        FROM fair_selection
        WHERE jobs.id = fair_selection.id
        RETURNING jobs.id, jobs.org_id, jobs.payload, jobs.scheduled_at, jobs.retry_count;
      `;

      const result = await client.query(claimQuery, [batchSize, this.workerId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private async executeJob(job: Job) {
    const duration = job.payload?.duration_ms || 200;
    console.log(`[Worker ${this.workerId}] Executing Job ${job.id} (Org: ${job.org_id}, Duration: ${duration}ms, Retries: ${job.retry_count})`);

    const heartbeatTimer = setInterval(async () => {
      try {
        await pool.query(
          `UPDATE jobs SET last_heartbeat = NOW() WHERE id = $1 AND status = 'RUNNING'`,
          [job.id]
        );
      } catch (e) {
        console.error(`[Worker ${this.workerId}] Heartbeat failed:`, e);
      }
    }, 2000);

    try {
      await new Promise((resolve) => setTimeout(resolve, duration));

      await pool.query(
        `UPDATE jobs 
         SET status = 'COMPLETED', updated_at = NOW() 
         WHERE id = $1 AND status = 'RUNNING'`,
        [job.id]
      );
      console.log(`[Worker ${this.workerId}] Completed Job ${job.id}`);
    } catch (err) {
      console.error(`[Worker ${this.workerId}] Job failed: ${job.id}`, err);
      await pool.query(
        `UPDATE jobs SET status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [job.id]
      );
    } finally {
      clearInterval(heartbeatTimer);
      this.activeJobs.delete(job.id);
    }
  }
}