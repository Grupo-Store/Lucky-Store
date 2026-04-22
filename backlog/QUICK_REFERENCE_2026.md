# Orderly Hub - Quick Reference 2026

**Status:** ✅ MVP Ready | **Timeline:** 8-10 Weeks | **Team:** 4 Developers (2 Backend, 2 Frontend)

---

## 🎯 At a Glance

| Aspect | Details |
|--------|---------|
| **Start Date** | April 22, 2026 (Monday) |
| **MVP Launch** | June 24-July 1, 2026 (Week 10) |
| **Platform** | B2B Order/Quotes/RMA Management |
| **Users** | 100-500 (Brazil market) |
| **Team** | 2 Backend + 2 Frontend |
| **Tech Stack** | React 18 + FastAPI/Express + PostgreSQL |

---

## 🏗️ Tech Stack

```
Frontend:        React 18 + TypeScript + Vite + Shadcn UI
Backend:         [DECIDE THIS WEEK] FastAPI (Python) OR Express (Node.js)
Database:        PostgreSQL 14+ with UUID primary keys
Authentication:  JWT + TOTP 2FA
ORM:             SQLAlchemy (Python) OR Prisma (Node.js)
Deployment:      Docker + GitHub Actions
Hosting:         AWS / Azure / DigitalOcean / Railway / Render
```

---

## 📊 MVP Features

| Entity | Operations | Status |
|--------|-----------|--------|
| **Orders** | Create, List, Read, Update, Delete, Status tracking | ✅ Core |
| **Quotes** | Create, List, Read, Update, Phase tracking | ✅ Core |
| **RMA** | Create from Order, Status tracking, Item returns | ✅ Core |
| **Dashboard** | KPIs, targets, projections, per-company/seller breakdowns | ✅ Core |
| **Audit Trail** | Status history + Audit logs (JSONB) | ✅ Core |
| **Users** | Login, 2FA (TOTP), RBAC (4 roles) | ✅ Core |
| **Reports** | Monthly/Annual results via views | ✅ Core |
| **LGPD** | Data export/deletion, audit trail | ✅ Core |

---

## 📅 Phase Timeline

| Phase | Weeks | Focus | Success |
|-------|-------|-------|---------|
| **Phase 1** | 1-3 | Backend Infrastructure | Auth + Orders API 100% |
| **Phase 2** | 4-5 | Frontend Integration | All CRUD working end-to-end |
| **Phase 2.5** | 5-6 | Audit & Compliance | LGPD ready |
| **Phase 2.6** | 6-7 | Dashboard & Analytics | KPIs, goals, projections working |
| **Phase 3** | 7 | Testing & Performance | 80%+ coverage, <200ms API |
| **Phase 4** | 8 | Deployment | CI/CD, monitoring ready |
| **Phase 5** | 9-10 | Polish & Launch | 🚀 MVP LIVE |

---

## 🗂️ Database Schema (16 Tables + 2 Audit)

### Main Tables
```
users
├── lojas (stores)
├── vendedores (sellers)
├── clientes (customers)
├── pedidos (orders)
│   ├── pedido_items (order items)
│   ├── custo_pedido (order costs)
│   └── frete (shipping)
├── cotacoes (quotes)
│   └── item_cotacao (quote items)
├── rmas (return requests)
│   └── item_rma (RMA items)
├── venda_vendedor (seller sales tracking)
├── compra_vendedor (seller purchase tracking)
└── meta_vendedor (seller targets)
```

### Audit Tables (NEW)
```
status_history    → Who changed status when (why)
audit_logs        → Complete change history (before/after values)
```

### Views (Reporting)
```
resultado_mensal  → Monthly sales & costs aggregation
resultado_anual   → Annual sales & costs aggregation
```

---

## 💾 Key Database Features

| Feature | Benefit |
|---------|---------|
| **UUID Primary Keys** | Security, privacy, horizontal scaling |
| **Soft Deletes** | Data recovery, compliance |
| **Status History** | Track every status change |
| **Audit Logs (JSONB)** | Complete change history with before/after |
| **Audit Fields** | created_by, updated_at, deleted_at |
| **40+ Indexes** | Performance optimization for queries |
| **CHECK Constraints** | Business rule enforcement at DB level |
| **Decimal(12,2)** | Financial precision (no rounding errors) |

---

## 🔐 Security Architecture

### Authentication Flow
```
1. User enters email + password
   ↓
2. Backend verifies credentials
   ↓
3. If 2FA enabled → Generate session, request TOTP code
   ↓
4. User enters TOTP code
   ↓
5. Backend verifies TOTP
   ↓
6. Return access_token (1h) + refresh_token (7d)
   ↓
7. Frontend stores tokens securely, includes in API calls
```

### Authorization (RBAC)
```
Admin    → Full access to everything
Manager  → Access to store/team data
Seller   → Access to own orders/quotes
Viewer   → Read-only access
```

---

## 📡 API Endpoints (MVP)

### Authentication
```
POST   /api/auth/login              → email + password
POST   /api/auth/verify-2fa         → session_id + TOTP code
POST   /api/auth/refresh-token      → refresh_token
```

### Orders (CRUD + Workflows)
```
POST   /api/orders                   → Create order
GET    /api/orders                   → List with pagination
GET    /api/orders/:id               → Order details
PATCH  /api/orders/:id               → Update
DELETE /api/orders/:id               → Soft delete
PATCH  /api/orders/:id/status        → Change status (records in history)
GET    /api/orders/:id/history       → Status history timeline
GET    /api/orders/:id/audit         → Complete audit trail
```

### Quotes (Similar to Orders)
```
POST   /api/quotes                   → Create quote
GET    /api/quotes                   → List
GET    /api/quotes/:id               → Details
PATCH  /api/quotes/:id               → Update
```

### RMA (Return Management)
```
POST   /api/rma                      → Create from order
GET    /api/rma                      → List
GET    /api/rma/:id                  → Details
PATCH  /api/rma/:id                  → Update status
```

---

## 🎯 Week 1 Critical Tasks (BLOCKER)

### Monday
- [ ] Backend team: PostgreSQL installed locally
- [ ] Run DATABASE_INIT.sql
- [ ] Verify all 16 tables created
- [ ] Run verification checklist

### Tuesday
- [ ] **CRITICAL DECISION:** FastAPI or Express?
- [ ] Initialize backend project
- [ ] Test database connection

### Wednesday-Friday
- [ ] Generate all 16 ORM models
- [ ] Start authentication service
- [ ] Begin Orders API
- [ ] Setup frontend API client

**If these aren't done by Friday → BLOCKER for Week 2**

---

## ✅ Success Criteria by Phase

### Phase 1 Complete (Week 3)
- ✅ User can login with email + password
- ✅ TOTP 2FA works
- ✅ Orders CRUD 100% working
- ✅ Status tracking records history
- ✅ Audit logs capturing all changes

### Phase 2 Complete (Week 5)
- ✅ Frontend fully integrated with backend
- ✅ All modals connected to API
- ✅ Real-time data fetching
- ✅ Pagination and filtering working
- ✅ 70%+ API test coverage

### MVP Complete (Week 10)
- ✅ All features deployed to production
- ✅ 80%+ test coverage
- ✅ API response time <200ms
- ✅ Page load time <3 seconds
- ✅ Zero security vulnerabilities
- ✅ Audit trail complete
- ✅ LGPD compliance ready

---

## 🚨 Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Soft delete queries showing deleted data | Add WHERE deleted_at IS NULL to all queries |
| Lost status changes | Verify INSERT into status_history for every status update |
| Audit logs incomplete | Verify all CREATE/UPDATE/DELETE trigger audit log insertion |
| Token refresh failing | Check interceptor implementation in API client |
| Test database setup taking too long | Use DATABASE_INIT.sql instead of manual creation |
| Backend language decision delayed | **Vote immediately:** FastAPI (speed) or Express (ecosystem) |

---

## 📖 Documentation Quick Links

| Need | Read This |
|------|-----------|
| 5-minute overview | ✅ This document (QUICK_REFERENCE_2026.md) |
| Database setup | DATABASE_SETUP_GUIDE.md |
| What to build this week | DEVELOPMENT_ROADMAP_2026.md |
| System architecture | ARCHITECTURE_2026.md |
| All features & tasks | BACKLOG_2026.md |
| Code examples | IMPLEMENTATION_GUIDE_2026.md |
| Document index | DOCUMENTATION_SUMMARY_2026.md |
| Database schema details | DATABASE_SCHEMA_REFACTORED.md |

---

## 👥 Team Allocation

### Backend (2 Developers)
**Developer A (Lead):**
- User/Auth system
- RMA API
- LGPD compliance APIs

**Developer B:**
- Orders CRUD API
- Quotes CRUD API
- Status history & audit logging

### Frontend (2 Developers)
**Developer A (Lead):**
- Layout & navigation
- Modal system
- Login/2FA UI

**Developer B:**
- List views
- Integration testing
- Performance optimization

---

## 🎓 Key Concepts

### Soft Deletes
```sql
-- Query only active records
SELECT * FROM pedidos WHERE deleted_at IS NULL;

-- Recover deleted record
UPDATE pedidos SET deleted_at = NULL WHERE id = '...';
```

### Audit Logging
```sql
-- See complete history of order
SELECT action, old_values, new_values, changed_by, changed_at
FROM audit_logs
WHERE entity_type = 'pedido' AND entity_id = '...'
ORDER BY changed_at DESC;
```

### Status History
```sql
-- See status change timeline
SELECT old_status, new_status, reason, changed_by, changed_at
FROM status_history
WHERE entity_type = 'pedido' AND entity_id = '...'
ORDER BY changed_at DESC;
```

---

## 📝 Daily Standup Format (5 min per person)

```
1. What did I complete yesterday?
2. What will I complete today?
3. Am I blocked? Do I need help?
```

**Time:** 10:00 AM | **Duration:** 20 min (4 devs × 5 min)

---

## 🎯 Key Decisions to Make This Week

| Decision | Options | Deadline |
|----------|---------|----------|
| Backend Language | FastAPI (Python) OR Express (Node.js) | Wednesday 4/24 |
| Hosting Platform | AWS, Azure, DigitalOcean, Railway, Render | Friday 4/26 |
| Database Hosting | Managed (RDS) OR Self-managed (Linode) | Friday 4/26 |

---

## 🚀 Go-Live Checklist (Week 10)

### Pre-Launch
- [ ] All tests passing (80%+ coverage)
- [ ] Performance targets met (<200ms API, <3s load)
- [ ] Security audit clean
- [ ] Database backup successful
- [ ] Monitoring & alerts configured
- [ ] Rollback procedure documented

### Launch Day
- [ ] Final smoke tests completed
- [ ] Team on-call
- [ ] Customer support briefed
- [ ] Communications ready
- [ ] Deploy to production
- [ ] Monitor for 2 hours
- [ ] Celebrate! 🎉

---

## 📞 Getting Help

**Database Questions?**
→ DATABASE_SETUP_GUIDE.md

**Backend Implementation?**
→ IMPLEMENTATION_GUIDE_2026.md

**Timeline Questions?**
→ DEVELOPMENT_ROADMAP_2026.md

**Blocked?**
→ Ask in daily standup

---

## 🎉 Success Factors

1. **Database set up correctly on Day 1** ← CRITICAL
2. **Backend language decided by Wednesday** ← CRITICAL
3. **Daily standups to catch blockers early** ← CRITICAL
4. **Test as you code, don't batch tests until Week 7** ← Important
5. **Communicate early and often** ← Important

---

## 🏁 Next Steps

1. **Read this document** (5 min) ← You are here
2. **Read role-specific guide** (30 min)
3. **Complete pre-development checklist** (1 hour)
4. **Monday: Start Week 1 tasks** 🚀

---

**Version:** 1.0 | **Date:** April 22, 2026 | **Status:** ✅ Ready to Start

**"We're building something that will make order management, quotes, and RMA handling simple, auditable, and LGPD-compliant. Let's make it great!"** 🚀
