# Orderly Hub - Project Backlog

## Project Overview
**Orderly Hub** is a comprehensive order management system designed for multi-company operations (Lucky Store, BTech, AJJ). It handles order tracking, quotes, RMA (Return Management), and provides analytics dashboards.

**Current Status:** Frontend mostly complete with mock data and local state management. Backend and API integration needed.

**Team:** 4 Developers
**Target MVP:** 8-10 weeks
**Target Full Release:** 20-24 weeks

---

## Recent Updates (Database Refactoring - Phase 0)
✅ **New Features Added:**
- UUID-based primary keys (security & distributed systems)
- Complete audit trail (who changed what when)
- Soft deletes (LGPD compliance, data recovery)
- Status history tracking (audit trail for status changes)
- Materialized views (reports without data redundancy)
- Enhanced constraints (business logic enforced at DB level)

---

## Phase 1: Backend Infrastructure & API (Critical)

### 1.1 Backend Setup
- [ ] **Select backend framework** (Node.js/Express, Python/FastAPI, or Go)
- [ ] **Set up project structure** with proper MVC/layered architecture
- [ ] **Configure database** (PostgreSQL recommended for relational data)
- [ ] **Set up development environment** (local DB, Docker containers)
- [ ] **Configure environment variables** and secrets management
- [ ] **Set up CI/CD pipeline** (GitHub Actions or similar)

### 1.2 Database Schema Design (REFACTORED)
✅ **Already Designed in DATABASE_SCHEMA_REFACTORED.md**

**Implementation Tasks:**
- [ ] **Set up PostgreSQL with refactored schema**:
  - [ ] UUID primary keys on all tables
  - [ ] Audit fields (created_by, created_at, updated_at, deleted_at)
  - [ ] Soft deletes on main entities
  - [ ] Explicit DECIMAL(12,2) for financial data
  - [ ] CHECK constraints for valid statuses
  - [ ] Foreign key cascade settings
- [ ] **Create database migrations** with versioning (use Alembic or Prisma)
- [ ] **Set up optimized indexes**:
  - [ ] Soft-delete aware indexes (WHERE deleted_at IS NULL)
  - [ ] Composite indexes for common queries
  - [ ] Foreign key indexes for relationships
- [ ] **Create views for reporting**:
  - [ ] resultado_mensal (monthly results)
  - [ ] resultado_anual (annual results)
- [ ] **Implement data validation constraints** at DB level
- [ ] **Design backup & recovery procedures**
- [ ] **Create database triggers** (optional):
  - [ ] Auto-update updated_at on modifications
  - [ ] Prevent deletion if dependencies exist

### 1.3 Authentication & Authorization
- [ ] **Implement real authentication** (replace mock 2FA):
  - [ ] Email/password registration with validation
  - [ ] JWT token generation (1 hour) & refresh tokens (7 days)
  - [ ] Real 2FA implementation (TOTP using speakeasy)
  - [ ] Password reset flow with email verification
  - [ ] Session management with token expiry
  - [ ] Logout with token blacklisting
- [ ] **Implement role-based access control (RBAC)**:
  - [ ] Admin (full access, user management)
  - [ ] Manager (read/write orders & quotes, analytics)
  - [ ] Seller (limited access to own orders, commission tracking)
  - [ ] Viewer (read-only access to reports)
- [ ] **Secure endpoints** with proper authorization checks
- [ ] **Implement audit logging** for user actions:
  - [ ] Track who created/updated/deleted records
  - [ ] Log all status changes with reason
  - [ ] Store IP address & user agent
  - [ ] Retention: 6+ months for compliance
- [ ] **Set up CORS policies** for frontend communication
- [ ] **Implement row-level security** (optional, for multi-tenant isolation)

### 1.4 Core API Endpoints

#### Orders API
- [ ] `GET /api/orders` - List orders with filtering, sorting, pagination
- [ ] `POST /api/orders` - Create new order
- [ ] `GET /api/orders/:id` - Get order details
- [ ] `PUT /api/orders/:id` - Update order
- [ ] `DELETE /api/orders/:id` - Delete order
- [ ] `PATCH /api/orders/:id/status` - Update order status
- [ ] `PATCH /api/orders/:id/items/:itemId/status` - Update item status
- [ ] `GET /api/orders/export` - Export orders (CSV/Excel)

#### Quotes API
- [ ] `GET /api/quotes` - List quotes with filtering
- [ ] `POST /api/quotes` - Create new quote
- [ ] `GET /api/quotes/:id` - Get quote details
- [ ] `PUT /api/quotes/:id` - Update quote
- [ ] `DELETE /api/quotes/:id` - Delete quote
- [ ] `PATCH /api/quotes/:id/phase` - Update quote phase
- [ ] `POST /api/quotes/:id/convert` - Convert quote to order

#### RMA API
- [ ] `GET /api/rma` - List RMA requests
- [ ] `POST /api/rma` - Create RMA from order
- [ ] `GET /api/rma/:id` - Get RMA details
- [ ] `PUT /api/rma/:id` - Update RMA
- [ ] `PATCH /api/rma/:id/items/:itemId/status` - Update RMA item status
- [ ] `PATCH /api/rma/:id/close` - Close/complete RMA

#### Dashboard API
- [ ] `GET /api/analytics/summary` - Dashboard summary stats
- [ ] `GET /api/analytics/orders-by-status` - Orders distribution by status
- [ ] `GET /api/analytics/revenue` - Revenue by period
- [ ] `GET /api/analytics/company-stats` - Stats by company

#### System API
- [ ] `GET /api/health` - Health check endpoint
- [ ] `GET /api/users/me` - Current user info
- [ ] `POST /api/auth/login` - Login endpoint
- [ ] `POST /api/auth/verify-code` - Verify 2FA code
- [ ] `POST /api/auth/logout` - Logout
- [ ] `POST /api/auth/refresh` - Refresh token

### 1.5 Data Validation & Business Logic
- [ ] **Validate all incoming data** with schemas (Zod/Pydantic)
- [ ] **Implement business logic** for:
  - [ ] Order status transitions (enforce valid workflows)
  - [ ] RMA item status transitions
  - [ ] Payment method validation
  - [ ] Financial calculations (profit, taxes, costs)
  - [ ] Delivery date validations
  - [ ] Duplicate order prevention (unique constraint at DB)
  - [ ] One NF per store (unique constraint)
- [ ] **Calculate derived fields** server-side:
  - [ ] Item final values (valor_projetado - valor_compra = economia)
  - [ ] Order totals & profit margins
  - [ ] Tax calculations (purchase & sales taxes)
  - [ ] Freight totals
  - [ ] Payment method costs (credit/debit %)
- [ ] **Track all changes** via audit system:
  - [ ] Store old_values and new_values in JSONB
  - [ ] Track user & timestamp
  - [ ] Log reason for status changes
  - [ ] Enable forensics & data recovery

---

## Phase 2: Frontend-Backend Integration

### 2.1 API Client Setup
- [ ] **Create API client** with proper configuration:
  - [ ] Base URL management (dev/prod)
  - [ ] Request/response interceptors
  - [ ] Error handling
  - [ ] Timeout handling
  - [ ] Retry logic for failed requests
- [ ] **Replace React Context stores** with API calls via React Query
- [ ] **Implement data caching strategy** (React Query cache management)
- [ ] **Handle loading & error states** consistently across UI

### 2.2 Authentication Integration
- [ ] **Replace mock auth** with real API authentication
- [ ] **Implement token storage** (secure localStorage/cookies)
- [ ] **Auto-logout on token expiry**
- [ ] **Redirect to login** on 401 responses
- [ ] **Implement token refresh** automatically

### 2.3 Update React Components
- [ ] **Convert AuthStore** to use API
- [ ] **Convert OrderStore** to use API with React Query
- [ ] **Convert QuoteStore** to use API with React Query
- [ ] **Update all modals** (OrderModal, QuoteModal, RmaModal) to:
  - [ ] Call API for create/update
  - [ ] Handle API errors
  - [ ] Show loading states
  - [ ] Refresh data after mutations
- [ ] **Update list views** (Sales page, Dashboard) to use API data

### 2.4 Real-time Updates (Optional but recommended)
- [ ] **Implement WebSocket** connection for live updates
- [ ] **Auto-refresh orders** when updated by other users
- [ ] **Implement conflict resolution** for concurrent edits

---

## Phase 2.5: Audit & Compliance (NEW - Critical for LGPD)

### 2.5.1 Audit Logging System
- [ ] **Implement status_history table**:
  - [ ] Track all status changes (pedido, produto, rma, item_rma)
  - [ ] Store old_status, new_status, changed_by, reason
  - [ ] Create API: GET /api/audit/status-history/:entityId
  - [ ] Index by changed_at for performance
- [ ] **Implement audit_logs table**:
  - [ ] Track CREATE, UPDATE, DELETE operations
  - [ ] Store full before/after values in JSONB
  - [ ] Include user IP & user agent
  - [ ] Create API: GET /api/audit/logs (admin only)
  - [ ] Retention policy: 6+ months
- [ ] **Audit UI features**:
  - [ ] Show status timeline on order details
  - [ ] Show "changed by" info (user name & timestamp)
  - [ ] Show reason for changes
  - [ ] Admin panel to view audit logs

### 2.5.2 LGPD Compliance Features
- [ ] **Data Export (Article 18)**:
  - [ ] API: POST /api/gdpr/export (export all user data)
  - [ ] Include personal data in JSON format
  - [ ] Downloadable ZIP with all records
- [ ] **Data Deletion (Article 17)**:
  - [ ] API: POST /api/gdpr/delete-account (soft delete user)
  - [ ] Remove personal data from active records
  - [ ] Keep audit trail
- [ ] **Consent Tracking**:
  - [ ] Track when user consented to terms
  - [ ] Store consent version & timestamp
  - [ ] Ability to revoke consent
- [ ] **Privacy Documentation**:
  - [ ] Privacy policy page
  - [ ] Terms of service
  - [ ] Cookie consent banner

---

## Phase 3: Enhanced Features & Functionality

### 3.1 Advanced Filtering & Search
- [ ] **Full-text search** across orders, customers, products
- [ ] **Advanced filtering** with saved filters/favorites
- [ ] **Date range filtering** enhancements
- [ ] **Filter by payment status**, delivery status, company, seller
- [ ] **Export filtered results** to CSV/Excel

### 3.2 Reports & Analytics
- [ ] **Generate PDF reports**:
  - [ ] Monthly sales reports
  - [ ] Company performance reports
  - [ ] Seller performance reports
  - [ ] Order summary reports
- [ ] **Advanced analytics dashboard**:
  - [ ] Custom date ranges
  - [ ] Comparison reports
  - [ ] Trend analysis
  - [ ] Sales forecasting
- [ ] **Email report scheduling**

### 3.3 Order Management Enhancements
- [ ] **Bulk operations**:
  - [ ] Bulk status updates
  - [ ] Bulk delete
  - [ ] Bulk export
- [ ] **Order templates** for common orders
- [ ] **Order duplication** functionality
- [ ] **Order history & change tracking**
- [ ] **Order notes & comments** with timestamps

### 3.4 RMA Enhancements
- [ ] **RMA tracking timeline** visualization
- [ ] **Automatic RMA status updates** based on item statuses
- [ ] **RMA approval workflow**
- [ ] **Return authorization numbers** (RAN) generation
- [ ] **Repair partner integration**

### 3.5 Notifications & Alerts
- [ ] **In-app notifications** for:
  - [ ] Order updates
  - [ ] Delayed orders (when <= 3 days from delivery)
  - [ ] RMA status changes
- [ ] **Email notifications**:
  - [ ] Order confirmation
  - [ ] Delivery alerts
  - [ ] Payment reminders
- [ ] **SMS notifications** (optional)

### 3.6 Financial Management
- [ ] **Invoice management**:
  - [ ] Generate invoices
  - [ ] Track invoice status
  - [ ] Payment tracking
- [ ] **Payment processing integration**:
  - [ ] Credit card processor (Stripe/PagSeguro)
  - [ ] Boleto generation
  - [ ] Pix integration
- [ ] **Financial reports**:
  - [ ] Revenue by payment method
  - [ ] Outstanding payments
  - [ ] Cost analysis

---

## Phase 4: Testing & Quality Assurance

### 4.1 Backend Testing
- [ ] **Unit tests** for all business logic (target: >80% coverage)
- [ ] **Integration tests** for API endpoints
- [ ] **Database tests** with test data fixtures
- [ ] **Authentication tests** (security-focused)
- [ ] **Performance tests** for critical endpoints

### 4.2 Frontend Testing
- [ ] **Unit tests** for components and hooks (expand existing test setup)
- [ ] **Integration tests** for user workflows
- [ ] **E2E tests** (Cypress or Playwright) for:
  - [ ] Login flow
  - [ ] Order creation & update
  - [ ] Quote management
  - [ ] RMA workflow
- [ ] **Accessibility tests** (a11y)
- [ ] **Visual regression tests**

### 4.3 Security Testing
- [ ] **Penetration testing**
- [ ] **SQL injection tests**
- [ ] **XSS vulnerability tests**
- [ ] **CSRF protection tests**
- [ ] **Authentication bypass attempts**
- [ ] **Authorization tests** (role-based access)

### 4.4 Performance Testing
- [ ] **Load testing** for API endpoints
- [ ] **Database query optimization**
- [ ] **Frontend performance** (Lighthouse score > 90)
- [ ] **API response time** targets (< 200ms for most endpoints)

---

## Phase 5: Deployment & Operations

### 5.1 Infrastructure Setup
- [ ] **Choose hosting platform** (AWS, Azure, DigitalOcean, etc.)
- [ ] **Set up production database**:
  - [ ] Automated backups
  - [ ] High availability setup
  - [ ] Disaster recovery plan
- [ ] **Configure CDN** for static assets
- [ ] **Set up monitoring & logging**:
  - [ ] Application performance monitoring
  - [ ] Error tracking (Sentry or similar)
  - [ ] Log aggregation
- [ ] **Configure alerting** for:
  - [ ] API errors
  - [ ] Database issues
  - [ ] Deployment failures

### 5.2 Deployment Pipeline
- [ ] **Automate deployment** for:
  - [ ] Frontend (vercel, netlify, or similar)
  - [ ] Backend (Docker containers)
- [ ] **Implement blue-green deployment** for zero downtime
- [ ] **Create rollback procedures**
- [ ] **Database migration automation**
- [ ] **Staging environment** setup for testing

### 5.3 Security Hardening
- [ ] **HTTPS/SSL** for all endpoints
- [ ] **Security headers** (CSP, HSTS, X-Frame-Options, etc.)
- [ ] **Rate limiting** on API endpoints
- [ ] **DDoS protection**
- [ ] **Regular security updates** (dependencies)
- [ ] **Security audit log** retention (6+ months)

### 5.4 Documentation
- [ ] **API documentation** (OpenAPI/Swagger)
- [ ] **Backend setup guide** (development & production)
- [ ] **Frontend setup guide**
- [ ] **Database schema documentation**
- [ ] **Deployment guide**
- [ ] **Troubleshooting guide**
- [ ] **Contributing guidelines**

---

## Phase 6: User Features & Optimization

### 6.1 User Management
- [ ] **User administration panel**:
  - [ ] Create/edit/delete users
  - [ ] Manage roles & permissions
  - [ ] View user activity logs
  - [ ] Reset user passwords
- [ ] **User preferences**:
  - [ ] Theme selection (light/dark)
  - [ ] Language selection (Portuguese/English)
  - [ ] Default filters & views
  - [ ] Notification preferences

### 6.2 Data Import/Export
- [ ] **Import orders from CSV/Excel**
- [ ] **Import customers from CSV/Excel**
- [ ] **Template-based imports**
- [ ] **Export orders to CSV/Excel/PDF**
- [ ] **Export quotes to PDF**
- [ ] **Batch export operations**

### 6.3 Mobile Optimization
- [ ] **Responsive design** for all pages
- [ ] **Mobile-friendly navigation**
- [ ] **Touch-optimized components**
- [ ] **Mobile app** (React Native or PWA) - Optional

### 6.4 Performance Optimization
- [ ] **Code splitting** & lazy loading
- [ ] **Image optimization**
- [ ] **Database query optimization**
- [ ] **Caching strategy** (Redis for backend)
- [ ] **Frontend bundle size reduction**

### 6.5 Multi-language Support
- [ ] **Portuguese translations** (already mostly done)
- [ ] **English translations**
- [ ] **Language switcher** in UI
- [ ] **Date/currency localization**

---

## Phase 7: Advanced Features

### 7.1 Integration with External Systems
- [ ] **Supplier API integration** (auto-sync purchase orders)
- [ ] **Customer CRM integration**
- [ ] **Shipping API integration** (track deliveries)
- [ ] **Email service integration** (SendGrid, AWS SES)
- [ ] **SMS service integration** (Twilio)

### 7.2 Automation & Workflows
- [ ] **Automated status transitions** based on events
- [ ] **Automated email notifications**
- [ ] **Scheduled tasks**:
  - [ ] Daily report generation
  - [ ] Backup execution
  - [ ] Expired quote cleanup
- [ ] **Webhook support** for integrations

### 7.3 Advanced Analytics
- [ ] **Machine learning** for sales forecasting
- [ ] **Anomaly detection** for unusual orders
- [ ] **Customer segmentation**
- [ ] **Churn prediction**

### 7.4 Compliance & Audit
- [ ] **LGPD compliance** (Brazilian privacy law)
- [ ] **Audit trail** for all data changes
- [ ] **Data retention policies**
- [ ] **Export user data** on request
- [ ] **Delete user data** on request

---

## Technical Debt & Maintenance

### Ongoing Tasks
- [ ] **Dependency updates** (monthly security patches)
- [ ] **Performance monitoring** and optimization
- [ ] **Database maintenance** (index optimization, cleanup)
- [ ] **Error monitoring** and bug fixes
- [ ] **User feedback** implementation
- [ ] **Documentation updates**
- [ ] **Code refactoring** and cleanup
- [ ] **Accessibility improvements**

---

## Priority Matrix (4 Developer Team)

### P0 - Critical (Blocks MVP - Weeks 1-4)
1. ✅ **Phase 1.2**: Refactored database schema (PostgreSQL setup)
2. ✅ **Phase 1.3**: Real authentication & authorization (JWT + 2FA)
3. ✅ **Phase 1.4**: Core API endpoints (Orders, Quotes, RMA)
4. ✅ **Phase 1.5**: Data validation & business logic
5. ✅ **Phase 2**: Frontend-backend integration
6. **Phase 2.5**: Audit logging (status_history table)

### P1 - High (Essential for MVP Launch - Weeks 5-8)
1. **Phase 4.1-4.2**: Testing (unit, integration, basic E2E)
2. **Phase 5.2**: CI/CD pipeline setup
3. **Phase 5.1**: Basic monitoring & error tracking
4. **Phase 5.3**: Security hardening (HTTPS, headers, rate limiting)
5. **Phase 2.5**: LGPD compliance basics (data export/deletion)

### P2 - Medium (Post-MVP - Weeks 9-16)
1. **Phase 3.1-3.2**: Advanced filtering, reports, analytics views
2. **Phase 3.3-3.6**: Enhanced features (order history, financial mgmt)
3. **Phase 4.3-4.4**: Security & performance testing
4. **Phase 5.4**: Complete documentation
5. **Phase 6.1-6.4**: User management, data import/export

### P3 - Lower (Nice to Have - Weeks 17-24)
1. **Phase 7.1-7.2**: External integrations & automation
2. **Phase 7.3**: Advanced analytics & ML
3. **Phase 7.4**: Enhanced compliance features
4. **Phase 6.5**: Multi-language support
5. **Phase 6.3**: Mobile app/PWA

---

## Timeline Summary for 4 Developers

| Phase | Duration | Team Split | Status |
|-------|----------|-----------|--------|
| **Phase 1.1-1.5** | 2-3 weeks | 2 Backend, 2 Frontend | ▶️ IN PROGRESS |
| **Phase 2.0-2.5** | 2-3 weeks | 2 Backend, 2 Frontend | ▶️ NEXT |
| **Phase 4 (Testing)** | 1-2 weeks | All 4 | ▶️ AFTER P1 |
| **Phase 5 (Deploy)** | 1-2 weeks | 1 DevOps + 3 support | ▶️ AFTER P1 |
| **MVP Delivery** | **8-10 weeks** | | ✅ TARGET |
| **Phase 3 (Features)** | 4-6 weeks | 2 Backend, 2 Frontend | ▶️ P2 |
| **Phase 6-7 (Advanced)** | 6-8 weeks | Mixed | ▶️ P3 |
| **Full Release** | **20-24 weeks** | | ✅ TARGET |

---

## Getting Started (This Week)

### Backend Team (2 devs)
- [ ] Set up PostgreSQL with refactored schema
- [ ] Initialize backend project (FastAPI or Express)
- [ ] Create ORM models (SQLAlchemy or Prisma)
- [ ] Implement authentication endpoints
- [ ] Start working on Orders API

### Frontend Team (2 devs)
- [ ] Start replacing React Context with React Query
- [ ] Create API client with interceptors
- [ ] Prepare modals for API integration
- [ ] Set up error handling patterns

---

## Key Resources
- **Database Schema**: DATABASE_SCHEMA_REFACTORED.md (implementation details)
- **Database Diagram**: DATABASE_SCHEMA.dbdiagram (visualization)
- **Refactoring Guide**: DATABASE_REFACTORING_GUIDE.md (side-by-side comparisons)
- **Architecture**: ARCHITECTURE.md (system design)
- **Implementation**: IMPLEMENTATION_GUIDE.md (code examples)

**Total estimated time:** 20-29 weeks (5-7 months) for full feature set

---

## Getting Started Checklist

To make the project fully functional, start with:

1. **Week 1-2:** Set up backend project, database schema, and basic API
2. **Week 3:** Implement real authentication
3. **Week 4:** Build core API endpoints
4. **Week 5-6:** Integrate frontend with API
5. **Week 7-8:** Implement error handling and validation
6. **Week 9-10:** Comprehensive testing
7. **Week 11-12:** Deployment and security hardening

This provides a MVP (Minimum Viable Product) that can be deployed and used.

---

## Notes

- All dates are ISO format (YYYY-MM-DD)
- All currency is in Brazilian Real (R$)
- The system supports 3 companies: Lucky Store, BTech, AJJ
- 3 sellers: Alcides, Lucas, Pedro
- Payment methods: Credit Card, Debit Card, Boleto, Pix, TED, Cash
- Portuguese language is primary
