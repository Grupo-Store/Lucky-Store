# Orderly Hub - Development Roadmap 2026

## Project Timeline Overview

**Total Duration:** 8-10 weeks for MVP, 20-24 weeks for full release  
**Team:** 4 Developers (2 Backend, 2 Frontend)  
**Start Date:** Week 1 (April 22, 2026)  
**MVP Target:** Week 10 (June 24-July 1, 2026)

---

## Week-by-Week Breakdown

### WEEK 1: Foundation & Setup

#### Monday - Database Setup
**Backend Team (2 devs):**
- [ ] Install PostgreSQL 14+ locally
- [ ] Run `psql -U postgres -d orderly_hub -f DATABASE_INIT.sql`
- [ ] Verify all 16 tables created
- [ ] Run verification checklist (DATABASE_SETUP_GUIDE.md)
- [ ] Execute test scenario 1: "Create Test Order"
- [ ] Confirm soft delete works
- **Blocker:** All devs must have working local DB before proceeding

**Frontend Team (2 devs):**
- [ ] Review ARCHITECTURE_2026.md
- [ ] Set up development environment
- [ ] Install dependencies (React Query, Axios)
- [ ] Prepare modals for API integration

**Daily Standup:**
- [ ] Am I blocked? Database issues?
- [ ] Do I need help from other team member?

---

#### Tuesday - Backend Technology Decision & ORM Setup
**Backend Team (2 devs):**
- [ ] **CRITICAL DECISION:** Python FastAPI or Node.js Express?
  - Recommendation: FastAPI if you want speed, Express if team knows JavaScript
- [ ] Initialize backend project
- [ ] Set up development environment (.env, config)
- [ ] Install database ORM:
  - Python: SQLAlchemy + Alembic
  - Node.js: Prisma
- [ ] Generate ORM models from DATABASE_INIT.sql
- [ ] Test database connection

**Frontend Team (2 devs):**
- [ ] Install React Query
- [ ] Create API client module (src/api/)
- [ ] Configure axios with interceptors
- [ ] Create environment variables

---

#### Wednesday - Authentication Setup (Begins)
**Backend Team:**
- [ ] Create User model (ORM)
- [ ] Implement password hashing (bcrypt)
- [ ] Start login endpoint

**Frontend Team:**
- [ ] Create API endpoints constants
- [ ] Start error handling utilities
- [ ] Review LoginScreen component

---

#### Thursday - ORM Models Complete
**Backend Team (2 devs):**
- [ ] Generate all 16 ORM models:
  - Users, Lojas, Vendedores, Clientes
  - Pedidos, Produtos, CustoPedido
  - Frete, RMAs, ItemRMA
  - Cotacoes, ItemCotacao
  - VendaVendedor, CompraVendedor, MetaVendedor
- [ ] Verify all relationships work
- [ ] Test foreign keys and constraints
- [ ] Create first data seeding script

---

#### Friday - Week 1 Demo
**All Team:**
- [ ] Demo: Database running + ORM models working
- [ ] Confirm: No blockers for next week
- [ ] Retrospective: What went well, what to improve
- [ ] Planning: Confirm backend language decision is final

**Success Criteria:**
- ✅ PostgreSQL set up locally (all 4 devs)
- ✅ All 16 ORM models generated
- ✅ Database connection confirmed
- ✅ Backend framework chosen (Python or Node.js)

---

### WEEK 2: Authentication & Core API

#### Monday-Tuesday - Authentication Complete
**Backend Team (2 devs):**
- [ ] POST /api/auth/login (email + password)
- [ ] POST /api/auth/verify-2fa (TOTP code)
- [ ] JWT token generation (1 hour access, 7 days refresh)
- [ ] Password hashing (bcrypt 12 rounds)
- [ ] Test with Postman/Insomnia

**Frontend Team (2 devs):**
- [ ] Connect LoginScreen to API
- [ ] Test login + 2FA flow
- [ ] Store tokens securely

---

#### Wednesday-Thursday - Orders API (CRUD)
**Backend Team:**
- [ ] POST /api/orders (create order)
- [ ] GET /api/orders (list with pagination)
- [ ] GET /api/orders/:id (order details)
- [ ] PUT /api/orders/:id (update)
- [ ] DELETE /api/orders/:id (soft delete)

**Frontend Team:**
- [ ] Create OrderTable component
- [ ] Implement sorting/pagination
- [ ] Add loading states

---

#### Friday - Week 2 Testing
**All Team:**
- [ ] Demo: Login works, Orders CRUD works
- [ ] Run all 5 database test scenarios
- [ ] Verify audit_logs are being created
- [ ] Confirm no errors in production mode

**Success Criteria:**
- ✅ User can login with email + password
- ✅ 2FA works (TOTP)
- ✅ Access token generated
- ✅ Tokens auto-refresh
- ✅ All Orders CRUD endpoints working
- ✅ Audit logs capturing all changes

---

### WEEK 3: Orders API Complete & Testing

#### Monday-Tuesday - Order Items & Status Tracking
**Backend Team:**
- [ ] PATCH /api/orders/:id/status (change status)
  - Record in status_history table
- [ ] POST /api/orders/:id/items (add items)
- [ ] PATCH /api/orders/:id/items/:itemId/status
- [ ] Implement status transition validation
  - To Buy → Bought → Received → etc.

**Frontend Team:**
- [ ] Update OrderModal for API
- [ ] Add status change UI
- [ ] Show status history

---

#### Wednesday-Thursday - Order Costs & Testing
**Backend Team:**
- [ ] POST /api/orders/:id/costs (set costs)
- [ ] Calculate economics (valor_projetado - valor_compra)
- [ ] Write unit tests for OrderService
- [ ] Write integration tests for Orders API

**Frontend Team:**
- [ ] Connect modals to Orders API
- [ ] Test complete order flow
- [ ] Error handling + loading states

---

#### Friday - Week 3 Demo
**All Team:**
- [ ] Demo: Complete order flow (create → items → status changes → costs)
- [ ] Show audit_logs with complete change history
- [ ] Show status_history timeline
- [ ] 100% test coverage for Orders API

**Success Criteria:**
- ✅ Orders CRUD 100% complete
- ✅ Status history tracking working
- ✅ Audit logs complete
- ✅ 70%+ unit test coverage

---

### WEEK 4: Quotes & RMA APIs

#### Monday-Tuesday - Quotes API
**Backend Team:**
- [ ] POST /api/quotes (create quote)
- [ ] GET /api/quotes (list)
- [ ] PUT /api/quotes/:id (update)
- [ ] PATCH /api/quotes/:id/phase (update phase)
- [ ] Quote items management
- [ ] Tests for Quotes API

**Frontend Team:**
- [ ] Connect QuoteModal to API
- [ ] Update Quotes list
- [ ] Show quote phases

---

#### Wednesday-Thursday - RMA API
**Backend Team:**
- [ ] POST /api/rma (create from order)
- [ ] GET /api/rma (list)
- [ ] PATCH /api/rma/:id/items/:itemId/status
- [ ] RMA status tracking
- [ ] Tests for RMA API

**Frontend Team:**
- [ ] Connect RmaModal to API
- [ ] Update RMA list
- [ ] Show RMA status

---

#### Friday - Week 4 Demo
**All Team:**
- [ ] Demo: All three main APIs working (Orders, Quotes, RMA)
- [ ] Show complete flow: create quote → convert to order → create RMA
- [ ] Show audit trail for each entity type

**Success Criteria:**
- ✅ All CRUD APIs complete
- ✅ Quotes and RMA APIs tested
- ✅ Soft deletes working for all entities
- ✅ Status history for all entity types

---

### WEEK 5: Frontend Integration & Audit Features

#### Monday-Tuesday - Complete Frontend Integration
**Frontend Team (2 devs):**
- [ ] Update all modals to use API
- [ ] Update all list views to use API
- [ ] Implement filtering and sorting
- [ ] Add real-time pagination
- [ ] Show loading skeleton screens

**Backend Team:**
- [ ] Implement Quotes → Orders conversion
- [ ] Implement Order → RMA creation
- [ ] Add GET /api/orders/:id/history (status history)
- [ ] Add GET /api/orders/:id/audit (audit logs)

---

#### Wednesday-Thursday - Status History & Audit UI
**Frontend Team:**
- [ ] Create StatusHistory component
- [ ] Create AuditLog viewer component
- [ ] Add to order details page
- [ ] Show timeline of changes
- [ ] Show who made each change

**Backend Team:**
- [ ] Implement GET /api/analytics/summary (dashboard data)
- [ ] Implement GET /api/analytics/orders-by-status
- [ ] Implement GET /api/analytics/revenue

---

#### Friday - Week 5 Integration Test
**All Team:**
- [ ] Demo: End-to-end user flow
  - Login → Create order → Update status → View history → See audit trail
- [ ] Test all filtering and pagination
- [ ] Cross-browser testing

**Success Criteria:**
- ✅ Frontend completely integrated with backend API
- ✅ All CRUD operations working end-to-end
- ✅ Real-time data updates working
- ✅ Audit features visible in UI

---

### WEEK 6: Dashboard & Financial Management

#### Monday - Dashboard Backend APIs
**Backend Team (1 dev):**
- [ ] Implement GET /api/dashboard/kpis
  - [ ] Revenue by company/seller
  - [ ] Profit & margin calculations
  - [ ] Sales count & ticket averages
  - [ ] Cancellation tracking
- [ ] Implement GET /api/dashboard/breakdown-by-company
- [ ] Implement GET /api/dashboard/breakdown-by-seller
- [ ] Implement date range filtering
- [ ] Test all KPI calculations

---

#### Tuesday - Dashboard Goals & Projections Backend
**Backend Team (1 dev):**
- [ ] POST /api/dashboard/goals (create/update target)
- [ ] DELETE /api/dashboard/goals/:key
- [ ] GET /api/dashboard/projections
  - [ ] Calculate remaining business days
  - [ ] Calculate daily average
  - [ ] Calculate month projection
  - [ ] Calculate dynamic daily target
- [ ] Implement financial calculations

---

#### Wednesday - Dashboard Frontend UI (Part 1)
**Frontend Team (2 devs):**
- [ ] Create KPI cards component
  - [ ] Revenue card (with today total)
  - [ ] Profit card (green/red indicator)
  - [ ] Margin % card
  - [ ] Sales count, cancellations, projection
- [ ] Create filter controls
  - [ ] Month/year selector
  - [ ] Date range picker
  - [ ] Company filter tabs
  - [ ] View mode toggle (company vs seller)
- [ ] Wire up filters to API

---

#### Thursday - Dashboard Frontend UI (Part 2)
**Frontend Team (2 devs):**
- [ ] Create visualization charts
  - [ ] Pie chart (cost composition)
  - [ ] Bar chart (ticket comparison)
- [ ] Create breakdown tables
  - [ ] Per-company breakdown
  - [ ] Per-seller breakdown
- [ ] Implement goal management modal
  - [ ] Display goals
  - [ ] Add/edit/delete goals

---

#### Friday - Week 6 Dashboard & Audit Demo
**All Team:**
- [ ] Demo: Complete dashboard
  - Show KPI cards with real data
  - Show charts and visualizations
  - Show filtering/company toggle
  - Show goal management
- [ ] Demo: LGPD compliance features (audit trail)
  - Show status history timeline
  - Show audit log viewer
  - Show who changed what when
- [ ] Performance validation (<200ms API, <3s page load)

**Success Criteria:**
- ✅ Dashboard displaying all KPIs
- ✅ Charts rendering correctly
- ✅ Filtering working (month, date range, company)
- ✅ Goals CRUD working
- ✅ Audit trail complete and visible
- ✅ All APIs responding <200ms
- ✅ Dashboard loads <3 seconds

---

### WEEK 7: Testing & Performance

#### Monday-Tuesday - Comprehensive Testing
**All Team (4 devs):**
- [ ] **Backend Team:**
  - [ ] Unit tests (70%+ coverage)
  - [ ] Integration tests (all API flows including new dashboard APIs)
  - [ ] Test soft delete recovery
  - [ ] Test audit logging
  - [ ] Test KPI calculations with various data
  - [ ] Test goal management endpoints
- [ ] **Frontend Team:**
  - [ ] Component tests (all dashboard components)
  - [ ] Integration tests (API calls with mocked data)
  - [ ] E2E tests (critical flows including dashboard)
  - [ ] Dashboard filtering tests

---

#### Wednesday-Thursday - Security & Performance
**Backend Team:**
- [ ] Security testing (SQL injection, XSS, CSRF)
- [ ] Performance profiling
- [ ] Query optimization
- [ ] API response time < 200ms
- [ ] Load testing (100 concurrent users)

**Frontend Team:**
- [ ] Performance optimization (bundle size)
- [ ] Accessibility testing (WCAG)
- [ ] Cross-browser testing
- [ ] Page load time < 3 seconds

---

#### Friday - Week 7 QA Demo
**All Team:**
- [ ] Demo: All tests passing
- [ ] Demo: Performance metrics meeting targets
- [ ] Demo: Security audit clean
- [ ] Show test coverage reports

**Success Criteria:**
- ✅ 80%+ test coverage
- ✅ API response time <200ms
- ✅ Page load time <3 seconds
- ✅ No security vulnerabilities
- ✅ All critical flows tested

---

### WEEK 8: Deployment & Production Ready

#### Monday - CI/CD Pipeline
**Backend Team (with DevOps support):**
- [ ] Set up GitHub Actions
- [ ] Automated tests on every push
- [ ] Build Docker image
- [ ] Deploy to staging automatically

---

#### Tuesday-Wednesday - Production Database
**DevOps Engineer:**
- [ ] Set up PostgreSQL in cloud (AWS RDS/GCP Cloud SQL)
- [ ] Configure automated daily backups
- [ ] Set up connection pooling (PgBouncer)
- [ ] Test disaster recovery
- [ ] Configure monitoring and alerting

---

#### Wednesday-Thursday - Frontend Deployment
**Frontend Team (with DevOps):**
- [ ] Deploy to Vercel or Netlify
- [ ] Set up CDN for static assets
- [ ] Configure SSL/HTTPS
- [ ] Enable security headers

---

#### Thursday-Friday - Production Monitoring
**DevOps Engineer:**
- [ ] Set up Sentry for error tracking
- [ ] Set up DataDog/New Relic for metrics
- [ ] Configure log aggregation
- [ ] Set up alerts for errors and performance
- [ ] Document operational procedures

---

#### Friday - Week 8 Ready Check
**All Team:**
- [ ] Demo: Deployment pipeline working
- [ ] Demo: Production database operational
- [ ] Demo: Monitoring and alerts configured
- [ ] Final documentation complete

**Success Criteria:**
- ✅ CI/CD pipeline working
- ✅ Production database ready
- ✅ Monitoring in place
- ✅ Disaster recovery tested
- ✅ Team trained on production ops

---

### WEEK 9: Final Polish & Testing

#### Monday-Wednesday - Bug Fixes
**All Team:**
- [ ] Fix any bugs found in production testing
- [ ] Performance tuning if needed
- [ ] Security patch if needed
- [ ] User acceptance testing (UAT)

---

#### Thursday-Friday - Documentation & Training
**All Team:**
- [ ] Complete API documentation
- [ ] Create user guide
- [ ] Create admin guide
- [ ] Train customer support team

---

### WEEK 10: MVP LAUNCH 🚀

#### Monday-Tuesday - Final Testing
**All Team:**
- [ ] Smoke test all critical flows
- [ ] Performance validation
- [ ] Security validation
- [ ] Backup/recovery validation

---

#### Wednesday - Go-Live Preparation
**All Team:**
- [ ] Final database backup
- [ ] Rollback procedures ready
- [ ] On-call schedule set
- [ ] Communication plan ready

---

#### Thursday - LAUNCH DAY
**All Team:**
- [ ] Deploy to production
- [ ] Migrate data (if needed)
- [ ] Monitor continuously
- [ ] Be ready to roll back if issues

---

#### Friday - Post-Launch Support
**All Team:**
- [ ] Monitor for errors
- [ ] Fix any critical issues
- [ ] Communicate with users
- [ ] Celebrate MVP launch! 🎉

---

## Daily Standup Template

Every morning at 10 AM (5 min per person):

```
1. What did I accomplish yesterday?
   - Specific code/tasks completed

2. What will I do today?
   - Next specific tasks

3. Am I blocked?
   - Any issues preventing progress?
   - Do I need help?
```

---

## Sprint Planning (Bi-weekly)

Every other Friday:
1. Retrospective (15 min)
   - What went well?
   - What could improve?
   - Action items?

2. Planning (15 min)
   - Next sprint goals
   - Task breakdown
   - Resource allocation

---

## Critical Dates

- **April 22** - Week 1 starts
- **May 6** - End of Week 2 (MVP Blocker: Auth + Orders working)
- **May 20** - End of Week 4 (All APIs working)
- **June 3** - End of Week 6 (Audit features complete)
- **June 17** - End of Week 8 (Deployment ready)
- **July 1** - End of Week 10 (MVP LAUNCH)

---

## Success Metrics

**By End of Week 3:**
- ✅ Orders CRUD 100% working
- ✅ Status history tracking
- ✅ No critical blockers

**By End of Week 5:**
- ✅ Frontend fully integrated
- ✅ All user flows working
- ✅ Audit features visible

**By End of Week 7:**
- ✅ 80%+ test coverage
- ✅ Performance targets met
- ✅ Zero security issues

**By End of Week 10 (MVP):**
- ✅ All core features deployed
- ✅ Users can fully operate system
- ✅ Audit trail complete
- ✅ LGPD compliance ready
- ✅ Production monitoring live

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Database setup takes too long | Start fresh with DATABASE_INIT.sql, verify with checklist |
| Backend language decision delayed | Vote immediately: FastAPI (speed) vs Express (ecosystem) |
| ORM model generation unclear | Reference DATABASE_SCHEMA_REFACTORED.md for structure |
| Auth endpoint not working | Debug with Postman, check password hashing |
| Status history not tracking | Verify INSERT into status_history on every status change |
| Soft delete showing deleted records | Check WHERE deleted_at IS NULL in all queries |
| Frontend can't connect to API | Verify CORS enabled, check API base URL in env vars |

---

## Post-MVP Roadmap (Weeks 11-24)

| Weeks | Phase | Focus |
|-------|-------|-------|
| 11-12 | Phase 5.1 | Advanced features (dashboard, bulk ops) |
| 13-16 | Phase 5.2 | Integrations (email, payments, shipping) |
| 17-20 | Phase 5.3 | ML & automation |
| 21-24 | Phase 5.4 | Mobile app, multi-language, scaling |

---

**Roadmap Version:** 1.0  
**Last Updated:** April 22, 2026  
**Status:** ✅ Ready to Execute
