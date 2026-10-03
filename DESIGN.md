# Architectural Design Document: Database-Backed Job Scheduling System

## 1. Overview & Technology Stack
- **Database:** PostgreSQL 16 — Chosen for ACID guarantees, row-level locking via `FOR UPDATE SKIP LOCKED`, partial indexing, and window functions.
- **Runtime:** Node.js (TypeScript) — Chosen for non-blocking asynchronous event loops, light memory usage, and concurrent timer management.
- **Constraints:** Zero external brokers (no Redis, RabbitMQ, SQS, Kafka, Celery). PostgreSQL handles state, coordination, and concurrency.

## 2. Core Architecture & Requirements Handling
- **Exactly-Once / At-Most-Once:** Consumers use an atomic CTE with `FOR UPDATE SKIP LOCKED`. PostgreSQL skips rows locked by peer transactions, preventing race conditions and duplicate executions.
- **Fault Tolerance & Crash Recovery:** Workers refresh `last_heartbeat = NOW()` every 2 seconds. A decentralized reaper identifies running jobs with stale heartbeats (> 6 seconds), resets them to `PENDING`, and increments `retry_count`.
- **Multi-Tenant Fairness:** The claim query partitions jobs via `ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY scheduled_at ASC)` to ensure fair round-robin scheduling across organizations without starvation.
- **Schedule Precision:** Polling runs at 500ms intervals filtering on `status = 'PENDING' AND scheduled_at <= NOW()`, backed by a partial index.

## 3. Scalability Analysis & Ceilings
- **1x - 10x:** Single PostgreSQL instance with partial index on `status = 'PENDING'`.
- **10x - 50x:** Add PgBouncer connection pooling and move completed jobs to a separate `jobs_history` archive table to prevent autovacuum table bloat.
- **100x+:** Horizontally shard PostgreSQL instances partitioned by tenant (`org_id` hash).

## 4. Future Improvements
1. Use PostgreSQL `LISTEN / NOTIFY` to wake workers instantly on job insert instead of polling.
2. Tenant-scoped idempotency keys to avoid duplicate side effects during retries.
3. Intra-tenant priority queues (P0, P1, P2).