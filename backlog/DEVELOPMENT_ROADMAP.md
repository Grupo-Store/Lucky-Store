# Orderly Hub - Development Roadmap & Progress Tracker

## Project Status Overview

| Component | Status | Priority | Est. Days |
|-----------|--------|----------|-----------|
| Backend API Setup | ⬜ Not Started | P0 | 7 |
| Database Schema | ⬜ Not Started | P0 | 3 |
| Authentication | ⬜ Not Started | P0 | 5 |
| Core API Endpoints | ⬜ Not Started | P0 | 10 |
| Frontend Integration | ⬜ Not Started | P0 | 8 |
| Error Handling | ⬜ Not Started | P1 | 3 |
| Testing Suite | ⬜ Not Started | P1 | 5 |
| Deployment Setup | ⬜ Not Started | P1 | 5 |

---

## Phase 1: Backend Infrastructure (Weeks 1-2)

### Week 1: Project Setup

#### Day 1: Initial Setup
- [ ] Create backend repository
- [ ] Initialize Node.js project (`npm init`)
- [ ] Install dependencies:
  ```bash
  npm install express cors dotenv bcryptjs jsonwebtoken passport passport-jwt
  npm install prisma @prisma/client
  npm install zod joi
  npm install -D typescript ts-node @types/node @types/express
  ```
- [ ] Set up TypeScript configuration
- [ ] Create basic Express server
- [ ] Set up environment variables

#### Day 2: Database Setup
- [ ] Install PostgreSQL locally or use cloud PostgreSQL
- [ ] Create database instance
- [ ] Set up Prisma:
  ```bash
  npx prisma init
  ```
- [ ] Configure database connection string in `.env`
- [ ] Create initial Prisma schema (users, orders, companies, etc.)

#### Day 3: Authentication Foundation
- [ ] Create JWT utility functions
- [ ] Set up bcrypt password hashing
- [ ] Create AuthService
- [ ] Create AuthController with login endpoint
- [ ] Test authentication with Postman/Insomnia

#### Day 4: Database Migration
- [ ] Run initial Prisma migration:
  ```bash
  npx prisma migrate dev --name init
  ```
- [ ] Seed database with sample data
- [ ] Verify database structure
- [ ] Create indexes

#### Day 5: Error Handling & Logging
- [ ] Create error handler middleware
- [ ] Set up logging (Winston/Pino)
- [ ] Create custom error classes
- [ ] Implement error response formatting

### Week 2: Core API Endpoints

#### Day 6-7: Orders API
- [ ] Create OrderController
- [ ] Create OrderService
- [ ] Create OrderRepository
- [ ] Implement endpoints:
  - [ ] POST /api/orders
  - [ ] GET /api/orders
  - [ ] GET /api/orders/:id
  - [ ] PUT /api/orders/:id
  - [ ] DELETE /api/orders/:id

#### Day 8-9: Quotes & RMA API
- [ ] Implement Quotes endpoints
- [ ] Implement RMA endpoints
- [ ] Create order-to-quote conversion

#### Day 10: API Testing
- [ ] Write integration tests
- [ ] Test all endpoints
- [ ] Test error scenarios
- [ ] Test authorization

---

## Phase 2: Frontend Integration (Weeks 3-4)

### Week 3: API Client & Auth

#### Day 1: API Client Setup
- [ ] Create API client utility with axios/fetch
- [ ] Set up request/response interceptors
- [ ] Handle authentication headers
- [ ] Create API constants

#### Day 2-3: Update AuthStore
- [ ] Replace mock authentication
- [ ] Integrate real login endpoint
- [ ] Implement 2FA verification
- [ ] Handle token storage

#### Day 4: Update OrderStore
- [ ] Replace React Context with React Query
- [ ] Update useOrders hook
- [ ] Set up data caching

#### Day 5: Update QuoteStore
- [ ] Replace React Context with React Query
- [ ] Update useQuotes hook

### Week 4: UI Integration

#### Day 1-2: Update Modals
- [ ] Update OrderModal to use API
- [ ] Update QuoteModal to use API
- [ ] Update RmaModal to use API
- [ ] Add loading states

#### Day 3-4: Update List Views
- [ ] Update Sales page to fetch from API
- [ ] Update Dashboard to fetch analytics from API
- [ ] Implement pagination

#### Day 5: Error Handling & Notifications
- [ ] Show API errors in UI
- [ ] Implement error retry logic
- [ ] Test error scenarios

---

## Phase 3: Quality Assurance (Weeks 5-6)

### Week 5: Testing

#### Backend Tests
- [ ] Unit tests for services
- [ ] Integration tests for API endpoints
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] Validation tests

#### Frontend Tests
- [ ] Component unit tests
- [ ] Hook tests
- [ ] Modal interaction tests
- [ ] Form validation tests

### Week 6: E2E Testing & QA

- [ ] Write E2E tests (Cypress/Playwright)
- [ ] Test complete workflows
- [ ] Performance testing
- [ ] Browser compatibility testing
- [ ] Bug fixing and polish

---

## Phase 4: Deployment (Weeks 7-8)

### Week 7: Infrastructure

- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Set up Docker containers
- [ ] Create CI/CD pipeline (GitHub Actions)
- [ ] Configure CORS for production

### Week 8: Deployment

- [ ] Deploy backend (Heroku/Railway/AWS)
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Set up SSL/HTTPS
- [ ] Set up monitoring
- [ ] Create deployment documentation

---

## Development Quick Reference

### Common Commands

#### Backend
```bash
# Start development server
npm run dev

# Run migrations
npx prisma migrate dev --name {migration_name}

# Open Prisma Studio
npx prisma studio

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Build for production
npm run build

# Start production server
npm start
```

#### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

### Database Queries (Using Prisma)

```typescript
// Create
const order = await prisma.order.create({
  data: {
    os: '1001',
    customer: 'John Doe',
    deliveryDate: new Date('2026-04-15'),
    // ... more fields
  },
});

// Read
const order = await prisma.order.findUnique({
  where: { id: 'uuid' },
  include: { items: true },
});

// List with pagination
const orders = await prisma.order.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});

// Update
const order = await prisma.order.update({
  where: { id: 'uuid' },
  data: { status: 'Bought' },
});

// Delete
await prisma.order.delete({
  where: { id: 'uuid' },
});
```

### API Response Examples

#### Success
```typescript
res.json({
  success: true,
  data: order,
});
```

#### Error
```typescript
res.status(400).json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
  },
});
```

### Frontend Hooks Usage

```typescript
import { useOrders } from '@/store/OrderStore';
import { useQuery } from '@tanstack/react-query';

function OrdersComponent() {
  // Using React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: () => fetch('/api/orders').then(r => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(order => (
        <div key={order.id}>{order.os}</div>
      ))}
    </div>
  );
}
```

### Authentication Pattern

```typescript
// In backend middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// In frontend
const token = localStorage.getItem('token');
fetch('/api/orders', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

---

## Git Workflow

### Feature Branch Strategy
```bash
# Create feature branch
git checkout -b feature/add-order-api

# Make changes and commit
git add .
git commit -m "feat: add order API endpoints"

# Push to remote
git push origin feature/add-order-api

# Create Pull Request on GitHub
# After review and approval, merge to main

# Update local main
git checkout main
git pull origin main
```

### Commit Message Format
```
feat: add order API endpoints
fix: correct validation error handling
docs: update API documentation
test: add integration tests for orders
refactor: reorganize service layer
style: format code
chore: update dependencies
```

---

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/orderly_hub

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_SECRET=your_refresh_secret
REFRESH_TOKEN_EXPIRES_IN=604800

# 2FA
TOTP_WINDOW=1

# CORS
CORS_ORIGIN=http://localhost:5173

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Orderly Hub
```

---

## Deployment Checklist

### Pre-deployment
- [ ] All tests pass
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Secrets stored securely
- [ ] Deployment script created

### Deployment
- [ ] Database backup taken
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] DNS updated (if needed)
- [ ] Smoke tests run
- [ ] Monitoring alerts configured

### Post-deployment
- [ ] Verify all endpoints working
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Test user workflows
- [ ] Document any issues

---

## Useful Resources

### Documentation
- [Express.js Documentation](https://expressjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)
- [React Query Documentation](https://tanstack.com/query/latest)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

### Tools & Services
- **API Testing:** Postman, Insomnia, ThunderClient
- **Database GUI:** Prisma Studio, pgAdmin, DBeaver
- **Monitoring:** Sentry, DataDog, New Relic
- **Hosting:** Vercel, Netlify, Railway, Render, AWS, Azure
- **CI/CD:** GitHub Actions, GitLab CI, CircleCI

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Secure Password Hashing](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

## Troubleshooting Guide

### Common Issues

#### Database Connection Error
```
Error: connect ECONNREFUSED
Solution: Check DATABASE_URL in .env, ensure PostgreSQL is running
```

#### JWT Token Expired
```
Error: TokenExpiredError
Solution: Implement token refresh endpoint, check JWT_EXPIRES_IN setting
```

#### CORS Error
```
Error: Access to XMLHttpRequest blocked by CORS policy
Solution: Check CORS_ORIGIN in backend .env, ensure frontend URL is whitelisted
```

#### API Request Hangs
```
Solution: Check API response in browser DevTools, ensure backend is running
Verify network connectivity, check API endpoint URL
```

#### Database Migration Fails
```
Solution: Check for conflicts with existing migrations
Review SQL syntax in migration file
Test migration locally before deploying
```

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API response time (p95) | < 200ms | — |
| Dashboard load time | < 2s | — |
| Order list page load | < 1s | — |
| Frontend Lighthouse score | > 90 | — |
| Database query time (p95) | < 100ms | — |
| Uptime | 99.9% | — |

---

## Team Roles & Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Backend Lead** | Database design, API development, deployment |
| **Frontend Lead** | UI components, state management, integration |
| **QA Engineer** | Testing, bug reporting, performance testing |
| **DevOps** | Infrastructure, CI/CD, monitoring, backups |
| **Product Manager** | Requirements, priorities, roadmap |

---

## Next Immediate Steps

### For Getting Started (This Week):
1. Set up backend project structure
2. Configure PostgreSQL database
3. Create Prisma schema
4. Build authentication service
5. Implement first API endpoint (Orders GET)

### Dependencies to Install:
```bash
# Backend
npm install express cors dotenv bcryptjs jsonwebtoken
npm install prisma @prisma/client
npm install zod

# Testing
npm install -D jest ts-jest supertest @types/jest
```

### Files to Create:
- Backend: `src/main.ts`, `.env`, `prisma/schema.prisma`
- Tests: `tests/setup.ts`, `tests/auth.test.ts`
- Configuration: `tsconfig.json`, `.gitignore`

---

This roadmap should be updated as progress is made. Check off items as they're completed!

