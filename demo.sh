#!/usr/bin/env bash
set -e

echo "=== [1/5] Booting PostgreSQL ==="
docker compose down -v > /dev/null 2>&1 || true
docker compose up -d db

echo "Waiting for PostgreSQL to be ready..."
until docker exec scheduler_db pg_isready -U scheduler_user -d scheduler_db > /dev/null 2>&1; do
  sleep 1
done

echo "=== [2/5] Building Project & Seeding 55 Jobs ==="
npm run build
npm run seed

echo "=== [3/5] Starting 2 Concurrent Consumer Processes ==="
# Both consumers run the reaper so crash recovery is decentralized
WORKER_ID=consumer-1 CONCURRENCY=2 RUN_REAPER=true node dist/index.js > consumer-1.log 2>&1 &
PID_C1=$!

WORKER_ID=consumer-2 CONCURRENCY=2 RUN_REAPER=true node dist/index.js > consumer-2.log 2>&1 &
PID_C2=$!

echo "Started Consumer 1 (PID: $PID_C1)"
echo "Started Consumer 2 (PID: $PID_C2)"
echo "Processing jobs..."

sleep 3

echo "=== [4/5] Simulating Hard Crash: Sending SIGKILL (-9) to Consumer 1 ==="
kill -9 $PID_C1 || true
echo "Consumer 1 killed. Waiting for Consumer 2's Reaper to reclaim and execute..."

# Wait for: Heartbeat timeout (6s) + Future jobs due (+8s) + Execution
sleep 13

kill -15 $PID_C2 || true
wait $PID_C2 2>/dev/null || true

echo "=== [5/5] Final Verification of Database State ==="
docker exec -i scheduler_db psql -U scheduler_user -d scheduler_db -c "
SELECT status, count(*) AS count FROM jobs GROUP BY status;
"

echo "Checking for orphaned or duplicate unhandled jobs:"
docker exec -i scheduler_db psql -U scheduler_user -d scheduler_db -c "
SELECT COUNT(*) AS stranded_jobs FROM jobs WHERE status NOT IN ('COMPLETED', 'FAILED');
"

echo "Demo complete! Check consumer-1.log and consumer-2.log for detailed execution traces."