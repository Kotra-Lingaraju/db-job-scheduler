# Database-Backed Job Scheduling & Execution Engine

A scalable job scheduler without external message brokers, using PostgreSQL ACID transactions and `FOR UPDATE SKIP LOCKED`.

## Setup & Running

### Requirements
- Docker & Docker Compose
- Node.js (v18+)

### Quick Start
1. Install dependencies:
   ```bash
   npm install