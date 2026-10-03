import { JobWorker } from './worker.js';
import { Reaper } from './reaper.js';

const workerId = process.env.WORKER_ID || `worker-${Math.random().toString(36).substring(7)}`;
const concurrency = parseInt(process.env.CONCURRENCY || '2', 10);
const runReaper = process.env.RUN_REAPER === 'true';

const worker = new JobWorker(workerId, concurrency);
worker.start();

if (runReaper) {
  const reaper = new Reaper(6);
  reaper.start();
}

const shutdown = () => {
  worker.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);