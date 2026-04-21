# Orderly Hub - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orderly Hub System                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER (React)                       │
├─────────────────────────────────────────────────────────────────┤
│  Pages          Components              Hooks                   │
│  ├─ Sales       ├─ OrderModal          ├─ useOrders            │
│  ├─ Dashboard   ├─ ProductModal        ├─ useQuotes            │
│  └─ NotFound    ├─ QuoteModal          ├─ useAuth              │
│                 ├─ RmaModal            └─ useToast             │
│                 ├─ AppSidebar                                   │
│                 ├─ DateFilter                                   │
│                 └─ Pagination                                   │
│                                                                  │
│  State Management: React Context (migrate to API calls)         │
│  ├─ AuthStore   (User sessions, permissions)                   │
│  ├─ OrderStore  (Orders, items, RMA)                           │
│  └─ QuoteStore  (Quotes, phases)                               │
│                                                                  │
│  UI Components: Shadcn UI + Radix UI                            │
│  Styling: Tailwind CSS                                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/REST + JWT
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / LOAD BALANCER                │
├─────────────────────────────────────────────────────────────────┤
│  - Request validation                                            │
│  - CORS handling                                                 │
│  - Rate limiting                                                 │
│  - Request logging                                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER (Node.js)                  │
├─────────────────────────────────────────────────────────────────┤
│  HTTP Server: Express.js / NestJS                               │
│                                                                  │
│  Routes / Controllers:                                           │
│  ├─ /auth         → AuthController                              │
│  ├─ /orders       → OrderController                             │
│  ├─ /quotes       → QuoteController                             │
│  ├─ /rma          → RmaController                               │
│  ├─ /analytics    → AnalyticsController                         │
│  └─ /users        → UserController                              │
│                                                                  │
│  Middleware:                                                     │
│  ├─ Authentication (JWT verification)                           │
│  ├─ Authorization (Role-based access)                           │
│  ├─ Validation (Zod/Joi schemas)                                │
│  ├─ Error handling                                              │
│  └─ Logging                                                      │
│                                                                  │
│  Business Logic Layer (Services):                               │
│  ├─ AuthService       (Login, 2FA, token management)            │
│  ├─ OrderService      (CRUD, status transitions, calculations)  │
│  ├─ QuoteService      (CRUD, phase management)                  │
│  ├─ RmaService        (CRUD, workflow management)               │
│  ├─ AnalyticsService  (Reports, aggregations)                   │
│  └─ UserService       (User management, permissions)            │
│                                                                  │
│  Data Access Layer (Repositories):                              │
│  ├─ UserRepository                                              │
│  ├─ OrderRepository                                             │
│  ├─ QuoteRepository                                             │
│  ├─ RmaRepository                                               │
│  └─ CustomerRepository                                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ACCESS LAYER (Prisma ORM)               │
├─────────────────────────────────────────────────────────────────┤
│  - Database migrations                                           │
│  - Query builder                                                 │
│  - Relationship handling                                         │
│  - Transaction management                                        │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Primary Database: PostgreSQL 14+                               │
│  ├─ Tables (as defined in IMPLEMENTATION_GUIDE.md)              │
│  ├─ Relationships                                               │
│  ├─ Constraints                                                 │
│  └─ Indexes (performance optimization)                          │
│                                                                  │
│  Caching Layer (Optional): Redis                                │
│  ├─ Session cache                                               │
│  ├─ Query result cache                                          │
│  └─ Rate limiting store                                         │
│                                                                  │
│  Backup & Recovery:                                             │
│  ├─ Daily backups                                               │
│  ├─ Point-in-time recovery                                      │
│  └─ Replication for HA                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│  - Email Service (SendGrid, AWS SES)                            │
│  - SMS Service (Twilio)                                         │
│  - Payment Processor (Stripe, PagSeguro)                        │
│  - File Storage (AWS S3, Google Cloud Storage)                  │
│  - Monitoring (Sentry, DataDog)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Order Creation Flow
```
User inputs order data
         │
         ▼
OrderModal component
         │
         ▼
Form validation (Zod)
         │
         ▼
API call: POST /api/orders
         │
         ▼
Backend receives request
         │
         ▼
AuthMiddleware (verify JWT)
         │
         ▼
ValidationMiddleware (validate schema)
         │
         ▼
OrderController.create()
         │
         ▼
OrderService.createOrder()
         ├─ Generate OS number
         ├─ Calculate totals
         ├─ Validate business rules
         └─ Create in database
         │
         ▼
OrderRepository.create()
         │
         ▼
Prisma ORM saves to PostgreSQL
         │
         ▼
Return created order
         │
         ▼
Frontend receives response
         │
         ▼
Update React Query cache
         │
         ▼
Refresh order list
         │
         ▼
Show success toast
```

### Order Status Update Flow
```
User clicks status change button
         │
         ▼
Modal confirms action
         │
         ▼
API call: PATCH /api/orders/:id/status
         │
         ▼
Backend validation
         │
         ├─ Check user permission
         ├─ Verify order exists
         ├─ Validate status transition
         └─ Check business rules
         │
         ▼
OrderService.updateStatus()
         ├─ Update order status
         ├─ Create audit log
         └─ Trigger notifications
         │
         ▼
Database update
         │
         ▼
Frontend updated
         │
         ▼
Refresh related data
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Resource data
  },
  "meta": {
    "timestamp": "2026-04-21T10:30:00Z",
    "version": "1.0"
  }
}
```

### List Response with Pagination
```json
{
  "success": true,
  "data": [
    { /* item 1 */ },
    { /* item 2 */ }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "email": ["Must be a valid email"]
    }
  }
}
```

---

## Authentication Flow

```
1. User enters credentials
         │
         ▼
2. POST /api/auth/login
         │
         ▼
3. Backend validates credentials
   └─ Query database for user
   └─ Compare password (bcrypt)
   └─ Return requires2FA: true
         │
         ▼
4. Frontend shows 2FA prompt
         │
         ▼
5. User enters TOTP code
         │
         ▼
6. POST /api/auth/verify-2fa
         │
         ▼
7. Backend verifies 2FA code
         │
         ▼
8. Generate tokens
   ├─ Access Token (JWT, 1 hour expiry)
   └─ Refresh Token (HTTPOnly cookie, 7 days)
         │
         ▼
9. Return tokens to frontend
         │
         ▼
10. Store access token in localStorage
11. Store refresh token in HTTPOnly cookie
         │
         ▼
12. Set Authorization header for requests
    Authorization: Bearer {accessToken}
```

---

## Component Hierarchy

```
App (with providers)
├─ QueryClientProvider
├─ TooltipProvider
├─ Toaster (notifications)
├─ Sonner (toast)
└─ AuthProvider
   └─ AuthGate
      ├─ LoginScreen (if not authenticated)
      │  ├─ LoginForm
      │  └─ VerificationForm
      └─ AppLayout (if authenticated)
         ├─ AppSidebar
         │  └─ NavLink components
         ├─ MainContent
         │  └─ Routes
         │     ├─ Sales page
         │     │  ├─ Tabs (Orders, Quotes, RMA)
         │     │  ├─ SearchBar
         │     │  ├─ DateFilter
         │     │  ├─ Table
         │     │  │  └─ Row actions
         │     │  ├─ Pagination
         │     │  ├─ OrderModal
         │     │  ├─ ProductModal
         │     │  ├─ QuoteModal
         │     │  ├─ RmaModal
         │     │  └─ AddOrderChooser
         │     └─ Dashboard page
         │        ├─ CompanyFilter
         │        ├─ Tabs (Monthly, Annual)
         │        └─ Charts
         │           ├─ BarChart
         │           ├─ PieChart
         │           └─ LineChart
         └─ Footer
```

---

## File Structure (Backend)

```
backend/
├─ src/
│  ├─ main.ts (entry point)
│  ├─ config/
│  │  ├─ database.ts
│  │  ├─ env.ts
│  │  └─ cors.ts
│  ├─ controllers/
│  │  ├─ AuthController.ts
│  │  ├─ OrderController.ts
│  │  ├─ QuoteController.ts
│  │  ├─ RmaController.ts
│  │  ├─ AnalyticsController.ts
│  │  └─ UserController.ts
│  ├─ services/
│  │  ├─ AuthService.ts
│  │  ├─ OrderService.ts
│  │  ├─ QuoteService.ts
│  │  ├─ RmaService.ts
│  │  ├─ AnalyticsService.ts
│  │  └─ UserService.ts
│  ├─ repositories/
│  │  ├─ UserRepository.ts
│  │  ├─ OrderRepository.ts
│  │  ├─ QuoteRepository.ts
│  │  ├─ RmaRepository.ts
│  │  └─ CustomerRepository.ts
│  ├─ middleware/
│  │  ├─ authMiddleware.ts
│  │  ├─ validationMiddleware.ts
│  │  ├─ errorHandler.ts
│  │  └─ logger.ts
│  ├─ schemas/
│  │  ├─ orderSchema.ts
│  │  ├─ quoteSchema.ts
│  │  ├─ rmaSchema.ts
│  │  └─ authSchema.ts
│  ├─ types/
│  │  ├─ index.ts (TypeScript interfaces)
│  │  └─ enums.ts
│  ├─ utils/
│  │  ├─ jwt.ts
│  │  ├─ password.ts
│  │  ├─ validation.ts
│  │  └─ calculations.ts
│  └─ routes/
│     ├─ authRoutes.ts
│     ├─ orderRoutes.ts
│     ├─ quoteRoutes.ts
│     ├─ rmaRoutes.ts
│     ├─ analyticsRoutes.ts
│     └─ userRoutes.ts
│
├─ prisma/
│  ├─ schema.prisma (database schema)
│  └─ migrations/
│     └─ [timestamp]_initial/
│        └─ migration.sql
│
├─ tests/
│  ├─ unit/
│  │  ├─ services/
│  │  └─ utils/
│  ├─ integration/
│  │  ├─ auth.test.ts
│  │  ├─ orders.test.ts
│  │  └─ quotes.test.ts
│  └─ fixtures/
│     └─ testData.ts
│
├─ .env.example
├─ .env.development
├─ .env.production
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ README.md
```

---

## Technology Stack Summary

### Frontend
- **Runtime:** Node.js 18+
- **Framework:** React 18.x
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS + PostCSS
- **UI Components:** Shadcn UI (Radix UI primitives)
- **State Management:** React Context (plan to migrate to React Query)
- **Data Fetching:** React Query (TanStack Query)
- **Routing:** React Router v6
- **Forms:** React Hook Form
- **Validation:** Zod
- **Testing:** Vitest
- **Charts:** Recharts
- **Date Handling:** date-fns
- **Icons:** lucide-react
- **Toast Notifications:** Sonner

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js or NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL 14+
- **ORM:** Prisma
- **Authentication:** Passport.js + JWT
- **2FA:** speakeasy (TOTP)
- **Validation:** Zod
- **Testing:** Jest + Supertest
- **Logging:** Winston or Pino
- **Error Handling:** Custom error classes
- **Environment:** dotenv

### Infrastructure
- **Container:** Docker
- **Orchestration:** Kubernetes or Docker Compose
- **Database Hosting:** Managed PostgreSQL (AWS RDS, Azure Database, DigitalOcean)
- **Object Storage:** AWS S3 or equivalent
- **CDN:** CloudFront or Cloudflare
- **CI/CD:** GitHub Actions
- **Monitoring:** Sentry for error tracking
- **Analytics:** Datadog or similar

---

## Security Architecture

### Network Security
```
Internet
   │
   ▼
CloudFlare / WAF
   │
   ├─ DDoS protection
   ├─ Web Application Firewall
   └─ SSL/TLS termination
   │
   ▼
Load Balancer (HTTP/HTTPS only)
   │
   ├─ Rate limiting
   └─ Request routing
   │
   ▼
API Gateway
   ├─ CORS validation
   ├─ Request logging
   └─ Authentication check
   │
   ▼
Backend Services (behind VPC)
```

### Data Security
- Passwords hashed with bcrypt (cost factor 12)
- JWTs signed with HS256
- Refresh tokens stored in HTTPOnly cookies
- HTTPS required in production
- SQL injection prevention via Prisma ORM
- XSS protection via output encoding
- CSRF tokens for state-changing requests
- Audit logs for all sensitive operations
- Encryption at rest for sensitive data (optional)

### Access Control
```
User Role: admin → Full system access
User Role: manager → Read/write orders & quotes, manage users
User Role: seller → Read/write own orders, read quotes
User Role: viewer → Read-only all data
```

---

## Performance Optimization Strategy

### Database
- Indexes on frequently queried columns (status, company, delivery_date)
- Connection pooling (PgBouncer)
- Query optimization and N+1 prevention
- Materialized views for complex reports

### API
- Response compression (gzip)
- Pagination (default 20 items)
- Select fields to return only needed data
- Redis caching for frequently accessed data
- Async operations for heavy computations

### Frontend
- Code splitting with lazy loading
- Image optimization and lazy loading
- CSS minification
- Bundle analysis
- Service Worker for offline support
- Virtual scrolling for large lists

---

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers (scale-out multiple instances)
- Load balancing across instances
- Shared database connection pool
- Separate read replicas for reporting

### Vertical Scaling
- Database hardware upgrades
- API server resource increases
- CDN for static content delivery

### Future Enhancements
- Microservices architecture (if needed)
- Event-driven architecture (Kafka/RabbitMQ)
- GraphQL API (in addition to REST)
- Mobile app (React Native or Flutter)

