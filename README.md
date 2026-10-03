# Database-Backed Job Scheduling & Execution Engine

A scalable, brokerless background job scheduler and execution engine backed purely by PostgreSQL. This project implements transactional queue semantics, multi-tenant fair round-robin scheduling, atomic row leasing, distributed worker heartbeat monitoring, and automated crash recovery.

---

## 1. System Requirements
- **Docker & Docker Compose** (for PostgreSQL 16)
- **Node.js** (v18.x or v20.x+)
- **npm** (v9.x or v10.x+)
- **Bash / Git Bash** (to execute the demo shell script)

---

## 2. Quick Start & Verification Demo

The fastest way to test the system across all 5 evaluation scenarios is using the automated verification script:

```bash
# Clone the repository
git clone [https://github.com/](https://github.com/)<your-username>/db-job-scheduler.git
cd db-job-scheduler

# Run the full automated verification demo
bash demo.sh