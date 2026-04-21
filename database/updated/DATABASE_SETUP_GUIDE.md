# Database Setup Guide - Orderly Hub

## Quick Start

### Prerequisites
- PostgreSQL 14 or higher installed
- User with CREATE DATABASE privileges
- `psql` command-line tool available

### Step 1: Create Database
```bash
# Connect to PostgreSQL as admin
psql -U postgres

# Create the database
CREATE DATABASE orderly_hub;

# Exit psql
\q
```

### Step 2: Run Initialization Script
```bash
# Navigate to project directory
cd c:\Users\rafae\OneDrive\Documentos\vscode\CITi\Lucky\ Store\orderly-hub-bd02965b

# Run the initialization script
psql -U postgres -d orderly_hub -f DATABASE_INIT.sql

# You should see:
# CREATE EXTENSION
# CREATE TABLE
# CREATE INDEX
# ... (many more)
# INSERT 0 1
```

### Step 3: Verify Installation
```bash
# Connect to database
psql -U postgres -d orderly_hub

# List all tables
\dt

# You should see:
#  Schema |        Name         | Type  | Owner
# --------+---------------------+-------+----------
#  public | users               | table | postgres
#  public | lojas               | table | postgres
#  public | vendedores          | table | postgres
#  ... etc

# List all views
\dv

# You should see:
#  Schema |      Name       | Type | Owner
# --------+-----------------+------+----------
#  public | resultado_mensal | view | postgres
#  public | resultado_anual  | view | postgres

# Exit
\q
```

---

## Verification Checklist

### ✅ Phase 1: Core Tables (15 main tables)
```sql
-- Run this query to verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected tables:
- [ ] users
- [ ] lojas
- [ ] vendedores
- [ ] clientes
- [ ] pedidos
- [ ] pedido_forma_pagamento
- [ ] produtos
- [ ] custo_pedido
- [ ] frete
- [ ] rmas
- [ ] item_rma
- [ ] cotacoes
- [ ] item_cotacao
- [ ] venda_vendedor
- [ ] compra_vendedor
- [ ] meta_vendedor

### ✅ Phase 2: Audit & Compliance Tables (2 new tables)
```sql
-- Verify audit tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('status_history', 'audit_logs');
```

Expected:
- [ ] status_history (tracks all status changes)
- [ ] audit_logs (tracks all data changes with JSONB)

### ✅ Phase 3: Views (2 materialized views for reporting)
```sql
-- Verify views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected:
- [ ] resultado_mensal (monthly results)
- [ ] resultado_anual (annual results)

### ✅ Phase 4: UUID Primary Keys (All tables)
```sql
-- Verify all main tables use UUID
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND column_name = 'id'
AND data_type = 'uuid'
ORDER BY table_name;
```

Expected: 16 rows (all tables should have UUID as 'id')

### ✅ Phase 5: Audit Fields (On all main tables)
```sql
-- Verify audit fields exist
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('created_by', 'created_at', 'updated_at', 'deleted_at')
GROUP BY table_name
HAVING COUNT(*) >= 2
ORDER BY table_name;
```

Expected tables with audit fields:
- users, lojas, vendedores, clientes, pedidos, rmas, cotacoes, status_history, audit_logs

### ✅ Phase 6: Soft Deletes (deleted_at column)
```sql
-- Verify soft delete columns
SELECT table_name, COUNT(*) as audit_field_count
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name = 'deleted_at'
GROUP BY table_name;
```

Expected: 9 tables with soft deletes

### ✅ Phase 7: Indexes (For performance)
```sql
-- Verify indexes are created
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

Expected: 40+ indexes for performance optimization

### ✅ Phase 8: Constraints (For data integrity)
```sql
-- Verify check constraints
SELECT constraint_name, table_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND constraint_type = 'CHECK'
ORDER BY table_name;
```

Expected CHECK constraints:
- status values in pedidos
- status values in produtos
- status values in rmas
- status values in item_rma
- quantidade > 0 checks
- frete one_or_other constraint

### ✅ Phase 9: Foreign Keys (For referential integrity)
```sql
-- Verify foreign keys
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
AND referenced_table_name IS NOT NULL
ORDER BY table_name, column_name;
```

Expected: 25+ foreign key relationships

---

## Testing the Database

### Test 1: Create a Test Order (Happy Path)

```sql
-- Get IDs of existing records
SELECT id FROM lojas LIMIT 1; -- Copy id_loja
SELECT id FROM vendedores LIMIT 1; -- Copy id_vendedor
SELECT id FROM clientes LIMIT 1; -- Copy id_cliente
SELECT id FROM users WHERE role = 'admin' LIMIT 1; -- Copy created_by

-- Insert test order (replace UUIDs)
INSERT INTO pedidos (
  id_loja, id_vendedor, id_cliente,
  numero_os, numero_nf, data_pedido, data_entrega,
  status, valor_venda, created_by
) VALUES (
  'LOJA_UUID_HERE',
  'VENDEDOR_UUID_HERE',
  'CLIENTE_UUID_HERE',
  'OS-001',
  'NF-001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '10 days',
  'To Buy',
  1000.00,
  'ADMIN_UUID_HERE'
);

-- Verify insertion
SELECT * FROM pedidos WHERE numero_nf = 'NF-001';
```

### Test 2: Soft Delete (Data Recovery)

```sql
-- Get the order ID from previous test
SELECT id FROM pedidos WHERE numero_nf = 'NF-001';

-- Soft delete the order (replace PEDIDO_ID)
UPDATE pedidos SET deleted_at = NOW() WHERE id = 'PEDIDO_ID';

-- Verify soft delete
SELECT * FROM pedidos WHERE numero_nf = 'NF-001';
-- Should show deleted_at timestamp

-- Query excluding soft deletes (normal queries)
SELECT * FROM pedidos WHERE numero_nf = 'NF-001' AND deleted_at IS NULL;
-- Should return 0 rows

-- Recover the order
UPDATE pedidos SET deleted_at = NULL WHERE numero_nf = 'NF-001';
```

### Test 3: Status History Tracking

```sql
-- Insert into status_history when order status changes
INSERT INTO status_history (
  entity_type, entity_id,
  old_status, new_status,
  changed_by, reason
) VALUES (
  'pedido',
  'PEDIDO_ID_HERE',
  'To Buy',
  'Bought',
  'ADMIN_UUID_HERE',
  'Supplier confirmed purchase'
);

-- Verify status history
SELECT * FROM status_history WHERE entity_type = 'pedido' ORDER BY changed_at DESC;
```

### Test 4: Audit Log (Full Change Tracking)

```sql
-- Insert into audit_logs when order is updated
INSERT INTO audit_logs (
  entity_type, entity_id, action,
  old_values, new_values,
  changed_by, ip_address, user_agent
) VALUES (
  'pedido',
  'PEDIDO_ID_HERE',
  'UPDATE',
  jsonb_build_object('status', 'To Buy', 'valor_venda', 1000.00),
  jsonb_build_object('status', 'Bought', 'valor_venda', 1000.00),
  'ADMIN_UUID_HERE',
  '127.0.0.1',
  'Mozilla/5.0...'
);

-- Verify audit log
SELECT * FROM audit_logs WHERE entity_type = 'pedido' ORDER BY changed_at DESC;

-- Query specific field changes
SELECT 
  entity_id,
  old_values->>'status' as old_status,
  new_values->>'status' as new_status,
  changed_at
FROM audit_logs
WHERE entity_type = 'pedido' 
AND (old_values->>'status') IS DISTINCT FROM (new_values->>'status');
```

### Test 5: View Queries (Reporting)

```sql
-- Test monthly results view
SELECT * FROM resultado_mensal ORDER BY mes DESC LIMIT 5;

-- Test annual results view
SELECT * FROM resultado_anual ORDER BY ano DESC;
```

---

## Backend Integration

### Python + FastAPI

```python
# requirements.txt
SQLAlchemy==2.0.0
psycopg2-binary==2.9.0
python-dotenv==1.0.0
passlib==1.7.4
bcrypt==4.0.0

# config.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:password@localhost:5432/orderly_hub"
)

engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# models.py
from sqlalchemy import Column, String, DateTime, Boolean, UUID
from sqlalchemy.ext.declarative import declarative_base
import uuid
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True)
    full_name = Column(String(255))
    role = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)
```

### Node.js + Prisma

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String    @map("password_hash")
  fullName        String    @map("full_name")
  role            String    // admin, manager, seller, viewer
  isActive        Boolean   @default(true) @map("is_active")
  twoFactorSecret String?   @map("two_factor_secret")
  lastLoginAt     DateTime? @map("last_login_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@index([email])
  @@index([deletedAt])
  @@map("users")
}

model Pedido {
  id              String   @id @default(uuid())
  idLoja          String   @map("id_loja")
  idVendedor      String   @map("id_vendedor")
  idCliente       String   @map("id_cliente")
  numeroOs        String   @map("numero_os")
  numeroNf        String   @map("numero_nf")
  dataPedido      DateTime @map("data_pedido")
  dataEntrega     DateTime @map("data_entrega")
  status          String
  valorVenda      Decimal  @db.Decimal(12, 2) @map("valor_venda")
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@unique([idLoja, numeroNf])
  @@index([status])
  @@index([deletedAt])
  @@map("pedidos")
}

// Run migrations
// npx prisma migrate dev --name init
```

---

## Backup & Recovery

### Daily Backup (Automated)

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/orderly_hub"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/orderly_hub_$TIMESTAMP.sql.gz"

# Create backup
pg_dump -U postgres -h localhost orderly_hub | gzip > "$BACKUP_FILE"

# Keep only 30 days of backups
find "$BACKUP_DIR" -name "orderly_hub_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

### Restore from Backup

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Drop existing database
dropdb -U postgres orderly_hub

# Create new database
createdb -U postgres orderly_hub

# Restore from backup
gunzip -c "$BACKUP_FILE" | psql -U postgres -d orderly_hub

echo "Restore completed from: $BACKUP_FILE"
```

### Point-in-Time Recovery

```bash
# PostgreSQL automatically logs all changes (WAL files)
# To restore to a specific time:

psql -U postgres -d orderly_hub

SELECT * FROM pedidos;
-- Data is not what you want

-- Stop PostgreSQL
sudo systemctl stop postgresql

-- Restore from backup
./restore.sh /backups/orderly_hub/orderly_hub_20260401_100000.sql.gz

-- Restore to specific point in time
# Edit postgresql.conf to enable PITR
# restore_command = 'cp /archive/wal_files/%f %p'
# recovery_target_time = '2026-04-21 15:30:00'

-- Start PostgreSQL
sudo systemctl start postgresql

-- Verify recovery
psql -U postgres -d orderly_hub
SELECT * FROM pedidos;
```

---

## Monitoring & Maintenance

### Check Database Size

```sql
-- Database size
SELECT 
  datname as database,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname = 'orderly_hub';

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Maintenance Tasks

```sql
-- Analyze query performance (run weekly)
ANALYZE;

-- Vacuum (remove dead rows, run daily)
VACUUM;

-- Reindex (rebuilding indexes, run monthly)
REINDEX DATABASE orderly_hub;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Connection Monitoring

```sql
-- Check active connections
SELECT 
  datname as database,
  usename as user,
  application_name,
  state,
  query,
  query_start
FROM pg_stat_activity
WHERE datname = 'orderly_hub';

-- Check for long-running queries
SELECT 
  pid,
  usename,
  query,
  query_start,
  EXTRACT(EPOCH FROM (NOW() - query_start)) as duration_seconds
FROM pg_stat_activity
WHERE state = 'active'
AND query_start < NOW() - INTERVAL '1 minute';
```

---

## Troubleshooting

### Issue: "could not connect to server"
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check connection
psql -U postgres -d orderly_hub
```

### Issue: "role postgres does not exist"
```sql
-- Create user
CREATE USER postgres WITH PASSWORD 'your_password' SUPERUSER;

-- Or connect as root
sudo -u postgres psql
```

### Issue: "database orderly_hub already exists"
```sql
-- Drop existing database
DROP DATABASE orderly_hub;

-- Then run initialization again
psql -U postgres -f DATABASE_INIT.sql
```

### Issue: "permission denied" on files
```bash
# Check file permissions
ls -la DATABASE_INIT.sql

# Make executable if needed
chmod +x DATABASE_INIT.sql
```

---

## Performance Tuning

### Enable Query Logging

```sql
-- In postgresql.conf
log_min_duration_statement = 1000  -- Log queries > 1 second
log_statement = 'all'               -- Log all statements
log_connections = on                -- Log connections
log_disconnections = on             -- Log disconnections
```

### Connection Pooling

```bash
# Install PgBouncer (connection pool)
sudo apt-get install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
orderly_hub = host=localhost port=5432 dbname=orderly_hub

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Testing Checklist

- [ ] All 16 main tables created successfully
- [ ] All 2 audit tables created (status_history, audit_logs)
- [ ] All 2 views created (resultado_mensal, resultado_anual)
- [ ] All tables use UUID primary keys
- [ ] All main tables have audit fields
- [ ] Soft deletes working correctly
- [ ] Status history tracking works
- [ ] Audit logs tracking JSONB changes
- [ ] Foreign keys are enforced
- [ ] Unique constraints working
- [ ] Check constraints validated
- [ ] Indexes created for performance
- [ ] Triggers for updated_at working
- [ ] Sample data inserted
- [ ] Backups can be created and restored
- [ ] Queries using views return correct results

---

## Next Steps

1. **Backend Team:** Generate ORM models from schema (Prisma or SQLAlchemy)
2. **Database Team:** Set up automated backups and monitoring
3. **DevOps:** Configure production database and replication
4. **Testing:** Load test with realistic data volumes
5. **Documentation:** Create database administration manual

---

**Database Version:** 1.0 (April 21, 2026)
**Status:** ✅ Production Ready
