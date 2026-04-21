# Orderly Hub - Implementation Guide

## Quick Start Guide

This guide provides step-by-step instructions to transform Orderly Hub from a frontend-only application to a fully functional system.

---

## Step 1: Choose Your Technology Stack

### Recommended Backend Stack
```
Backend Framework: Node.js + Express.js (or NestJS for larger scale)
Database: PostgreSQL 14+
ORM: Prisma or TypeORM (TypeScript support)
Authentication: Passport.js with JWT
Validation: Zod or Joi
Testing: Jest + Supertest
```

### Alternative Options
- **Python:** FastAPI + SQLAlchemy + PostgreSQL
- **Go:** Gin + GORM + PostgreSQL
- **Java:** Spring Boot + JPA + PostgreSQL

---

## Step 2: Database Schema Design

### Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'seller', 'viewer'
  company VARCHAR(100),
  two_factor_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

-- Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  cnpj VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sellers
CREATE TABLE sellers (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(20),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  os VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  seller_id UUID REFERENCES sellers(id),
  order_date DATE NOT NULL,
  delivery_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  payment_methods VARCHAR[] NOT NULL,
  installments INTEGER DEFAULT 1,
  is_rma BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_id UUID REFERENCES users(id)
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  projected_value DECIMAL(12, 2),
  purchase_value DECIMAL(12, 2),
  product_delivery_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Sub-Purchases
CREATE TABLE sub_purchases (
  id UUID PRIMARY KEY,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  supplier VARCHAR(255) NOT NULL,
  buyer VARCHAR(255),
  selected_quantity INTEGER NOT NULL,
  purchase_value DECIMAL(12, 2),
  payment_method VARCHAR(50),
  installments INTEGER,
  purchase_date DATE,
  product_delivery_date DATE,
  receipt_date DATE,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial Details
CREATE TABLE order_financials (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  initial_product_cost DECIMAL(12, 2),
  final_product_cost DECIMAL(12, 2),
  boleto_cost DECIMAL(12, 2),
  gift_cost DECIMAL(12, 2),
  credit_cost_percent DECIMAL(5, 2),
  credit_cost_value DECIMAL(12, 2),
  debit_cost_percent DECIMAL(5, 2),
  debit_cost_value DECIMAL(12, 2),
  purchase_tax_percent DECIMAL(5, 2),
  purchase_tax_value DECIMAL(12, 2),
  sales_tax_percent DECIMAL(5, 2),
  sales_tax_value DECIMAL(12, 2),
  sales_value DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Freight/Delivery Cards
CREATE TABLE freight_cards (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  rma_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  delivery_person VARCHAR(255),
  value DECIMAL(12, 2),
  delivery_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RMA (Returns Management)
CREATE TABLE rmas (
  id UUID PRIMARY KEY,
  rma_number VARCHAR(50) NOT NULL UNIQUE,
  parent_order_id UUID NOT NULL REFERENCES orders(id),
  status VARCHAR(50) NOT NULL,
  actual_delivery_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RMA Items
CREATE TABLE rma_items (
  id UUID PRIMARY KEY,
  rma_id UUID NOT NULL REFERENCES rmas(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL,
  name VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  repaired_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  quote_index INTEGER NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  sales_person VARCHAR(255),
  highest_phase VARCHAR(50),
  observations TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote Phases
CREATE TABLE quote_phases (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL,
  phase_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

---

## Step 3: API Endpoint Specifications

### Authentication Endpoints

#### POST /api/auth/register
Register a new user (admin only)
```json
Request:
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "username",
  "full_name": "User Name",
  "role": "manager"
}

Response (201):
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "role": "manager",
  "token": "jwt_token"
}
```

#### POST /api/auth/login
```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (200):
{
  "token": "jwt_token",
  "requiresTwoFactor": true,
  "sessionId": "session_id"
}
```

#### POST /api/auth/verify-2fa
```json
Request:
{
  "sessionId": "session_id",
  "code": "123456"
}

Response (200):
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresIn": 3600
}
```

### Orders Endpoints

#### GET /api/orders
List all orders with filtering
```
Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: string (optional)
- company: string (optional)
- seller: string (optional)
- fromDate: ISO date (optional)
- toDate: ISO date (optional)
- search: string (optional - searches customer name, OS number)
- sort: string (default: -createdAt)

Response (200):
{
  "data": [
    {
      "id": "uuid",
      "os": "1001",
      "customer": "Customer Name",
      "status": "Bought",
      "deliveryDate": "2026-04-15",
      "salesValue": 3000,
      "company": "Lucky Store",
      "seller": "Alcides"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### POST /api/orders
Create new order
```json
Request:
{
  "customer": "Customer Name",
  "cnpj": "12.345.678/0001-90",
  "company": "Lucky Store",
  "seller": "Alcides",
  "orderDate": "2026-04-01",
  "deliveryDate": "2026-04-15",
  "status": "To Buy",
  "items": [
    {
      "name": "Product Name",
      "quantity": 2,
      "projectedValue": 1400,
      "status": "To Buy"
    }
  ],
  "salesValue": 3000
}

Response (201):
{
  "id": "uuid",
  "os": "1001",
  "status": "To Buy"
}
```

#### GET /api/orders/:id
Get order details
```
Response (200):
{
  "id": "uuid",
  "os": "1001",
  "customer": "Customer Name",
  "items": [
    {
      "id": "uuid",
      "name": "Product Name",
      "quantity": 2,
      "status": "To Buy",
      "projectedValue": 1400,
      "purchaseValue": 1350
    }
  ],
  "financials": {
    "initialProductCost": 1500,
    "finalProductCost": 1500,
    "creditCostValue": 60,
    "salesValue": 3000
  }
}
```

#### PUT /api/orders/:id
Update order

#### PATCH /api/orders/:id/status
```json
Request:
{
  "status": "Bought"
}

Response (200):
{
  "id": "uuid",
  "status": "Bought"
}
```

#### PATCH /api/orders/:id/items/:itemId/status
```json
Request:
{
  "status": "In Stock"
}
```

#### DELETE /api/orders/:id
Delete order (soft delete recommended)

### Quotes Endpoints
- GET /api/quotes
- POST /api/quotes
- GET /api/quotes/:id
- PUT /api/quotes/:id
- DELETE /api/quotes/:id
- PATCH /api/quotes/:id/phase
- POST /api/quotes/:id/convert (convert quote to order)

### RMA Endpoints
- GET /api/rma
- POST /api/rma
- GET /api/rma/:id
- PUT /api/rma/:id
- PATCH /api/rma/:id/items/:itemId/status
- PATCH /api/rma/:id/close

### Analytics Endpoints
- GET /api/analytics/summary
- GET /api/analytics/orders-by-status
- GET /api/analytics/revenue
- GET /api/analytics/company-stats

---

## Step 4: Frontend Integration Points

### Update AuthStore.tsx
```typescript
// Replace mock authentication with API calls
import { useState, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    // Handle 2FA requirement
    return { success: true, requiresTwoFactor: data.requiresTwoFactor };
  }, []);

  const verifyCode = useCallback(async (sessionId: string, code: string) => {
    const response = await fetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code })
    });
    const data = await response.json();
    setToken(data.accessToken);
    localStorage.setItem('token', data.accessToken);
    return true;
  }, []);

  return { login, verifyCode, token };
}
```

### Update OrderStore.tsx
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useOrders() {
  const queryClient = useQueryClient();
  const token = localStorage.getItem('token');

  const { data = { data: [], pagination: {} }, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    }
  });

  const addOrderMutation = useMutation({
    mutationFn: async (order: Order) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(order)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const addOrder = useCallback((order: Order) => {
    addOrderMutation.mutate(order);
  }, [addOrderMutation]);

  return {
    orders: data.data,
    addOrder,
    isLoading
  };
}
```

---

## Step 5: Error Handling

### Standard Error Response Format
```json
{
  "error": true,
  "message": "Order not found",
  "statusCode": 404,
  "code": "ORDER_NOT_FOUND"
}
```

### Error Codes to Implement
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `CONFLICT` (409) - Duplicate order
- `INTERNAL_SERVER_ERROR` (500)

### Frontend Error Handling
```typescript
function handleApiError(error: unknown) {
  if (error instanceof TypeError) {
    return "Network error. Please check your connection.";
  }
  
  const apiError = error as any;
  switch (apiError.statusCode) {
    case 401:
      // Redirect to login
      break;
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return "The requested resource was not found.";
    case 422:
      return apiError.message || "Please check your input.";
    default:
      return "An unexpected error occurred.";
  }
}
```

---

## Step 6: Testing Strategy

### Backend Tests (Jest)
```javascript
// Example test
describe('Order API', () => {
  it('should create a new order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customer: 'Test Customer',
        deliveryDate: '2026-04-15'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.os).toBeDefined();
  });

  it('should return 401 without auth token', async () => {
    const response = await request(app)
      .get('/api/orders');

    expect(response.status).toBe(401);
  });
});
```

### Frontend Tests (Vitest)
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderModal } from '@/components/OrderModal';

describe('OrderModal', () => {
  it('should submit order form', async () => {
    const mockSubmit = vi.fn();
    render(<OrderModal onSubmit={mockSubmit} />);
    
    fireEvent.click(screen.getByText('Create Order'));
    
    expect(mockSubmit).toHaveBeenCalled();
  });
});
```

---

## Step 7: Deployment

### Environment Variables

**.env.development**
```
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Orderly Hub
```

**.env.production**
```
VITE_API_URL=https://api.orderly-hub.com/api
VITE_APP_NAME=Orderly Hub
```

### Build & Deploy Frontend
```bash
npm run build
# Deploy to Vercel/Netlify/AWS S3 + CloudFront
```

### Build & Deploy Backend
```bash
docker build -t orderly-hub-api .
docker push registry.example.com/orderly-hub-api
# Deploy using Kubernetes or Docker Swarm
```

---

## Security Checklist

- [ ] HTTPS only in production
- [ ] JWT tokens expire after 1 hour
- [ ] Refresh tokens expire after 7 days
- [ ] Password hashed with bcrypt (cost factor 12)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS protection via output encoding
- [ ] CSRF tokens on state-changing requests
- [ ] Rate limiting (e.g., 100 requests/minute)
- [ ] Audit logging for sensitive operations
- [ ] Data encryption at rest (optional but recommended)
- [ ] CORS properly configured

---

## Performance Optimization

### Database Optimization
- Add indexes on frequently queried columns
- Use pagination (default 20 items/page)
- Implement query caching with Redis

### API Optimization
- Compress responses (gzip)
- Implement pagination
- Use select to return only needed fields
- Implement query result caching

### Frontend Optimization
- Code splitting with lazy loading
- Image optimization
- CSS minification
- Bundle analysis with bundlesize

---

## Next Steps

1. **Set up backend project** - Choose framework and initialize project
2. **Design database** - Create PostgreSQL database with schema above
3. **Implement authentication** - JWT + 2FA
4. **Build core API endpoints** - Start with Orders API
5. **Integrate frontend** - Replace mock stores with API calls
6. **Write tests** - Unit, integration, and E2E tests
7. **Deploy** - Set up infrastructure and CI/CD
8. **Monitor** - Set up error tracking and performance monitoring

---

## Resources

- Vite Documentation: https://vitejs.dev
- React Documentation: https://react.dev
- React Query Documentation: https://tanstack.com/query
- Shadcn UI Documentation: https://ui.shadcn.com
- PostgreSQL Documentation: https://www.postgresql.org/docs
- Express.js Documentation: https://expressjs.com
- JWT Authentication: https://jwt.io

