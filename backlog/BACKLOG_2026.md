# Orderly Hub - Project Backlog (Updated)

## Project Overview
**Orderly Hub** is a comprehensive order management system for multi-company operations (Lucky Store, BTech, AJJ) with complete audit trail, LGPD compliance, and production-ready architecture.

**Status:** Backend foundation completa. ORM models 100% gerados. Auth com JWT, 2FA, blacklist e change-password implementados. Orders CRUD completo com audit log e status history.

**Team:** Rafael, Gustavo, Duda, Peu  
**Target MVP:** 8-10 weeks  
**Target Full Release:** 20-24 weeks

---

## 👥 Divisão de Tasks por Operacional

> Cada operacional atua em múltiplas frentes (backend, frontend, infra) para evitar gargalos e especialização única.

| Operacional | Frente Principal | Frente Secundária | Infra/Ops |
|---|---|---|---|
| **Rafael** | Backend (ORM, Orders API, Audit) | Frontend (Quote Modal, Sales Page) | CI/CD |
| **Gustavo** | Backend (Auth, Quotes API, Dashboard Goals) | Frontend (React Query, Audit Log UI) | Railway DB |
| **Duda** | Backend (RMA API, Status tracking, Financial) | Frontend (Order Modal, Status History UI) | Monitoring |
| **Peu** | Frontend (API Client, Hooks, RMA Modal) | Backend (Order Costs, Swagger, LGPD) | Vercel Deploy |

### Resumo por fase

| Fase | Rafael | Gustavo | Duda | Peu |
|---|---|---|---|---|
| 1.1 DB Setup | Coordena | Instala local | Verifica | Instala local |
| 1.3 ORM Models | users, lojas, vendedores, clientes | pedidos, produtos, custo_pedido, frete | rmas, item_rma, cotacoes, item_cotacao | venda_vendedor, compra_vendedor, meta, audit |
| 1.4 Auth | RBAC middleware | 2FA + testes | Row-level auth | Endpoint tests |
| 1.5 Orders API | CRUD + validações | Order items | Status + history | Costs + payments |
| 1.6 Quotes & RMA | — | Quotes API completa | RMA API completa | Quote items |
| 1.7 Audit | Audit logs | LGPD deletion | LGPD export | Status history |
| 1.8 API Testing | Unit tests + perf | Unit tests | Integration tests | Swagger + E2E |
| 2.x Frontend | Quote Modal + Sales Page | React Query + Audit Log UI | Order Modal + Status UI | API Client + RMA Modal |
| 2.5 Compliance UI | LGPD Export backend | Audit Log component | Status History component | LGPD Deletion UI |
| 2.6 Dashboard | KPIs backend | Goals + Projections | Financial backend | Dashboard frontend |
| 3.x Testing | Segurança + perf | Backend tests | Frontend tests | E2E |
| 4.x Deploy | CI/CD | Railway PostgreSQL | Monitoring | Vercel |

---

## What's New in This Update (April 22, 2026)

✅ **Database Fully Designed & Documented:**
- Complete PostgreSQL schema with UUIDs, audit fields, soft deletes
- 2 new audit tables (status_history, audit_logs) for LGPD compliance
- 2 reporting views (resultado_mensal, resultado_anual)
- DATABASE_INIT.sql ready to run (0-5 minutes setup)
- DATABASE_SETUP_GUIDE.md with verification & testing
- 5 complete test scenarios ready to execute
- Backend integration examples (Python & Node.js)

✅ **Audit & Compliance Features Ready:**
- Status history tracking (know when each status changed)
- Complete audit logs with JSONB (know exactly what values changed)
- Soft deletes (data recovery capability)
- User attribution (created_by, changed_by on all mutations)
- LGPD data export API specification
- 6+ month audit retention policy

✅ **Architecture Solidified:**
- Database schema locked (no more changes needed)
- Performance indexes designed (40+ indexes)
- Security patterns defined (UUID, audit trail, soft delete)
- Backup & recovery procedures documented
- Connection pooling strategy defined

---

## Phase 1: Backend Infrastructure & Database (Weeks 1-3) ⚡ CRITICAL

### 1.1 Database Setup & Verification (Days 1-3)
**Priority:** P0 - BLOCKER

**Database Implementation:**
- [x] PostgreSQL 14+ installed locally → **Rafael** ✅ (outros devs pendente)
- [x] DATABASE_INIT.sql executed successfully → **Rafael** ✅
- [x] All 16 tables created with correct structure → **Rafael** ✅
- [x] All 2 audit tables created (status_history, audit_logs) → **Rafael** ✅
- [x] All 2 views created (resultado_mensal, resultado_anual) → **Rafael** ✅
- [x] All 40+ indexes optimized → **Rafael** ✅
- [x] Triggers for updated_at working → **Rafael** ✅
- [x] Seed data populated (3 stores, 1 admin user) → **Rafael** ✅

**Verification Tasks:**
- [ ] Run 9-phase verification checklist (DATABASE_SETUP_GUIDE.md) → **Duda**
- [ ] Execute all 5 test scenarios → **Duda**
- [ ] Verify UUID primary keys on all tables → **Duda**
- [ ] Verify soft deletes functionality → **Duda**
- [ ] Verify audit fields on main tables → **Duda**
- [ ] Verify status_history table working → **Duda**
- [ ] Verify audit_logs table working → **Duda**
- [ ] Verify views returning correct data → **Duda**

**Effort:** 2 backend devs, 1 day each  
**Success Criteria:**
- ✅ All 16 tables + 2 audit tables exist
- ✅ All 5 test scenarios pass
- ✅ Soft deletes work (data recoverable)
- ✅ Audit logs capturing changes

---

### 1.2 Backend Framework Setup (Days 2-3)
**Priority:** P0 - BLOCKER

**Technology Selection:**
- [x] **Decide:** Python FastAPI ← DECIDED ✅
- [x] Set up development environment ✅
- [x] Initialize project repository ✅
- [x] Configure environment variables (.env) ✅

**Choose One Path:**

**Path A: Python + FastAPI** ✅
- [x] Create Python project structure ✅
- [x] Install dependencies: fastapi, uvicorn, sqlalchemy, psycopg2, pydantic[email] ✅
- [x] Configure database connection (UTF-8 encoding) ✅
- [x] Set up Alembic for migrations + baseline stampado ✅
- [x] Create first ORM model (users table) ✅
- [x] Create schemas Pydantic (user.py) ✅
- [x] Test database connection → **✅ Servidor rodando em localhost:8000, Swagger acessível**

**Effort:** 2 backend devs, 1.5 days  
**Success Criteria:**
- ✅ Project structure created
- ✅ Database connection confirmed
- ✅ First ORM model working

---

### 1.3 ORM Models Generation (Days 3-4)
**Priority:** P0 - BLOCKER

**Generate All ORM Models:**
- [x] Create users model with encryption → **Rafael** ✅
- [x] Create lojas model with relationships → **Rafael** ✅
- [x] Create vendedores model with cascading → **Rafael** ✅
- [x] Create clientes model → **Rafael** ✅
- [x] Create pedidos model (main table) → **Rafael** ✅
- [x] Create produtos model (order items) → **Gustavo** ✅
- [x] Create custo_pedido model → **Rafael** ✅
- [x] Create frete model → **Rafael** ✅
- [x] Create rmas model (returns) → **Duda** ✅
- [x] Create item_rma model → **Duda** ✅
- [x] Create cotacoes model (quotes) → **Duda** ✅
- [x] Create item_cotacao model → **Duda** ✅
- [x] Create venda_vendedor model → **Peu** ✅
- [x] Create compra_vendedor model → **Peu** ✅
- [x] Create meta_vendedor model → **Peu** ✅
- [x] Create status_history model (audit) → **Peu** ✅
- [x] Create audit_logs model (audit) → **Peu** ✅

**Testing ORM:**
- [ ] All models instantiate correctly → **Gustavo**
- [ ] Relationships resolve properly → **Gustavo**
- [ ] Foreign keys enforced → **Duda**
- [ ] Indexes used in queries → **Duda**

**Effort:** 2 backend devs, 1.5 days  
**Success Criteria:**
- ✅ All 16+ models generated
- ✅ Relationships working
- ✅ Type safety verified

---

### 1.4 Authentication System (Days 4-7)
**Priority:** P0 - BLOCKER

**User Management:** → **Rafael**
- [x] Create users table with password hashing → **Rafael** ✅
- [x] Implement registration endpoint (admin only) → **Rafael** ✅
- [x] Implement login endpoint → **Rafael** ✅
- [ ] Implement password reset flow → **Rafael**

**JWT Implementation:** → **Rafael**
- [x] Generate JWT on successful login → **Rafael** ✅
- [x] Set token expiry (1 hour access, 7 days refresh) → **Rafael** ✅
- [x] Implement token refresh endpoint → **Rafael** ✅
- [x] Validate JWT on protected routes (get_current_user dependency) → **Rafael** ✅
- [x] Implement logout with token blacklisting (in-memory) → **Rafael** ✅
- [x] POST /api/auth/change-password → **Rafael** ✅

**2FA Implementation:** → **Gustavo**
- [x] Generate TOTP secret on user registration → **Gustavo** ✅
- [x] Implement TOTP verification → **Gustavo** ✅
- [x] Return JWT after successful 2FA → **Gustavo** ✅
- [x] POST /api/auth/2fa/setup → **Gustavo** ✅
- [x] POST /api/auth/2fa/confirm → **Gustavo** ✅
- [x] QR code real em base64 PNG (Google Authenticator) → **Rafael** ✅

**Authorization:** → decisão de produto
- [x] Todos os usuários são **admin** com acesso total ao dashboard → decisão confirmada ✅
- [ ] RBAC granular (manager/seller/viewer) → **pós-MVP se necessário**

**API Endpoints:**
- [x] POST /api/auth/register (bootstrap: sem auth se DB vazio) → **Rafael** ✅
- [x] POST /api/auth/login → **Rafael** ✅
- [x] POST /api/auth/verify-2fa → **Gustavo** ✅
- [x] POST /api/auth/refresh-token → **Rafael** ✅
- [x] POST /api/auth/logout (blacklist token) → **Rafael** ✅
- [x] GET /api/auth/me (current user) → **Rafael** ✅
- [x] POST /api/auth/2fa/setup → **Gustavo** ✅
- [x] POST /api/auth/2fa/confirm → **Gustavo** ✅
- [x] POST /api/auth/change-password → **Rafael** ✅
- [x] GET /api/users → **Rafael** ✅
- [x] GET /api/users/me → **Rafael** ✅
- [x] GET /api/users/:id → **Rafael** ✅
- [x] PATCH /api/users/:id/deactivate → **Rafael** ✅

**Testing:** → **Peu**
- [ ] Test registration flow → **Peu**
- [ ] Test login + 2FA flow → **Peu**
- [ ] Test token refresh → **Peu**
- [ ] Test authorization (seller can't see other seller's data) → **Peu**
- [ ] Test role-based access → **Peu**

**Effort:** 1 backend dev, 3-4 days  
**Success Criteria:**
- ✅ User can register (admin)
- ✅ User can login with email/password
- ✅ 2FA works with authenticator app
- ✅ Tokens refresh automatically
- ✅ Role-based authorization enforced

---

### 1.5 Core API Endpoints - Orders (Days 5-8)
**Priority:** P0 - BLOCKER

**Orders CRUD:** → **Rafael**
- [x] POST /api/pedidos (create new order) → **Rafael** ✅
  - [x] Validate input with Pydantic → **Rafael** ✅
  - [x] Calculate economia (valor_venda - custo_produto_final - custo_servico) → **Rafael** ✅
  - [x] Create in pedidos table → **Rafael** ✅
  - [x] Track in audit_logs → **Rafael** ✅
- [x] GET /api/pedidos (list with filters, pagination) → **Rafael** ✅
  - [x] Filter by status, date range, vendor, store → **Rafael** ✅
  - [x] Pagination (page, limit) → **Rafael** ✅
  - [x] Sorting (by date, status, value) → **Rafael** ✅
  - [x] Exclude soft-deleted records (WHERE deleted_at IS NULL) → **Rafael** ✅
- [x] GET /api/pedidos/:id (get order details) → **Rafael** ✅
  - [x] Return complete order with items and costs → **Rafael** ✅
  - [x] Include status history → **Rafael** ✅
- [x] PUT /api/pedidos/:id (update order) → **Rafael** ✅
  - [x] Validate business rules → **Rafael** ✅
  - [x] Track changes in audit_logs → **Rafael** ✅
- [x] PATCH /api/pedidos/:id/status (change status only) → **Rafael** ✅
  - [x] Validate status transition is allowed → **Rafael** ✅
  - [x] Record in status_history table → **Rafael** ✅
  - [x] Track in audit_logs → **Rafael** ✅
- [x] DELETE /api/pedidos/:id (soft delete) → **Rafael** ✅
  - [x] Set deleted_at = NOW() → **Rafael** ✅
  - [x] Record deletion in audit_logs → **Rafael** ✅

**Order Items:** → **Gustavo**
- [ ] POST /api/orders/:id/items (add item to order) → **Gustavo**
- [ ] PATCH /api/orders/:id/items/:itemId/status (update item status) → **Gustavo**
- [ ] DELETE /api/orders/:id/items/:itemId (remove item) → **Gustavo**

**Order Costs:** → **Peu**
- [ ] POST /api/orders/:id/costs (set costs 1:1) → **Peu**
- [ ] PUT /api/orders/:id/costs (update costs) → **Peu**
- [ ] Calculate financial totals and margins → **Peu**

**Order Payments:** → **Peu**
- [ ] POST /api/orders/:id/payment-methods → **Peu**
- [ ] Track multiple payment methods per order → **Peu**

**Business Logic Validation:** → **Rafael**
- [x] Unique numero_nf per store (UNIQUE constraint enforced via DB) → **Rafael** ✅
- [x] One status per order → **Rafael** ✅
- [x] Status livre (qualquer → qualquer, sem restrição de transição) → **Rafael** ✅
- [x] Cannot delete order with RMA (FK constraint) → **Duda** ✅
- [x] Financial values must be DECIMAL(12,2) → **Rafael** ✅

**Testing:** → **Gustavo + Peu**
- [ ] Test complete order creation flow → **Gustavo**
- [ ] Test all CRUD operations → **Gustavo**
- [ ] Test soft delete and recovery → **Peu**
- [ ] Test status transitions → **Peu**
- [ ] Test audit logging → **Gustavo**
- [ ] Test pagination and filtering → **Peu**

**Effort:** 2 backend devs, 3-4 days  
**Success Criteria:**
- ✅ All CRUD endpoints working
- ✅ Status history tracked
- ✅ Audit logs captured
- ✅ Soft deletes functional
- ✅ Business rules enforced

---

### 1.6 Core API Endpoints - Quotes & RMA (Days 7-9)
**Priority:** P0 - BLOCKER

**Quotes API:** → **Gustavo**
- [ ] POST /api/quotes (create quote) → **Gustavo**
- [ ] GET /api/quotes (list quotes) → **Gustavo**
- [ ] GET /api/quotes/:id (quote details) → **Gustavo**
- [ ] PUT /api/quotes/:id (update quote) → **Gustavo**
- [ ] PATCH /api/quotes/:id/phase (update phase) → **Gustavo**
- [ ] DELETE /api/quotes/:id (soft delete) → **Gustavo**
- [ ] POST /api/quotes/:id/convert (convert quote to order) → **Gustavo**

**Quote Items:** → **Peu**
- [ ] POST /api/quotes/:id/items → **Peu**
- [ ] DELETE /api/quotes/:id/items/:itemId → **Peu**

**RMA API:** → **Duda**
- [ ] POST /api/rma (create from existing order) → **Duda**
- [ ] GET /api/rma (list RMA requests) → **Duda**
- [ ] GET /api/rma/:id (RMA details) → **Duda**
- [ ] PATCH /api/rma/:id/items/:itemId/status → **Duda**
- [ ] PATCH /api/rma/:id/close (complete RMA) → **Duda**

**Testing:** → **Peu**
- [ ] Quote creation works → **Peu**
- [ ] Quote conversion to order works → **Peu**
- [ ] RMA creation from order works → **Peu**
- [ ] RMA status tracking works → **Peu**
- [ ] All audit trails captured → **Duda**

**Effort:** 2 backend devs, 2-3 days  
**Success Criteria:**
- ✅ All endpoints working
- ✅ Conversion logic correct
- ✅ Audit trails complete

---

### 1.7 Audit & Compliance Features (Days 8-10)
**Priority:** P0 - BLOCKER (LGPD Requirement)

**Status History Tracking:** → **Rafael** ✅ (implementado junto com Orders)
- [x] Insert into status_history on every status change → **Rafael** ✅
- [x] Track entity_type, entity_id, old_status, new_status → **Rafael** ✅
- [x] Record changed_by (user) and reason → **Rafael** ✅
- [ ] Verify data in status_history table → **Peu**

**Audit Log Implementation:** → **Rafael**
- [x] Insert into audit_logs on CREATE → **Rafael** ✅
- [x] Insert into audit_logs on UPDATE → **Rafael** ✅
  - [x] Store old_values as JSONB → **Rafael** ✅
  - [x] Store new_values as JSONB → **Rafael** ✅
- [x] Insert into audit_logs on DELETE (soft delete) → **Rafael** ✅
- [ ] Capture ip_address and user_agent → **Rafael**
- [ ] Set 6+ month retention policy → **Rafael**

**LGPD Data Export API (Preparation):** → **Duda**
- [ ] Design GET /api/users/:id/data-export endpoint (returns all user's data) → **Duda**
- [ ] Design GET /api/orders/:id/history endpoint (returns all changes) → **Duda**
- [ ] Include audit_logs in exports → **Duda**

**LGPD Data Deletion API (Preparation):** → **Gustavo**
- [ ] Design POST /api/users/:id/delete-data endpoint → **Gustavo**
- [ ] Soft-delete all user's records → **Gustavo**
- [ ] Anonymize personal data → **Gustavo**

**Verification:** → **Peu**
- [ ] All CRUD operations create audit trail → **Peu**
- [ ] Status changes recorded in status_history → **Peu**
- [ ] Old/new values captured in audit_logs → **Peu**
- [ ] IP addresses logged → **Peu**
- [ ] Data exports return complete history → **Duda**

**Effort:** 1 backend dev, 2-3 days  
**Success Criteria:**
- ✅ Status history working for all entities
- ✅ Audit logs capturing all changes
- ✅ Data export API ready
- ✅ LGPD compliance ready

---

### 1.8 API Testing & Documentation (Days 9-10)
**Priority:** P1 - Required for MVP

**Unit Tests:** → **Rafael + Gustavo**
- [ ] Write tests for all models → **Rafael**
- [ ] Write tests for all services → **Gustavo**
- [ ] Achieve 70%+ code coverage → **Rafael + Gustavo**

**Integration Tests:** → **Duda + Peu**
- [ ] Test complete order creation flow → **Duda**
- [ ] Test authentication + authorization → **Peu**
- [ ] Test soft delete flow → **Duda**
- [ ] Test audit logging → **Peu**
- [ ] Test pagination and filtering → **Duda**

**API Documentation:** → **Peu**
- [ ] Create Swagger/OpenAPI documentation → **Peu**
- [ ] Document all endpoints with examples → **Peu**
- [ ] Document error responses → **Peu**
- [ ] Document authentication requirements → **Peu**

**Performance Tests:** → **Rafael**
- [ ] Measure API response times (target: <200ms) → **Rafael**
- [ ] Load test with 100 concurrent users → **Rafael**
- [ ] Monitor database query performance → **Rafael**

**Effort:** 2 backend devs, 1-2 days  
**Success Criteria:**
- ✅ 70%+ test coverage
- ✅ All endpoints documented
- ✅ Performance targets met
- ✅ No SQL injection vulnerabilities

---

## Phase 2: Frontend-Backend Integration (Weeks 4-5)

### 2.1 API Client Setup (Days 1-2)
**Priority:** P0 - BLOCKER

**Frontend Team Tasks:** → **Peu**
- [ ] Create API client module (src/api/) → **Peu**
- [ ] Configure axios with interceptors → **Gustavo**
  - [ ] Auto-attach Authorization header → **Gustavo**
  - [ ] Auto-refresh tokens on 401 → **Gustavo**
  - [ ] Retry failed requests → **Gustavo**
- [ ] Implement error handling → **Peu**
- [ ] Create API endpoint constants → **Peu**
- [ ] Mock API responses for development → **Duda**

**Effort:** 2 frontend devs, 1-2 days  
**Success Criteria:**
- ✅ API client created
- ✅ Token refresh working
- ✅ Error handling implemented

---

### 2.2 React Query Integration (Days 2-3)
**Priority:** P0 - BLOCKER

**Frontend Team Tasks:** → **Gustavo**
- [ ] Install and configure React Query → **Gustavo**
- [ ] Create custom hooks (useOrders, useQuotes, useRMA) → **Gustavo**
- [ ] Set up caching strategy → **Gustavo**
- [ ] Implement mutations (useCreateOrder, useUpdateOrder, etc.) → **Peu**
- [ ] Handle loading and error states → **Peu**

**Effort:** 2 frontend devs, 1-2 days  
**Success Criteria:**
- ✅ React Query configured
- ✅ Custom hooks working
- ✅ Data fetching functional

---

### 2.3 Modal Integration (Days 3-5)
**Priority:** P0 - BLOCKER

**Frontend Team Tasks:**
- [ ] Update OrderModal to call API → **Duda**
  - [ ] POST /api/orders on submit → **Duda**
  - [ ] Handle loading state → **Duda**
  - [ ] Display error messages → **Duda**
  - [ ] Show success notification → **Duda**
- [ ] Update QuoteModal to call API → **Rafael**
- [ ] Update RmaModal to call API → **Peu**
- [ ] Implement optimistic updates (UI updates before API confirms) → **Gustavo**
- [ ] Implement refetch on success → **Gustavo**

**Effort:** 2 frontend devs, 2-3 days  
**Success Criteria:**
- ✅ All modals calling API
- ✅ Errors displayed to user
- ✅ Success notifications shown
- ✅ UI remains responsive

---

### 2.4 List View Integration (Days 5-7)
**Priority:** P0 - BLOCKER

**Frontend Team Tasks:**
- [ ] Update Sales page to fetch orders from API → **Rafael**
  - [ ] Implement filtering → **Rafael**
  - [ ] Implement pagination → **Rafael**
  - [ ] Implement sorting → **Rafael**
  - [ ] Show loading skeleton → **Duda**
- [ ] Update Dashboard to fetch analytics from API → **Gustavo**
- [ ] Implement real-time updates (refetch on interval) → **Gustavo**
- [ ] Display order status history in UI → **Duda**

**Effort:** 2 frontend devs, 2-3 days  
**Success Criteria:**
- ✅ Lists fetch from API
- ✅ Filtering/pagination working
- ✅ Real-time updates functional
- ✅ All UI features operational

---

### 2.5 End-to-End Testing (Days 7-10)
**Priority:** P1 - Required for MVP

**Frontend Team Tasks:**
- [ ] Write E2E tests for critical flows
  - [ ] User login → create order → view order
  - [ ] Create quote → convert to order
  - [ ] Create RMA from order
- [ ] Test error scenarios
- [ ] Test on different browsers
- [ ] Performance test (page load time < 3 seconds)

**Effort:** 2 frontend devs, 2-3 days  
**Success Criteria:**
- ✅ Critical flows tested
- ✅ Cross-browser compatibility verified
- ✅ Performance targets met

---

## Phase 2.5: Audit & Compliance (Weeks 5-6)

### 2.5.1 Status History UI (Days 1-3)
**Priority:** P1 - MVP Feature

**Frontend Tasks:** → **Duda**
- [ ] Create StatusHistory component → **Duda**
- [ ] Show timeline of all status changes → **Duda**
- [ ] Display: who changed it, when, and why → **Duda**
- [ ] Add to order details page → **Duda**

**Backend Tasks:** → **Peu**
- [ ] GET /api/orders/:id/history endpoint → **Peu**
- [ ] Return status_history records → **Peu**
- [ ] Include user info (who made change) → **Peu**

**Effort:** 1 frontend + 1 backend dev, 2 days  
**Success Criteria:**
- ✅ Status history visible in UI
- ✅ Timeline shows all changes
- ✅ User info displayed

---

### 2.5.2 Audit Log Viewer (Days 3-5)
**Priority:** P1 - MVP Feature

**Frontend Tasks:** → **Gustavo**
- [ ] Create AuditLog component → **Gustavo**
- [ ] Show all changes to an entity → **Gustavo**
- [ ] Display old values vs new values → **Gustavo**
- [ ] Add to admin panel → **Gustavo**

**Backend Tasks:** → **Rafael**
- [ ] GET /api/orders/:id/audit endpoint → **Rafael**
- [ ] Return audit_logs records with full details → **Rafael**
- [ ] Include JSONB diffs → **Rafael**

**Effort:** 1 frontend + 1 backend dev, 2 days  
**Success Criteria:**
- ✅ Audit logs visible
- ✅ Changes clearly displayed
- ✅ Diffs formatted nicely

---

### 2.5.3 LGPD Data Export (Days 5-7)
**Priority:** P1 - LGPD Requirement

**Backend Tasks:** → **Duda**
- [ ] Implement GET /api/users/:id/data-export → **Duda**
- [ ] Return JSON with all user's data → **Duda**
- [ ] Include all audit logs → **Duda**
- [ ] Download as JSON file → **Duda**

**Frontend Tasks:** → **Duda**
- [ ] Create data export button → **Duda**
- [ ] Call API and download file → **Duda**
- [ ] Show success message → **Duda**

**Effort:** 1 backend + 1 frontend dev, 2 days  
**Success Criteria:**
- ✅ Data export working
- ✅ File contains all user data
- ✅ Download functional

---

### 2.5.4 Data Deletion (Days 7-10)
**Priority:** P1 - LGPD Requirement

**Backend Tasks:** → **Gustavo**
- [ ] Implement POST /api/users/:id/delete-data → **Gustavo**
- [ ] Soft-delete all user's records → **Gustavo**
- [ ] Anonymize personal info → **Gustavo**
- [ ] Keep audit trail → **Gustavo**

**Frontend Tasks:** → **Peu**
- [ ] Create delete account form → **Peu**
- [ ] Require confirmation → **Peu**
- [ ] Require password verification → **Peu**
- [ ] Show confirmation message → **Peu**

**Effort:** 1 backend + 1 frontend dev, 2-3 days  
**Success Criteria:**
- ✅ Account deletion working
- ✅ Data protected via soft delete
- ✅ Audit trail preserved

---

## Phase 2.6: Dashboard & Financial Management (Weeks 6-7)

### 2.6.1 Dashboard Backend APIs
**Priority:** P1 - Required for MVP

**Backend Team Tasks:**
- [ ] GET /api/dashboard/kpis - Retrieve KPI metrics for period → **Rafael**
  - [ ] Revenue (total, by company, by seller) → **Rafael**
  - [ ] Costs (total, by category: purchase tax, sales tax, other) → **Rafael**
  - [ ] Profit (total, by company, by seller) → **Rafael**
  - [ ] Margin % (profit/revenue) → **Rafael**
  - [ ] Sales count → **Rafael**
  - [ ] Ticket average (revenue/sales, cost/sales, profit/sales) → **Rafael**
  - [ ] Cancellation tracking (count, value lost) → **Rafael**
  - [ ] Today's revenue → **Rafael**
- [ ] GET /api/dashboard/goals - Retrieve sales targets for period → **Gustavo**
- [ ] POST /api/dashboard/goals - Create/update sales target → **Gustavo**
- [ ] DELETE /api/dashboard/goals/:key - Delete sales target → **Gustavo**
- [ ] GET /api/dashboard/projections - Calculate daily targets → **Gustavo**
  - [ ] Remaining business days → **Gustavo**
  - [ ] Elapsed business days → **Gustavo**
  - [ ] Daily average → **Gustavo**
  - [ ] Projection for month → **Gustavo**
  - [ ] Dynamic daily target to meet goal → **Gustavo**
- [ ] GET /api/dashboard/breakdown-by-company - Per-company KPIs → **Rafael**
- [ ] GET /api/dashboard/breakdown-by-seller - Per-seller KPIs → **Rafael**
- [ ] Implement date range filtering (month or custom range) → **Rafael**
- [ ] Filter by company (all, Lucky Store, BTech, AJJ) → **Rafael**

**Effort:** 1 backend dev, 3-4 days  
**Success Criteria:**
- ✅ All KPI endpoints return correct data
- ✅ Filtering works (company, date range)
- ✅ Goals CRUD working
- ✅ Projections calculated correctly
- ✅ API response time <200ms

---

### 2.6.2 Financial Management Backend (Expenses & Penalties)
**Priority:** P2 - Required after MVP

**Backend Team Tasks:** → **Duda**
- [ ] Implement Expense model (predicted vs paid) → **Duda**
- [ ] POST /api/expenses - Create expense → **Duda**
- [ ] PATCH /api/expenses/:id - Update expense → **Duda**
- [ ] DELETE /api/expenses/:id - Delete expense → **Duda**
- [ ] GET /api/expenses - List with filtering → **Duda**
- [ ] Expense installment plan support (credit card payments) → **Duda**
- [ ] Calculate penalty and interest on orders → **Duda**
- [ ] GET /api/calendar/entries - Financial calendar → **Duda**
  - [ ] Return expense entries → **Duda**
  - [ ] Return order penalties → **Duda**
  - [ ] Return order interest → **Duda**
  - [ ] Return installment entries → **Duda**

**Effort:** 1 backend dev, 4-5 days  
**Success Criteria:**
- ✅ Expenses can be created/updated/deleted
- ✅ Installment plans working
- ✅ Calendar entries calculated correctly
- ✅ Penalties and interest computed

---

### 2.6.3 Dashboard Frontend Components
**Priority:** P1 - Required for MVP

**Frontend Team Tasks:**
- [ ] Create Dashboard.tsx page (already exists, enhance) → **Duda**
  - [ ] KPI cards layout → **Duda**
  - [ ] Month/year selector → **Duda**
  - [ ] Date range picker → **Duda**
  - [ ] Company filter tabs → **Duda**
  - [ ] View mode toggle (company vs seller) → **Duda**
- [ ] Create KPI cards component → **Peu**
  - [ ] Revenue card with today's total → **Peu**
  - [ ] Profit card (with color: green if positive, red if negative) → **Peu**
  - [ ] Margin % card → **Peu**
  - [ ] Sales count card → **Peu**
  - [ ] Cancellations card → **Peu**
  - [ ] Target achievement % card → **Peu**
  - [ ] Projection card → **Peu**
  - [ ] Gap to target card → **Peu**
  - [ ] Dynamic daily target card → **Peu**
  - [ ] Average ticket cards → **Peu**
- [ ] Create Pie chart (cost composition) → **Duda**
  - [ ] Purchase tax → **Duda**
  - [ ] Sales tax → **Duda**
  - [ ] Other costs → **Duda**
- [ ] Create Bar chart (ticket comparison) → **Duda**
  - [ ] Ticket sale average → **Duda**
  - [ ] Ticket cost average → **Duda**
  - [ ] Ticket profit average → **Duda**
- [ ] Create breakdown tables → **Peu**
  - [ ] Per-company breakdown (all metrics) → **Peu**
  - [ ] Per-seller breakdown (all metrics) → **Peu**
- [ ] Implement filtering logic → **Duda**
  - [ ] Filter by month or date range → **Duda**
  - [ ] Filter by company → **Duda**
  - [ ] Toggle between company/seller views → **Duda**
- [ ] Implement goal management modal → **Peu**
  - [ ] Display existing goals → **Peu**
  - [ ] Add new goal → **Peu**
  - [ ] Edit goal → **Peu**
  - [ ] Delete goal → **Peu**

**Effort:** 2 frontend devs, 4-5 days  
**Success Criteria:**
- ✅ Dashboard displays all KPIs
- ✅ Charts render correctly
- ✅ Filtering works
- ✅ Goal management modal working
- ✅ Real-time updates on filter change
- ✅ Responsive on mobile

---

### 2.6.4 Financial Calendar (Post-MVP Enhancement)
**Priority:** P2 - Nice to have

**Frontend Team Tasks:**
- [ ] Create Financial Calendar page
  - [ ] Calendar view of month
  - [ ] Color-coded entries (expense, payment, penalty, interest)
  - [ ] Click to view details
  - [ ] Monthly summary
- [ ] Display expense entries
- [ ] Display order penalties (MULTA)
- [ ] Display order interest (JUROS)
- [ ] Display installment entries

**Effort:** 1 frontend dev, 3-4 days  
**Success Criteria:**
- ✅ Calendar rendering all entries
- ✅ Color coding working
- ✅ Details view working

---

### 2.6.5 Goal Management UI
**Priority:** P1 - Required for MVP

**Frontend & Backend Tasks:**
- [ ] Goals modal in Dashboard
  - [ ] Create goal for any month/year
  - [ ] Set target value (R$)
  - [ ] Set floor value (R$) - optional threshold
  - [ ] Save goal
  - [ ] View all goals in table
  - [ ] Delete goal
- [ ] Store goals persistently
- [ ] Use goals for KPI calculations
  - [ ] % of target achieved
  - [ ] Gap to target
  - [ ] Dynamic daily target
  - [ ] Projection vs target

**Effort:** 1 backend + 1 frontend dev, 2 days  
**Success Criteria:**
- ✅ Goals can be created/viewed/deleted
- ✅ Goals affect KPI calculations
- ✅ UI shows goal progress
- ✅ Persistent storage working

---

## Phase 3: Testing & Quality (Weeks 6-7)

### 3.1 Comprehensive Testing
**Priority:** P1 - Required for MVP

**Backend Testing:**
- [ ] Unit tests (70%+ coverage) → **Rafael + Gustavo**
- [ ] Integration tests (all API flows) → **Duda + Peu**
- [ ] Security tests (SQL injection, XSS, CSRF) → **Rafael + Duda**
- [ ] Database tests (constraints, transactions) → **Rafael**

**Frontend Testing:**
- [ ] Component tests (all components) → **Duda + Peu**
- [ ] Integration tests (API calls) → **Gustavo + Peu**
- [ ] E2E tests (critical user flows) → **Peu**
- [ ] Accessibility tests (WCAG compliance) → **Gustavo**

**Effort:** 4 devs, 5 days  
**Success Criteria:**
- ✅ 80%+ test coverage
- ✅ All security tests pass
- ✅ No critical bugs

---

### 3.2 Performance Optimization
**Priority:** P1 - Required for MVP

**Database:**
- [ ] Analyze slow queries
- [ ] Optimize indexes
- [ ] Add materialized views if needed
- [ ] Target: <200ms for API responses

**Frontend:**
- [ ] Bundle size optimization
- [ ] Code splitting
- [ ] Lazy loading components
- [ ] Target: <3 second page load

**Effort:** 4 devs, 3 days  
**Success Criteria:**
- ✅ API response time <200ms
- ✅ Page load time <3 seconds
- ✅ No Lighthouse issues

---

### 3.3 Security Hardening
**Priority:** P1 - Required for MVP

**Backend:**
- [ ] Enable CORS headers properly
- [ ] Implement rate limiting
- [ ] Add request validation
- [ ] Encrypt sensitive data in DB

**Frontend:**
- [ ] Content Security Policy
- [ ] XSS prevention
- [ ] CSRF tokens

**Effort:** 2 backend devs, 3 days  
**Success Criteria:**
- ✅ No OWASP Top 10 vulnerabilities
- ✅ Security headers in place
- ✅ Passes security audit

---

## Phase 4: Deployment & Operations (Weeks 7-8)

### 4.1 CI/CD Pipeline
**Priority:** P1 - Required for MVP

**DevOps Tasks:** → **Rafael**
- [ ] Set up GitHub Actions → **Rafael**
- [ ] Run tests on every push → **Rafael**
- [ ] Build Docker images → **Rafael**
- [ ] Automated deployment to staging → **Rafael**

**Effort:** 1 DevOps + 1 backend dev, 3 days  
**Success Criteria:**
- ✅ Tests run automatically
- ✅ Deployment automated
- ✅ Zero-downtime deployments

---

### 4.2 Production Database Setup
**Priority:** P1 - Required for MVP

**DevOps Tasks:** → **Gustavo**
- [ ] Criar projeto Railway + PostgreSQL service → **Gustavo**
- [ ] Configurar variáveis de ambiente no Railway → **Gustavo**
- [ ] Rodar `railway run alembic upgrade head` → **Gustavo**
- [ ] Verificar backups automáticos Railway → **Gustavo**
- [ ] Test disaster recovery → **Gustavo**

**Effort:** 1 DevOps dev, 3 days  
**Success Criteria:**
- ✅ Production DB running
- ✅ Backups working
- ✅ Monitoring alerts set up

---

### 4.3 Frontend Deployment
**Priority:** P1 - Required for MVP

**DevOps Tasks:** → **Peu**
- [ ] Deploy to Vercel → **Peu**
- [ ] Set up CDN → **Peu**
- [ ] Configure SSL → **Peu**
- [ ] Set up monitoring → **Peu**

**Effort:** 1 DevOps dev, 2 days  
**Success Criteria:**
- ✅ Frontend live
- ✅ SSL working
- ✅ CDN configured

---

### 4.4 Production Monitoring
**Priority:** P1 - Required for MVP

**DevOps Tasks:** → **Duda**
- [ ] Set up Sentry for error tracking → **Duda**
- [ ] Set up DataDog for metrics → **Duda**
- [ ] Configure alerts → **Duda**
- [ ] Set up log aggregation → **Duda**

**Effort:** 1 DevOps dev, 2 days  
**Success Criteria:**
- ✅ Error tracking working
- ✅ Metrics being collected
- ✅ Alerts configured

---

## Phase 5: Post-MVP Features (Weeks 9-24)

### 5.1 Advanced Features (Weeks 9-12)
- [ ] Advanced analytics (forecasting, trends)
- [ ] Financial Manager (complete expense tracking)
- [ ] Bulk operations (import/export)
- [ ] Notifications (email, push)
- [ ] Mobile app (React Native or PWA)

### 5.2 Integrations (Weeks 13-16)
- [ ] Email service (SendGrid, AWS SES)
- [ ] Payment gateway (Stripe)
- [ ] Shipping integration (tracking)
- [ ] Accounting system (QuickBooks)

### 5.3 ML & Automation (Weeks 17-20)
- [ ] Predictive analytics (sales forecasting)
- [ ] Automated recommendations
- [ ] Price optimization
- [ ] Fraud detection

### 5.4 Scaling & Enhancement (Weeks 21-24)
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Mobile app launch
- [ ] Full release to customers

---

## Success Criteria - MVP (Week 10)

### ✅ Backend
- [ ] All core APIs working (Orders, Quotes, RMA)
- [ ] Authentication + 2FA functional
- [ ] Status history tracking all changes
- [ ] Audit logs capturing full change details
- [ ] Soft deletes working (data recoverable)
- [ ] 70%+ test coverage
- [ ] API response time <200ms
- [ ] No security vulnerabilities
- [ ] Deployed to staging environment

### ✅ Frontend
- [ ] All modals connected to API
- [ ] Real-time data from backend
- [ ] Pagination and filtering working
- [ ] Status history visible
- [ ] Error handling complete
- [ ] 70%+ test coverage
- [ ] Page load time <3 seconds
- [ ] Cross-browser compatible
- [ ] Deployed to production

### ✅ Database
- [ ] All tables created correctly
- [ ] Audit trail complete
- [ ] Soft deletes functional
- [ ] Backup system working
- [ ] Performance targets met

### ✅ Operations
- [ ] CI/CD pipeline working
- [ ] Production monitoring set up
- [ ] Disaster recovery tested
- [ ] Team trained on system

---

## Resource Allocation

### Week 1-3: Backend Foundation
- **Backend Team (2 devs):** Database setup, authentication, Orders API
- **Frontend Team (2 devs):** API client setup, React Query setup

### Week 4-5: Integration
- **Backend Team (1 dev):** Quotes/RMA APIs, audit logging
- **Backend Team (1 dev):** API testing, documentation
- **Frontend Team (2 devs):** Modal integration, list views

### Week 6-7: Testing
- **All 4 devs:** Testing, security hardening, performance optimization

### Week 8: Deployment
- **Backend Team (1 dev):** CI/CD setup, monitoring
- **Frontend Team (1 dev):** Frontend deployment, CDN
- **All 4 devs:** Final testing, documentation

---

## Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Backend language decision delayed | ~~High~~ RESOLVED | High | Python FastAPI chosen |
| Database performance issues | Medium | High | Indexes designed, load testing planned |
| Integration bugs in week 4 | Medium | High | Comprehensive API testing in week 3 |
| Scope creep (more features added) | High | High | Strict backlog management, Phase 2 = post-MVP |
| Team skill gaps (new tech) | Medium | Medium | Training planned, documentation comprehensive |
| Production issues post-launch | Medium | High | Monitoring, backups, disaster recovery ready |

---

## Critical Path

```
Week 1 ─→ Week 2 ─→ Week 3 ─→ Week 4 ─→ Week 5 ─→ ... ─→ Week 10
 │         │         │         │         │
 ├─DB     ├─Auth   ├─Orders  ├─Quotes ├─Testing
 ├─Setup   ├─ORM    ├─Items   ├─RMA    ├─Monitoring
 ├─Tests   ├─Models ├─Test    ├─Audit  └─Deploy MVP
 └─Verify  └─Login  └─Deploy  └─Frontend
            (blocking everything else)

Any delay in Week 1-3 → Delays Week 10 launch
```

---

## Documentation Files

| File | Status | Purpose |
|------|--------|---------|
| DATABASE_INIT.sql | ✅ Ready | PostgreSQL schema |
| DATABASE_SETUP_GUIDE.md | ✅ Ready | Setup & verification |
| DATABASE_SCHEMA_REFACTORED.md | ✅ Ready | Technical reference |
| DATABASE_REFACTORING_GUIDE.md | ✅ Ready | Migration guide |
| DATABASE_FILES_INDEX.md | ✅ Ready | Navigation guide |
| BACKLOG.md | ✅ Updated | This file |
| ARCHITECTURE.md | 🔄 Updating | System design |
| DEVELOPMENT_ROADMAP.md | 🔄 Updating | Day-by-day tasks |
| IMPLEMENTATION_GUIDE.md | 🔄 Updating | Code examples |
| QUICK_REFERENCE.md | 🔄 Updating | Quick lookup |

---

## Next Week Actions

- [x] **CRITICAL:** Decide backend language → Python FastAPI
- [x] **CRITICAL:** Decide backend language → Python FastAPI ✅
- [x] **CRITICAL:** Set up PostgreSQL + conectar banco ✅
- [x] **CRITICAL:** Servidor FastAPI rodando (localhost:8000/docs) ✅
- [x] **CRITICAL:** Alembic configurado com baseline ✅
- [x] **CRÍTICO:** Auth completo (login, 2FA, blacklist, change-password) ✅
- [x] **CRÍTICO:** ORM models 100% gerados ✅
- [x] **CRÍTICO:** Orders CRUD completo (6 endpoints) ✅
- [x] **CRÍTICO:** Audit log + status history integrados aos pedidos ✅
- [ ] **PRÓXIMO:** Merge feature/orm-models → develop
- [ ] **PRÓXIMO:** Merge feature/auth-middleware → develop (PR aberto)
- [ ] **PRÓXIMO:** Push + PR feature/orders-api → develop
- [ ] **PRÓXIMO:** Quotes & RMA API (1.6) → Gustavo + Duda
- [ ] **PRÓXIMO:** Frontend team: API client setup (2.1)

---

## Updated Document Status

✅ **Complete & Ready:**
- BACKLOG.md (this file)
- DATABASE_INIT.sql
- DATABASE_SETUP_GUIDE.md
- DATABASE_SCHEMA_REFACTORED.md
- DATABASE_REFACTORING_GUIDE.md
- DATABASE_FILES_INDEX.md

🔄 **Being Updated Today:**
- ARCHITECTURE.md
- DEVELOPMENT_ROADMAP.md
- DOCUMENTATION_SUMMARY.md
- IMPLEMENTATION_GUIDE.md
- QUICK_REFERENCE.md

---

**Last Updated:** April 29, 2026  
**Status:** 🚀 ORM models 100% + Auth completo + Orders CRUD funcionando  
**Next Milestone:** Merge branches → develop; Quotes & RMA API (1.6)  
**MVP Target:** Week 10 (8-10 weeks)
