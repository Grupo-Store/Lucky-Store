# Orderly Hub - Development Quick Reference

## 🎯 MVP in 8-10 Weeks with 4 Developers

### 📋 Team Structure
```
Backend (2 devs)           Frontend (2 devs)
├─ Dev 1: API & DB         ├─ Dev 1: Components & Forms
└─ Dev 2: Auth & Biz Logic └─ Dev 2: Pages & Integration

Optional: 1 DevOps (part-time) for infra setup
```

---

## 🚀 Phase Timeline

### Week 1-3: Phase 1 (Backend Infrastructure)
**Backend Focus:**
- Database schema (PostgreSQL with refactored structure)
- Authentication (JWT + TOTP 2FA)
- Orders API (basic CRUD)

**Frontend Prep:**
- React Query setup
- API client infrastructure
- Modal component preparation

**MVP Blocker: ✅ Must have working DB & auth login by end of Week 3**

---

### Week 4-5: Phase 2 (Frontend Integration)
**Backend:**
- Complete Orders, Quotes, RMA APIs
- Implement audit logging
- Data validation & business logic

**Frontend:**
- Connect modals to API
- Integrate list views
- Implement error handling

**MVP Blocker: ✅ Must have full API integration working by end of Week 5**

---

### Week 6-7: Phase 2.5 + Testing
**Backend:**
- Audit trails complete
- LGPD compliance APIs (data export/delete)
- Write unit tests

**Frontend:**
- Write component tests
- E2E tests for critical flows

**MVP Blocker: ✅ Must have >80% of features tested by end of Week 6**

---

### Week 8-10: Phase 4-5 (Testing, Deploy, Polish)
**All:**
- Security testing & hardening
- Performance optimization
- Deployment setup
- Bug fixes & polish
- Launch documentation

**MVP Delivery: ✅ End of Week 10**

---

## 📚 Key Database Features (Already Designed)

### UUIDs (Not INTs)
```sql
-- Every table has:
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```
**Why:** Security, distributed systems, industry standard

### Audit Trail (Built-in)
```sql
-- Every table has:
created_by UUID REFERENCES users(id)
created_at TIMESTAMP DEFAULT now()
updated_at TIMESTAMP DEFAULT now()
deleted_at TIMESTAMP  -- for soft deletes
```
**Why:** LGPD compliance, debugging, forensics

### Status History (Track all changes)
```sql
CREATE TABLE status_history (
  entity_type VARCHAR,        -- 'pedido', 'produto', etc
  entity_id UUID,
  old_status VARCHAR,
  new_status VARCHAR,
  changed_by UUID,            -- who made the change
  changed_at TIMESTAMP,
  reason TEXT
);
```
**Why:** Audit trail, debugging, analytics

### Complete Audit Logs
```sql
CREATE TABLE audit_logs (
  entity_type VARCHAR,
  entity_id UUID,
  action VARCHAR,             -- CREATE, UPDATE, DELETE
  old_values JSONB,           -- full before state
  new_values JSONB,           -- full after state
  changed_by UUID,
  changed_at TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);
```
**Why:** Forensics, compliance, data recovery

---

## 🔐 Authentication Flow

### Login (API Endpoint)
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "..."
}
→ Returns sessionId (temporary)
```

### Verify 2FA (API Endpoint)
```
POST /api/auth/verify-2fa
{
  "sessionId": "...",
  "code": "123456"  -- TOTP from authenticator app
}
→ Returns accessToken (1 hour) + refreshToken (7 days)
```

### API Calls (Frontend)
```
Authorization: Bearer {accessToken}
```

### Token Refresh (Auto)
```
POST /api/auth/refresh
{
  "refreshToken": "..."
}
→ Returns new accessToken
```

---

## 📊 API Endpoints (P0 - Must Have)

### Core Endpoints
```
POST   /api/auth/login
POST   /api/auth/verify-2fa
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/orders              (list with filters, pagination)
POST   /api/orders              (create)
GET    /api/orders/:id          (details)
PUT    /api/orders/:id          (update)
PATCH  /api/orders/:id/status   (change status + track in history)
DELETE /api/orders/:id          (soft delete)

GET    /api/quotes
POST   /api/quotes
PUT    /api/quotes/:id
DELETE /api/quotes/:id

GET    /api/rma
POST   /api/rma
PUT    /api/rma/:id
DELETE /api/rma/:id

GET    /api/analytics/summary   (dashboard)
GET    /api/audit/status-history/:id  (status changes)
```

---

## 📦 Database Schema (Simplified View)

### Main Tables
```
Users              Lojas (Stores)
├─ id (UUID)       ├─ id (UUID)
├─ email           └─ nome
├─ password_hash
└─ role            Vendedores (Sellers)
                   ├─ id (UUID)
                   ├─ id_loja (FK)
                   └─ nome

Clientes (Customers)
├─ id (UUID)
├─ nome
├─ cnpj
└─ email

Pedidos (Orders) [MAIN TABLE]
├─ id (UUID)
├─ numero_os (unique per store)
├─ numero_nf (unique per store)
├─ id_loja (FK)
├─ id_vendedor (FK)
├─ id_cliente (FK)
├─ status (To Buy → Delivered)
├─ valor_venda DECIMAL(12,2)
├─ created_by (FK users)
├─ created_at
├─ updated_at
└─ deleted_at (soft delete)

Produtos (Order Items)
├─ id (UUID)
├─ id_pedido (FK)
├─ descricao
├─ quantidade
├─ valor_projetado DECIMAL(12,2)
├─ valor_compra DECIMAL(12,2)
└─ status

CustoPedido (Order Costs 1:1)
├─ id (UUID)
├─ id_pedido (FK UNIQUE)
├─ custo_produto_final DECIMAL(12,2)
├─ imposto_compra DECIMAL(12,2)
└─ ... more costs

RMAs (Returns)
├─ id (UUID)
├─ numero_rma (unique)
├─ id_pedido_origem (FK)
└─ status

ItemRMA (RMA Items)
├─ id (UUID)
├─ id_rma (FK)
├─ quantidade
└─ status

StatusHistory [AUDIT]
├─ entity_type (pedido, produto, rma...)
├─ entity_id (UUID)
├─ old_status → new_status
├─ changed_by (user)
└─ changed_at

AuditLogs [FULL AUDIT]
├─ entity_type
├─ entity_id
├─ action (CREATE, UPDATE, DELETE)
├─ old_values (JSONB)
├─ new_values (JSONB)
├─ changed_by
└─ changed_at
```

---

## 🛠️ Tech Stack Decision

### Backend Options
**RECOMMENDED: Python + FastAPI**
- Faster to learn + write
- Built-in async support
- Excellent for rapid development
- Better docs than FastAPI than Express

**ALTERNATIVE: Node.js + Express**
- Larger ecosystem
- JavaScript developers prefer it
- Proven at scale

### Frontend (Already Decided ✅)
**React 18 + Vite**
- TypeScript
- React Query (TanStack)
- Shadcn UI components
- Tailwind CSS

### Database (Already Decided ✅)
**PostgreSQL 14+**
- Refactored schema ready
- UUID support
- JSONB for audit logs
- Full text search ready

---

## 📋 Checklist - Week 1 Kickoff

### Backend Team
- [ ] PostgreSQL running locally
- [ ] Database created with schema
- [ ] ORM (SQLAlchemy or Prisma) installed
- [ ] First migration created & tested
- [ ] Backend project scaffolding complete
- [ ] Auth service skeleton created
- [ ] Orders API skeleton created

### Frontend Team
- [ ] React Query installed
- [ ] API client module created (src/api/)
- [ ] Axios/Fetch interceptors setup
- [ ] Error handling utilities created
- [ ] OrderModal prepared for API calls
- [ ] QuoteModal prepared for API calls
- [ ] RmaModal prepared for API calls

### DevOps/Infrastructure
- [ ] Docker files created (optional but recommended)
- [ ] GitHub Actions workflow sketched
- [ ] Environment variables documented (.env.example)
- [ ] Database backup strategy noted

---

## 🎯 Success Criteria per Phase

### Phase 1 (End of Week 3)
- ✅ DB schema created & migrations working
- ✅ User can login with JWT + 2FA
- ✅ Orders API working (POST, GET, PUT, PATCH)
- ✅ Audit fields populated correctly

### Phase 2 (End of Week 5)
- ✅ Frontend connected to Orders API
- ✅ Quotes & RMA APIs working
- ✅ All modals calling real backend
- ✅ Error handling working end-to-end

### Phase 2.5 (End of Week 6)
- ✅ Status history tracking all changes
- ✅ Audit logs capturing full change details
- ✅ Data export/deletion APIs working
- ✅ 80% test coverage

### MVP (End of Week 10)
- ✅ All CRUD operations working
- ✅ All tests passing (unit, integration, basic E2E)
- ✅ Deployed to staging
- ✅ Performance meets targets (<200ms API response)
- ✅ Security hardening complete
- ✅ Ready for production deployment

---

## 🚨 Critical Path (Don't Fall Behind)

```
Week 1-2: DB + Auth MUST be working
  ↓ (blocks everything else)
Week 3: Orders API working
  ↓ (blocks frontend integration)
Week 4-5: Frontend integration
  ↓ (can be tested end-to-end)
Week 6: Testing & audit logging
  ↓
Week 7-8: Polish & deploy
  ↓
Week 9-10: Buffer + MVP launch
```

**If you fall behind Week 2 goals, will impact Week 10 launch date.**

---

## 💡 Pro Tips

### Backend
1. Use database migrations from day 1 (Alembic or Prisma)
2. Write integration tests as you build APIs
3. Mock external services (emails, payments)
4. Use async/await patterns for scalability
5. Add request validation with Zod or Pydantic

### Frontend
1. Use React Query for all data fetching (not useState)
2. Create reusable error handling component
3. Use TypeScript strictly
4. Test modals with different states (loading, error, success)
5. Implement optimistic updates where possible

### DevOps
1. Automate everything (DB migrations, deploys)
2. Use same stack for dev/staging/prod
3. Set up monitoring from day 1 (Sentry for errors)
4. Document deployment process
5. Create rollback procedures

---

## 📞 Decision Points This Week

1. **Backend Language**: Python or Node.js?
2. **Hosting**: Which platform?
3. **Email Service**: Which provider?
4. **Payment Processing**: Which processor?
5. **Monitoring**: Sentry, DataDog, or other?

---

## 📚 Key Documentation Files

| File | Purpose |
|------|---------|
| DATABASE_SCHEMA_REFACTORED.md | Full SQL schema with examples |
| DATABASE_SCHEMA.dbdiagram | Visual database diagram |
| DATABASE_REFACTORING_GUIDE.md | Side-by-side migration guide |
| ARCHITECTURE.md | System design & data flows |
| IMPLEMENTATION_GUIDE.md | Code examples & patterns |
| BACKLOG.md | Full project backlog |
| BACKLOG_UPDATES_SUMMARY.md | What changed (this update) |
| DEVELOPMENT_ROADMAP.md | Weekly task breakdown |

---

## 🎊 Expected Output per Week

### Week 1
- Login page working (with real 2FA)
- Database dashboard in Prisma Studio/pgAdmin
- API documentation (even if just Postman)

### Week 2
- Create order button working
- Can see orders in API response
- Tests running in CI

### Week 3
- Full order CRUD working
- API performance measured
- Quotes API started

### Week 4
- Frontend shows real order data
- Modals submitting to API
- User can do full workflow (create order, track status)

### Week 5
- 90% of features working
- Most bugs squashed
- Performance optimized

### Week 6
- Comprehensive test suite
- Audit trail working
- LGPD compliance validated

### Week 7-10
- Deployment ready
- Production monitoring setup
- Launch preparation

---

**Last Updated:** April 21, 2026
**Status:** Ready to Start 🚀
