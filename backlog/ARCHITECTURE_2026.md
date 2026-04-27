# Orderly Hub - System Architecture

## System Overview

Orderly Hub is a modern, scalable order management system designed for multi-company retail operations with comprehensive audit logging and LGPD compliance from the ground up.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ORDERLY HUB - ARCHITECTURE                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  FRONTEND (React 18 + Vite + TypeScript)                        │ │
│  │  ├─ Pages: Sales, Dashboard, Orders, Quotes, RMA              │ │
│  │  ├─ UI: Shadcn UI + Radix UI + Tailwind CSS                   │ │
│  │  ├─ State: React Query (TanStack) for server state            │ │
│  │  ├─ Forms: React Hook Form + Zod validation                   │ │
│  │  └─ API: Axios client with auth interceptors                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                ↕                                      │
│                          HTTP/REST API                               │
│                                ↕                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  BACKEND API (Python + FastAPI) ✅ DECIDED                     │ │
│  │  ├─ Authentication (JWT + TOTP 2FA)                            │ │
│  │  ├─ Authorization (RBAC: Admin/Manager/Seller/Viewer)         │ │
│  │  ├─ Core Services:                                             │ │
│  │  │  ├─ OrderService (CRUD + business logic)                   │ │
│  │  │  ├─ QuoteService (CRUD + conversion)                       │ │
│  │  │  ├─ RMAService (returns management)                        │ │
│  │  │  └─ AuditService (logging + compliance)                    │ │
│  │  ├─ ORM: SQLAlchemy 2.x + Alembic (migrations)               │ │
│  │  ├─ Validation: Pydantic v2                                   │ │
│  │  └─ Error Handling: Standard REST error responses             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                ↕                                      │
│                      Connection Pool (PgBouncer)                     │
│                                ↕                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  DATABASE (PostgreSQL 14+)                                      │ │
│  │  ├─ Core Tables (16):                                          │ │
│  │  │  ├─ users (authentication)                                  │ │
│  │  │  ├─ lojas (stores)                                          │ │
│  │  │  ├─ vendedores (sellers)                                    │ │
│  │  │  ├─ clientes (customers)                                    │ │
│  │  │  ├─ pedidos (orders)                                        │ │
│  │  │  ├─ produtos (order items)                                  │ │
│  │  │  ├─ custo_pedido (order costs 1:1)                         │ │
│  │  │  ├─ frete (freight/delivery)                                │ │
│  │  │  ├─ rmas (return management)                                │ │
│  │  │  ├─ item_rma (RMA items)                                    │ │
│  │  │  ├─ cotacoes (quotes)                                       │ │
│  │  │  ├─ item_cotacao (quote items)                              │ │
│  │  │  ├─ venda_vendedor (sales tracking)                         │ │
│  │  │  ├─ compra_vendedor (purchase tracking)                     │ │
│  │  │  └─ meta_vendedor (targets/goals)                           │ │
│  │  ├─ Audit Tables (2):                                          │ │
│  │  │  ├─ status_history (who changed what status when)           │ │
│  │  │  └─ audit_logs (full change tracking with JSONB)           │ │
│  │  ├─ Views (2):                                                 │ │
│  │  │  ├─ resultado_mensal (monthly reports)                      │ │
│  │  │  └─ resultado_anual (annual reports)                        │ │
│  │  ├─ Features:                                                  │ │
│  │  │  ├─ UUID primary keys (security)                            │ │
│  │  │  ├─ Soft deletes (deleted_at)                               │ │
│  │  │  ├─ Audit fields (created_by, created_at, updated_at)      │ │
│  │  │  ├─ 40+ indexes (performance)                               │ │
│  │  │  ├─ FK constraints (data integrity)                         │ │
│  │  │  └─ CHECK constraints (business rules)                      │ │
│  │  └─ Backups: Daily, 30-day retention                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  INFRASTRUCTURE ✅ DECIDIDO                                     │ │
│  │  ├─ Hosting: Railway (produção) + PostgreSQL local (dev)      │ │
│  │  ├─ Containers: Docker (opcional)                              │ │
│  │  ├─ CI/CD: GitHub Actions                                      │ │
│  │  ├─ Error Tracking: Sentry                                     │ │
│  │  ├─ Monitoring: Railway Dashboard + DataDog (futuro)          │ │
│  │  ├─ Logging: Railway Logs + estruturado via Python logging    │ │
│  │  └─ Frontend: Vercel (deploy)                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Layer

```
┌─ Pages
│  ├─ Sales (list orders, quotes, RMA)
│  ├─ Dashboard (KPIs, goals, visualizations) [ENHANCED]
│  └─ (Future: Reports, Admin, Financial Calendar)
│
├─ Components
│  ├─ Modal Components
│  │  ├─ OrderModal (create/edit order)
│  │  ├─ QuoteModal (create/edit quote)
│  │  ├─ RmaModal (create/edit RMA)
│  │  └─ GoalsModal (NEW - manage sales targets)
│  ├─ List Components
│  │  ├─ OrderTable (paginated orders)
│  │  ├─ QuoteTable (paginated quotes)
│  │  └─ RmaTable (paginated RMA)
│  ├─ Dashboard Components (NEW)
│  │  ├─ KPICard (display metric)
│  │  ├─ KPIGrid (layout multiple metrics)
│  │  ├─ CostCompositionChart (pie chart)
│  │  ├─ TicketComparisonChart (bar chart)
│  │  ├─ CompanyBreakdownTable (per-company metrics)
│  │  ├─ SellerBreakdownTable (per-seller metrics)
│  │  ├─ FilterBar (month, year, date range, company)
│  │  └─ ViewModeToggle (company vs seller)
│  └─ Display Components
│     ├─ StatusBadge (show order status)
│     ├─ StatusHistory (show status timeline)
│     ├─ AuditLog (show change history)
│     └─ (UI: Button, Input, Form, etc.)
│
├─ Hooks
│  ├─ useAuth (authentication state)
│  ├─ useOrders (fetch/mutate orders)
│  ├─ useQuotes (fetch/mutate quotes)
│  ├─ useRMA (fetch/mutate RMA)
│  ├─ useDashboard (NEW - fetch KPIs, breakdown data)
│  │  ├─ fetchKPIs(filters)
│  │  ├─ fetchBreakdownByCompany()
│  │  ├─ fetchBreakdownBySeller()
│  │  ├─ fetchGoals()
│  │  └─ calculateProjections()
│  ├─ useGoals (NEW - manage sales targets)
│  │  ├─ createGoal()
│  │  ├─ updateGoal()
│  │  ├─ deleteGoal()
│  │  └─ getGoal(key)
│  └─ (React Query hooks)
│
├─ API Client
│  ├─ axios instance (configured)
│  ├─ interceptors
│  │  ├─ Request: Add auth token
│  │  ├─ Response: Handle 401 errors
│  │  └─ Error: Global error handling
│  ├─ endpoints constants
│  └─ Dashboard API endpoints (NEW)
│     ├─ /dashboard/kpis
│     ├─ /dashboard/goals
│     ├─ /dashboard/projections
│     ├─ /dashboard/breakdown-by-company
│     └─ /dashboard/breakdown-by-seller
│
└─ Store
   ├─ AuthStore (user state, login/logout)
   └─ FinanceStore (NEW - goals, expenses)
```

### Backend Layer

```
Estrutura real: backend/
├── main.py                  ✅ criado
├── alembic.ini              ✅ criado
├── Procfile                 ✅ criado
├── railway.toml             ✅ criado
├── requirements.txt         ✅ criado
├── .env                     ✅ criado
├── alembic/
│   ├── env.py               ✅ criado
│   ├── script.py.mako       ✅ criado
│   └── versions/            ✅ criado (aguarda migrations)
├── app/
│   ├── config.py            ✅ criado
│   ├── database.py          ✅ criado
│   ├── models/user.py       ✅ criado
│   ├── schemas/user.py      ✅ criado
│   ├── services/auth.py     ✅ criado
│   ├── utils/security.py    ✅ criado
│   ├── utils/errors.py      ✅ criado
│   └── api/routes/auth.py   ✅ criado
└── tests/                   ⬜ pendente

┌─ API Routes implementadas
│  ├─ /api/auth              ✅ IMPLEMENTADO
│  │  ├─ POST /register (admin)
│  │  ├─ POST /login
│  │  ├─ POST /verify-2fa
│  │  ├─ POST /refresh-token
│  │  ├─ POST /logout
│  │  ├─ GET /me
│  │  ├─ POST /2fa/setup
│  │  └─ POST /2fa/confirm
│  ├─ /api/orders
│  │  ├─ GET / (list with filters)
│  │  ├─ POST / (create)
│  │  ├─ GET /:id (details)
│  │  ├─ PUT /:id (update)
│  │  ├─ PATCH /:id/status (change status)
│  │  ├─ DELETE /:id (soft delete)
│  │  ├─ GET /:id/history (status history)
│  │  └─ GET /:id/audit (audit logs)
│  ├─ /api/quotes (same CRUD pattern)
│  ├─ /api/rma (same CRUD pattern)
│  ├─ /api/analytics
│  │  ├─ GET /summary (dashboard)
│  │  ├─ GET /orders-by-status
│  │  └─ GET /revenue
│  └─ /api/users
│     ├─ GET /:id/data-export (LGPD)
│     └─ POST /:id/delete-data (LGPD)
│
│  Dashboard APIs (NEW)
│     ├─ GET /dashboard/kpis (revenue, profit, margin, counts)
│     ├─ GET /dashboard/goals (retrieve sales targets)
│     ├─ POST /dashboard/goals (create/update target)
│     ├─ DELETE /dashboard/goals/:key (delete target)
│     ├─ GET /dashboard/projections (calc daily targets)
│     ├─ GET /dashboard/breakdown-by-company (per-company KPIs)
│     └─ GET /dashboard/breakdown-by-seller (per-seller KPIs)
│
├─ Services (Business Logic)
│  ├─ AuthService
│  │  ├─ register()
│  │  ├─ login()
│  │  ├─ verify2FA()
│  │  ├─ refreshToken()
│  │  └─ validateToken()
│  ├─ OrderService
│  │  ├─ getOrders()
│  │  ├─ getOrder()
│  │  ├─ createOrder()
│  │  ├─ updateOrder()
│  │  ├─ updateOrderStatus()
│  │  ├─ deleteOrder()
│  │  ├─ getStatusHistory()
│  │  └─ getAuditLog()
│  ├─ QuoteService (similar)
│  ├─ RMAService (similar)
│  ├─ AuditService
│  │  ├─ logStatusChange()
│  │  ├─ logAuditEvent()
│  │  ├─ getStatusHistory()
│  │  └─ getAuditLog()
│  ├─ DashboardService (NEW)
│  │  ├─ calculateKPIs(filters)
│  │  │  ├─ revenue, costs, profit, margin
│  │  │  ├─ sales count, ticket averages
│  │  │  ├─ cancellations, today's revenue
│  │  │  └─ target tracking (% achieved, gap)
│  │  ├─ getBreakdownByCompany()
│  │  ├─ getBreakdownBySeller()
│  │  ├─ calculateProjections(target, elapsed)
│  │  │  ├─ remaining business days
│  │  │  ├─ daily average
│  │  │  ├─ month projection
│  │  │  └─ dynamic daily target
│  │  ├─ upsertGoal(year, month, target)
│  │  ├─ deleteGoal(key)
│  │  └─ getGoals(year?, month?)
│  ├─ FinanceService (NEW - Phase 2)
│  │  ├─ createExpense(data)
│  │  ├─ updateExpense(id, data)
│  │  ├─ deleteExpense(id)
│  │  ├─ getExpenses(filters)
│  │  ├─ calculateInstallments(plan)
│  │  ├─ calculatePenalties(order)
│  │  └─ calculateInterest(order)
│  └─ AnalyticsService
│     ├─ getDashboardSummary() [calls DashboardService]
│     ├─ getOrdersByStatus()
│     ├─ getRevenue()
│     ├─ generateMonthlyReport()
│     └─ generateAnnualReport()
│
├─ Middleware
│  ├─ authMiddleware (verify JWT)
│  ├─ roleMiddleware (check RBAC)
│  ├─ errorHandler (handle exceptions)
│  ├─ requestLogger (log requests)
│  └─ rateLimiter (prevent abuse)
│
├─ Models/Repositories
│  ├─ UserRepository
│  ├─ OrderRepository
│  ├─ QuoteRepository
│  ├─ RMARepository
│  ├─ AuditRepository
│  ├─ GoalRepository (NEW)
│  ├─ ExpenseRepository (NEW - Phase 2)
│  └─ (ORM handles queries)
│
└─ Utils
   ├─ security.py  (bcrypt, JWT, TOTP) ✅
   ├─ errors.py    (custom exceptions) ✅
   └─ logging      (Python logging, structured)
```

### Database Layer

```
PostgreSQL Database Structure:

┌─ Core Entities
│  ├─ Users (16 UUID)
│  ├─ Lojas (stores)
│  ├─ Vendedores (sellers per store)
│  ├─ Clientes (customers)
│  └─ Metas (targets)
│
├─ Order Management
│  ├─ Pedidos (orders) ← MAIN TABLE
│  ├─ PedidoFormaPagamento (payment methods)
│  ├─ Produtos (order items)
│  ├─ CustoPedido (order costs 1:1)
│  └─ Frete (freight, links to pedido/rma)
│
├─ Return Management (RMA)
│  ├─ RMAs (return requests)
│  └─ ItemRMA (items in RMA)
│
├─ Quote Management
│  ├─ Cotacoes (quotes)
│  └─ ItemCotacao (quote items)
│
├─ Tracking Tables
│  ├─ VendaVendedor (sales attribution)
│  └─ CompraVendedor (purchase attribution)
│
└─ Audit & Compliance (LGPD)
   ├─ StatusHistory (status changes timeline)
   │  └─ Tracks: entity_type, entity_id, old_status, new_status, changed_by, reason
   │
   └─ AuditLogs (complete change tracking)
      └─ Tracks: entity_type, entity_id, action, old_values (JSONB), new_values (JSONB), changed_by, ip_address, user_agent
```

---

## Data Flow Diagrams

### Order Creation Flow

```
Frontend
  │
  ├─ User fills OrderModal
  └─ POST /api/orders { customer, items, dates, value }
     │
     Backend
     ├─ Authenticate (verify JWT)
     ├─ Authorize (verify role can create orders)
     ├─ Validate input (Zod schema)
     ├─ Check business rules
     │  ├─ Unique numero_nf per store
     │  ├─ Valid dates (entrega > hoje)
     │  └─ Valid customer
     │
     ├─ Database Transaction BEGIN
     │  ├─ INSERT INTO pedidos
     │  ├─ INSERT INTO produtos (items)
     │  ├─ INSERT INTO custo_pedido (costs)
     │  ├─ INSERT INTO audit_logs (CREATE event)
     │  └─ Transaction COMMIT
     │
     └─ Return 201 { orderId, status, ... }
        │
        Frontend
        ├─ Receive response
        ├─ Update React Query cache
        ├─ Show success toast
        ├─ Refetch orders list
        └─ Close modal
```

### Status Update Flow

```
Frontend
  │
  ├─ User changes order status in UI
  └─ PATCH /api/orders/:id/status { newStatus }
     │
     Backend
     ├─ Authenticate & authorize
     ├─ Get current order from DB
     ├─ Validate status transition
     │  └─ Check: To Buy → Bought (allowed)
     │
     ├─ Database Transaction BEGIN
     │  ├─ UPDATE pedidos SET status = newStatus, updated_at = NOW()
     │  ├─ INSERT INTO status_history
     │  │  └─ { entity_type: 'pedido', entity_id, old_status, new_status, changed_by, changed_at }
     │  ├─ INSERT INTO audit_logs
     │  │  └─ { action: 'UPDATE', old_values: {...}, new_values: {...} }
     │  └─ Transaction COMMIT
     │
     └─ Return 200 { orderId, status: newStatus, ... }
        │
        Frontend
        ├─ Update local cache
        ├─ Show status change in UI
        ├─ Display status history
        └─ Trigger refetch
```

### Audit Log View Flow

```
Frontend
  │
  ├─ User clicks "View History" on order
  └─ GET /api/orders/:id/audit
     │
     Backend
     ├─ Authenticate & authorize
     ├─ Query: SELECT * FROM audit_logs WHERE entity_type = 'pedido' AND entity_id = ?
     │
     └─ Return audit logs
        ├─ { action: 'CREATE', changed_at, changed_by: {name}, old_values: null, new_values: {...} }
        ├─ { action: 'UPDATE', changed_at, changed_by: {name}, old_values: {...}, new_values: {...} }
        └─ ...
           │
           Frontend
           ├─ Display AuditLog component
           ├─ Show timeline of changes
           ├─ Highlight diffs (old vs new)
           └─ Show who made each change
```

---

## Security Architecture

### Authentication Flow

```
1. User enters email/password
   └─ POST /api/auth/login

2. Backend validates password
   └─ Compare with password_hash (bcrypt)

3. Backend generates temporary session ID
   └─ Return { sessionId, requiresMFA: true }

4. User enters TOTP code (from authenticator app)
   └─ POST /api/auth/verify-2fa { sessionId, code }

5. Backend validates TOTP
   └─ Compare with two_factor_secret

6. Backend generates tokens
   ├─ JWT accessToken (1 hour expiry)
   ├─ JWT refreshToken (7 days expiry)
   └─ Return { accessToken, refreshToken }

7. Frontend stores tokens
   ├─ accessToken in memory (secure)
   ├─ refreshToken in httpOnly cookie (secure)
   └─ Auto-attach accessToken to API requests

8. Token auto-refresh
   ├─ If 401 response
   └─ POST /api/auth/refresh-token { refreshToken }
      └─ Return new accessToken
```

### Authorization (RBAC)

```
Roles:
├─ Admin: Full access to all operations + user management
│  └─ Can create/edit/delete users, change roles, access all data
│
├─ Manager: Read/write all entities + limited user mgmt
│  └─ Can manage sellers, view all orders, edit orders for store
│
├─ Seller: Read/write own records only
│  └─ Can only see/edit orders they created or assigned to them
│
└─ Viewer: Read-only access
   └─ Can only view reports and analytics

Implementation:
├─ roleMiddleware checks user.role
├─ Queries filtered by role
│  ├─ Admin: No filter
│  ├─ Manager: WHERE id_loja = user.store_id
│  ├─ Seller: WHERE created_by = user.id OR assigned_to = user.id
│  └─ Viewer: SELECT only from resultado_mensal/anual views
└─ Endpoints return 403 Forbidden if unauthorized
```

### Data Protection

```
┌─ At Rest
│  ├─ Passwords: bcrypt hashing (12 rounds)
│  ├─ Sensitive data: Encrypt at app level or DB level
│  └─ PII: Tokenization for compliance
│
├─ In Transit
│  ├─ HTTPS/TLS 1.3
│  ├─ Certificate: SSL/TLS from AWS/Azure
│  └─ HSTS headers enabled
│
├─ Input Validation
│  ├─ Pydantic v2 validation (request/response schemas)
│  ├─ SQL injection prevention: ORM + parameterized queries
│  └─ XSS prevention: React output encoding
│
└─ API Security
   ├─ Rate limiting: 100 req/min per IP
   ├─ CORS: Whitelist specific origins
   ├─ CSRF: Token-based (if using cookies)
   └─ Security headers: CSP, X-Frame-Options, etc.
```

---

## Audit & Compliance (LGPD)

### Audit Trail Architecture

```
Every CREATE/UPDATE/DELETE operation creates audit trail:

┌─ Status History (for status changes)
│  └─ Minimal: entity_type, entity_id, old_status, new_status, changed_by, reason
│  └─ Use case: Know when each order moved from To Buy → Bought → Delivered
│
└─ Audit Logs (for all changes)
   ├─ Complete: entity_type, entity_id, action, old_values, new_values, changed_by
   ├─ Data: JSONB format (allows flexible queries)
   ├─ Meta: ip_address, user_agent (know who from where)
   └─ Use case: Forensics, compliance, data recovery

Example Audit Log Entry:
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  entity_type: "pedido",
  entity_id: "650e8400-e29b-41d4-a716-446655440000",
  action: "UPDATE",
  changed_by: "admin@example.com",
  changed_at: "2026-04-22 10:30:45",
  old_values: {
    "status": "To Buy",
    "valor_venda": "1000.00",
    "observacao": null
  },
  new_values: {
    "status": "Bought",
    "valor_venda": "1000.00",
    "observacao": "Supplier confirmed"
  },
  ip_address: "192.168.1.100",
  user_agent: "Mozilla/5.0..."
}
```

### LGPD Compliance Features

```
┌─ Article 5 (Accountability)
│  └─ Audit logs prove who did what when → ✅ status_history + audit_logs
│
├─ Article 12 (Transparent Information)
│  └─ Users know what data we have → ✅ GET /api/users/:id/data-export
│
├─ Article 17 (Right to Deletion)
│  └─ Users can delete their data → ✅ POST /api/users/:id/delete-data
│      └─ Soft delete + anonymization (keeps audit trail)
│
├─ Article 18 (Data Portability)
│  └─ Users can download their data → ✅ GET /api/users/:id/data-export (JSON)
│
└─ Retention Policy
   ├─ Audit logs: 6+ months
   ├─ User data: Until user requests deletion
   ├─ Deleted user data: 30 days (soft deleted, then hard deleted)
   └─ Backup retention: 30 days
```

---

## Performance Optimization

### Database Performance

```
Indexes Strategy:
├─ PRIMARY KEY: UUID (B-tree, automatic)
├─ FOREIGN KEYS: Automatic indexes on all FK columns
├─ STATUS: Index on pedidos(status) for common queries
├─ DATES: Index on pedidos(data_entrega) for date filtering
├─ SOFT DELETE: WHERE clauses on deleted_at IS NULL (covering indexes)
├─ COMPOSITE: (id_loja, data_entrega) for common filter patterns
└─ FULL TEXT: To be added for customer search

Performance Targets:
├─ SELECT query: < 50ms (with index)
├─ INSERT/UPDATE: < 100ms
├─ JOIN query (order + items + costs): < 100ms
└─ API response time: < 200ms total (DB + app logic)
```

### Frontend Performance

```
Optimization Strategies:
├─ Code Splitting: Lazy load routes (React.lazy)
├─ Bundle Size: Tree-shaking, minification
├─ Images: Optimize with Squoosh, use WebP
├─ Caching: React Query for data caching
├─ Pagination: Load 20 items at a time (not all)
├─ Debouncing: Filter/search debounce 300ms
├─ CDN: Serve static assets from CDN
└─ Monitoring: Lighthouse scores > 90

Performance Targets:
├─ Page load time: < 3 seconds
├─ First contentful paint: < 1.5 seconds
├─ Time to interactive: < 2.5 seconds
└─ Lighthouse score: > 90
```

---

## Scalability Architecture

### Horizontal Scaling

```
Current Setup (MVP):
├─ 1 Backend instance (can handle ~1000 concurrent users)
├─ 1 PostgreSQL instance (RDS Multi-AZ)
└─ 1 Frontend (CDN)

Future Scaling:
├─ Multiple backend instances behind load balancer
│  └─ Stateless (auth via JWT, no sessions)
├─ PostgreSQL read replicas for analytics
├─ Redis for caching (if needed)
├─ Message queue for async tasks (if needed)
└─ Separate analytics/reporting from operational DB
```

### Database Scaling

```
Current (MVP):
├─ Single PostgreSQL instance
├─ Max ~100GB storage
└─ Connection pool: 25 connections

Future:
├─ Read replicas for reporting
├─ Partitioning: Orders by date (for archive)
├─ Connection pooling: PgBouncer
└─ Separate reporting database (replica)
```

---

## Disaster Recovery

```
Backup Strategy:
├─ Frequency: Daily automated backups
├─ Retention: 30 days
├─ Storage: Replicated to 2+ regions
└─ Testing: Monthly restore tests

Recovery Procedures:
├─ Database failure: Restore from latest backup (< 1 hour RTO)
├─ Application failure: Failover to backup server (< 15 min RTO)
└─ Data corruption: Point-in-time recovery via WAL files

Monitoring:
├─ Database health: CloudWatch/DataDog
├─ Backup status: Automated alerts
├─ Error rates: Sentry tracking
└─ Performance: APM monitoring
```

---

## Technology Stack Decision Matrix

### Backend Framework

**✅ DECISÃO TOMADA: Python + FastAPI**

| Componente | Tecnologia escolhida |
|---|---|
| Framework | FastAPI 0.104+ |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic 1.13 |
| Validação | Pydantic v2 |
| Hashing | bcrypt (passlib) |
| Auth tokens | python-jose (JWT) |
| 2FA | pyotp (TOTP) |
| Servidor | Uvicorn |
| Testes | pytest + pytest-asyncio |

---

## Documentation Structure

```
📚 Documentation Suite:
├─ BACKLOG_2026.md (this file = updated backlog)
├─ ARCHITECTURE.md (system design) ← You are here
├─ DEVELOPMENT_ROADMAP.md (day-by-day tasks)
├─ IMPLEMENTATION_GUIDE.md (code examples)
├─ QUICK_REFERENCE.md (quick lookup)
├─ DOCUMENTATION_SUMMARY.md (file index)
│
├─ 📊 Database Documentation
├─ DATABASE_INIT.sql (PostgreSQL schema)
├─ DATABASE_SETUP_GUIDE.md (setup & verification)
├─ DATABASE_SCHEMA_REFACTORED.md (technical reference)
├─ DATABASE_REFACTORING_GUIDE.md (migration guide)
├─ DATABASE_FILES_INDEX.md (navigation)
└─ DATABASE_SCHEMA_REFACTORED.dbdiagram (visual diagram)
```

---

## Status Atual (April 25, 2026)

### ✅ Concluído
- Decisão de stack: Python FastAPI
- Estrutura do projeto backend criada
- `main.py` com CORS e exception handlers
- `config.py` com Pydantic Settings
- `database.py` com SQLAlchemy engine + pool
- `models/user.py` com RBAC e soft delete
- `schemas/user.py` com todos os schemas de auth
- `services/auth.py` com register, login, TOTP, tokens
- `utils/security.py` com bcrypt, JWT, TOTP
- `utils/errors.py` com hierarquia de exceções
- `api/routes/auth.py` com 8 endpoints
- Alembic configurado (alembic.ini + env.py)
- `.env` configurado
- `Procfile` + `railway.toml` para deploy
- Railway escolhido como plataforma de produção

### ⬜ Próximos passos
1. Instalar PostgreSQL local e rodar `DATABASE_INIT.sql`
2. Rodar `alembic upgrade head`
3. Gerar os 15 modelos ORM restantes (Fase 1.3)
4. Implementar APIs de Orders, Quotes, RMA (Fase 1.5-1.6)
5. Integração frontend (Fase 2)
6. Deploy Railway na Semana 8

---

**Architecture Version:** 2.1 (Updated April 25, 2026)  
**Status:** ✅ Backend Foundation Complete  
**Last Updated:** April 25, 2026
