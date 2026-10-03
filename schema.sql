CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status job_status NOT NULL DEFAULT 'PENDING',
    scheduled_at TIMESTAMPTZ NOT NULL,
    locked_by VARCHAR(64),
    locked_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    max_retries INT NOT NULL DEFAULT 3,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for tenant-isolated fair queries and skip-locked scanning
CREATE INDEX IF NOT EXISTS idx_jobs_pending_tenant 
ON jobs (org_id, scheduled_at) 
WHERE status = 'PENDING';

-- Index for reaper process to detect dead heartbeats
CREATE INDEX IF NOT EXISTS idx_jobs_heartbeat 
ON jobs (last_heartbeat) 
WHERE status = 'RUNNING';