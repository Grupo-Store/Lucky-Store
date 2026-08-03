# Orderly Hub - Implementation Guide 2026

## Technology Stack ✅ DECIDIDO

- **Frontend:** React 18 + TypeScript + Vite + Shadcn UI
- **Backend:** Python + FastAPI 0.104+ ✅
- **Database:** PostgreSQL 14+ (local dev) + Railway PostgreSQL (produção) ✅
- **ORM:** SQLAlchemy 2.x + Alembic ✅
- **Validação:** Pydantic v2 ✅
- **Deployment:** Railway (backend + DB) + Vercel (frontend) ✅

---

## Python + FastAPI — Setup ✅ CONCLUÍDO

### Estrutura criada em `backend/`

```bash
# Ambiente virtual e dependências
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Banco local (primeira vez)
psql -U postgres -c "CREATE DATABASE orderly_hub;"
psql -U postgres -d orderly_hub -f ../database/updated/DATABASE_INIT.sql

# Migrations Alembic
alembic revision --autogenerate -m "init"
alembic upgrade head

# Subir servidor de desenvolvimento
uvicorn main:app --reload
# Acesso: http://localhost:8000
# Docs:   http://localhost:8000/docs
```

### Estrutura real do projeto (April 25, 2026)

```
backend/
├── main.py                  ✅ FastAPI app, CORS, exception handler, /health
├── alembic.ini              ✅ configurado
├── Procfile                 ✅ para Railway
├── railway.toml             ✅ healthcheck + restart policy
├── requirements.txt         ✅ todas dependências
├── .env                     ✅ DATABASE_URL, JWT_SECRET, CORS, 2FA
│
├── alembic/
│   ├── env.py               ✅ wired com Base.metadata + settings
│   ├── script.py.mako       ✅
│   └── versions/            ✅ (aguarda primeira migration)
│
├── app/
│   ├── config.py            ✅ Pydantic Settings
│   ├── database.py          ✅ engine + SessionLocal + get_db
│   │
│   ├── models/
│   │   ├── user.py          ✅ User, UserRole enum, soft delete
│   │   ├── order.py         ⬜ pendente
│   │   ├── quote.py         ⬜ pendente
│   │   ├── rma.py           ⬜ pendente
│   │   └── audit.py         ⬜ pendente
│   │
│   ├── schemas/
│   │   ├── user.py          ✅ UserCreate, UserResponse, Login, TOTP
│   │   ├── order.py         ⬜ pendente
│   │   └── quote.py         ⬜ pendente
│   │
│   ├── services/
│   │   ├── auth.py          ✅ register, login, TOTP, tokens, logout
│   │   ├── order_service.py ⬜ pendente
│   │   └── audit_service.py ⬜ pendente
│   │
│   ├── api/routes/
│   │   ├── __init__.py      ✅ router central
│   │   ├── auth.py          ✅ 8 endpoints completos
│   │   ├── orders.py        ⬜ pendente
│   │   ├── quotes.py        ⬜ pendente
│   │   └── rma.py           ⬜ pendente
│   │
│   ├── middleware/          # Custom middleware (a implementar)
│   │   ├── __init__.py
│   │   ├── auth.py          # JWT verification
│   │   └── error_handler.py
│   │
│   └── utils/               # Utility functions
│       ├── __init__.py
│       ├── security.py      # Password hashing, JWT
│       ├── logger.py        # Logging
│       └── errors.py        # Custom exceptions
│
├── tests/                   # Test files
│   ├── __init__.py
│   ├── test_auth.py
│   ├── test_orders.py
│   └── conftest.py
│
├── .env                     # Environment variables
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
└── README.md
```

### Database Models Example

```python
# app/models/order.py
from sqlalchemy import Column, String, DateTime, UUID, Numeric, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.database import Base

class Order(Base):
    __tablename__ = "pedidos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    id_vendedor = Column(UUID(as_uuid=True), ForeignKey("vendedores.id"), nullable=False)
    id_cliente = Column(UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False)
    
    numero_os = Column(String(50), nullable=False)
    numero_nf = Column(String(50), nullable=False)
    numero_oc = Column(String(50), nullable=True)
    
    data_pedido = Column(DateTime, nullable=False)
    data_entrega = Column(DateTime, nullable=False)
    
    status = Column(String(50), nullable=False, default="To Buy")
    valor_venda = Column(Numeric(12, 2), nullable=True)
    parcelas = Column(Integer, nullable=False, default=1)
    
    observacao = Column(Text, nullable=True)
    
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    costs = relationship("OrderCost", uselist=False, back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('id_loja', 'numero_nf', name='uq_loja_nf'),
    )
```

### Authentication Endpoints

```python
# app/api/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.auth_service import AuthService
from app.utils.security import verify_password, get_password_hash

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class VerifyTOTPRequest(BaseModel):
    session_id: str
    code: str

@router.post("/login")
async def login(request: LoginRequest, db = Depends(get_db)):
    """Login with email and password, returns sessionId"""
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    session_id = AuthService.create_session(user.id)
    
    return {
        "session_id": session_id,
        "requires_mfa": user.two_factor_secret is not None
    }

@router.post("/verify-2fa")
async def verify_2fa(request: VerifyTOTPRequest, db = Depends(get_db)):
    """Verify TOTP code and return JWT tokens"""
    session = AuthService.get_session(request.session_id)
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    
    if not AuthService.verify_totp(user.two_factor_secret, request.code):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    
    access_token = AuthService.create_access_token(user.id)
    refresh_token = AuthService.create_refresh_token(user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": 3600  # 1 hour
    }
```

### Order Service Example

```python
# app/services/order_service.py
from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem
from app.models.audit import AuditLog, StatusHistory
from datetime import datetime
from decimal import Decimal

class OrderService:
    @staticmethod
    async def create_order(db: Session, order_data: dict, user_id: str):
        """Create new order with audit trail"""
        
        # Validate business rules
        existing = db.query(Order).filter(
            Order.id_loja == order_data["id_loja"],
            Order.numero_nf == order_data["numero_nf"],
            Order.deleted_at.is_(None)
        ).first()
        
        if existing:
            raise ValueError("Order with this NF already exists in this store")
        
        # Create order
        order = Order(
            **order_data,
            created_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(order)
        db.flush()  # Get order.id before commit
        
        # Log in audit_logs
        audit = AuditLog(
            entity_type="pedido",
            entity_id=order.id,
            action="CREATE",
            changed_by=user_id,
            changed_at=datetime.utcnow(),
            old_values=None,
            new_values=order_data,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        db.add(audit)
        db.commit()
        
        return order
    
    @staticmethod
    async def update_order_status(db: Session, order_id: str, new_status: str, user_id: str, reason: str = None):
        """Update order status and record in history"""
        
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Order not found")
        
        old_status = order.status
        
        # Validate status transition
        valid_transitions = {
            "To Buy": ["Bought", "Cancelled"],
            "Bought": ["Received", "Cancelled"],
            "Received": ["To Invoice"],
            # ... more transitions
        }
        
        if new_status not in valid_transitions.get(old_status, []):
            raise ValueError(f"Cannot transition from {old_status} to {new_status}")
        
        # Update status
        order.status = new_status
        order.updated_at = datetime.utcnow()
        
        # Record in status_history
        status_history = StatusHistory(
            entity_type="pedido",
            entity_id=order_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=user_id,
            changed_at=datetime.utcnow(),
            reason=reason
        )
        
        # Record in audit_logs
        audit = AuditLog(
            entity_type="pedido",
            entity_id=order_id,
            action="UPDATE",
            changed_by=user_id,
            changed_at=datetime.utcnow(),
            old_values={"status": old_status},
            new_values={"status": new_status},
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        
        db.add_all([order, status_history, audit])
        db.commit()
        
        return order
```

---

## Path B: Node.js + Express Implementation

### Project Setup

```bash
# Create project
mkdir orderly-hub-backend
cd orderly-hub-backend

# Initialize Node.js
npm init -y

# Install dependencies
npm install express cors dotenv bcryptjs jsonwebtoken @prisma/client speakeasy passport passport-jwt multer

# Install dev dependencies
npm install -D typescript ts-node nodemon @types/node @types/express @types/node

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init

# Generate Prisma client from DATABASE_INIT.sql
npx prisma db pull
npx prisma generate
```

### Project Structure

```
orderly-hub-backend/
├── src/
│   ├── index.ts           # Express app
│   ├── config.ts          # Configuration
│   ├── middleware/
│   │   ├── auth.ts        # JWT verification
│   │   ├── errorHandler.ts
│   │   └── requestLogger.ts
│   ├── routes/
│   │   ├── auth.ts        # /api/auth
│   │   ├── orders.ts      # /api/orders
│   │   ├── quotes.ts      # /api/quotes
│   │   └── rma.ts         # /api/rma
│   ├── services/
│   │   ├── authService.ts
│   │   ├── orderService.ts
│   │   ├── quoteService.ts
│   │   ├── rmaService.ts
│   │   └── auditService.ts
│   ├── utils/
│   │   ├── security.ts    # Password, JWT, TOTP
│   │   ├── errors.ts      # Custom errors
│   │   └── logger.ts
│   └── types/
│       └── index.ts       # TypeScript types
│
├── prisma/
│   ├── schema.prisma      # Prisma schema
│   └── migrations/        # DB migrations
│
├── tests/
│   ├── auth.test.ts
│   ├── orders.test.ts
│   └── setup.ts
│
├── .env
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

### Prisma Schema (Partial)

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
  @@map("users")
}

model Pedido {
  id              String   @id @default(uuid())
  idLoja          String   @map("id_loja")
  idVendedor      String   @map("id_vendedor")
  idCliente       String   @map("id_cliente")
  
  numeroOs        String   @map("numero_os")
  numeroNf        String   @map("numero_nf")
  numeroOc        String?  @map("numero_oc")
  
  dataPedido      DateTime @map("data_pedido")
  dataEntrega     DateTime @map("data_entrega")
  
  status          String
  valorVenda      Decimal  @db.Decimal(12, 2) @map("valor_venda")
  parcelas        Int      @default(1)
  
  observacao      String?
  
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  @@unique([idLoja, numeroNf])
  @@index([status])
  @@index([dataEntrega])
  @@map("pedidos")
}

model AuditLog {
  id              String   @id @default(uuid())
  entityType      String   @map("entity_type")
  entityId        String   @map("entity_id")
  action          String   // CREATE, UPDATE, DELETE
  
  changedBy       String   @map("changed_by")
  changedAt       DateTime @default(now()) @map("changed_at")
  
  oldValues       Json?    @map("old_values")
  newValues       Json?    @map("new_values")
  
  ipAddress       String?  @map("ip_address")
  userAgent       String?  @map("user_agent")
  
  @@index([entityType, entityId])
  @@index([changedAt])
  @@map("audit_logs")
}

model StatusHistory {
  id              String   @id @default(uuid())
  entityType      String   @map("entity_type")
  entityId        String   @map("entity_id")
  
  oldStatus       String?  @map("old_status")
  newStatus       String   @map("new_status")
  
  changedBy       String   @map("changed_by")
  changedAt       DateTime @default(now()) @map("changed_at")
  
  reason          String?
  
  @@index([entityType, entityId])
  @@map("status_history")
}
```

### Authentication Service

```typescript
// src/services/authService.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';

const prisma = new PrismaClient();

export class AuthService {
  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      throw new Error('Invalid email or password');
    }
    
    // Create temporary session
    const sessionId = jwt.sign(
      { userId: user.id, type: 'session' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
    
    return {
      sessionId,
      requiresMfa: user.twoFactorSecret !== null
    };
  }
  
  static async verify2FA(sessionId: string, code: string) {
    // Verify session
    const decoded = jwt.verify(sessionId, process.env.JWT_SECRET!) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    
    if (!user) throw new Error('User not found');
    
    // Verify TOTP
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });
    
    if (!verified) {
      throw new Error('Invalid TOTP code');
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    return {
      accessToken,
      refreshToken,
      tokenType: 'bearer',
      expiresIn: 3600
    };
  }
}
```

### Order Service

```typescript
// src/services/orderService.ts
import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export class OrderService {
  static async createOrder(
    data: any,
    userId: string,
    request: Request
  ) {
    // Validate unique NF
    const existing = await prisma.pedido.findFirst({
      where: {
        idLoja: data.idLoja,
        numeroNf: data.numeroNf,
        deletedAt: null
      }
    });
    
    if (existing) {
      throw new Error('Order with this NF already exists');
    }
    
    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.pedido.create({
        data: {
          ...data,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      // Log audit
      await tx.auditLog.create({
        data: {
          entityType: 'pedido',
          entityId: order.id,
          action: 'CREATE',
          changedBy: userId,
          changedAt: new Date(),
          oldValues: null,
          newValues: data,
          ipAddress: request.ip,
          userAgent: request.get('user-agent')
        }
      });
      
      return order;
    });
    
    return order;
  }
  
  static async updateOrderStatus(
    orderId: string,
    newStatus: string,
    userId: string,
    reason: string,
    request: Request
  ) {
    const order = await prisma.pedido.findUnique({
      where: { id: orderId }
    });
    
    if (!order) throw new Error('Order not found');
    
    const oldStatus = order.status;
    
    // Validate transition
    const validTransitions: Record<string, string[]> = {
      "To Buy": ["Bought", "Cancelled"],
      "Bought": ["Received", "Cancelled"],
      // ... more
    };
    
    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
    }
    
    // Update with audit trail
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.pedido.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          updatedAt: new Date()
        }
      });
      
      // Record status history
      await tx.statusHistory.create({
        data: {
          entityType: 'pedido',
          entityId: orderId,
          oldStatus,
          newStatus,
          changedBy: userId,
          changedAt: new Date(),
          reason
        }
      });
      
      // Record audit log
      await tx.auditLog.create({
        data: {
          entityType: 'pedido',
          entityId: orderId,
          action: 'UPDATE',
          changedBy: userId,
          changedAt: new Date(),
          oldValues: { status: oldStatus },
          newValues: { status: newStatus },
          ipAddress: request.ip,
          userAgent: request.get('user-agent')
        }
      });
      
      return updated;
    });
    
    return updated;
  }
}
```

---

## Frontend Integration

### API Client Setup

```typescript
// src/api/client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - attach token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh-token`, {
            refreshToken
          });
          
          localStorage.setItem('accessToken', response.data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
          
          return apiClient(originalRequest);
        } catch (err) {
          // Logout user
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### React Query Hooks

```typescript
// src/hooks/useOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

export const useOrders = (filters?: any) => {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/orders', { params: filters });
      return data;
    }
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newOrder: any) => {
      const { data } = await apiClient.post('/api/orders', newOrder);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ orderId, status }: any) => {
      const { data } = await apiClient.patch(`/api/orders/${orderId}/status`, {
        newStatus: status
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });
};
```

---

## Testing Example

### Backend Test

```python
# tests/test_auth.py (Python/FastAPI)
import pytest
from app.services.auth_service import AuthService

@pytest.mark.asyncio
async def test_login_success(db, client):
    """Test successful login"""
    response = client.post("/api/auth/login", json={
        "email": "seller@example.com",
        "password": "password123"
    })
    
    assert response.status_code == 200
    assert "session_id" in response.json()
    assert response.json()["requires_mfa"] == True

@pytest.mark.asyncio
async def test_login_invalid_password(db, client):
    """Test login with wrong password"""
    response = client.post("/api/auth/login", json={
        "email": "seller@example.com",
        "password": "wrongpassword"
    })
    
    assert response.status_code == 401
```

---

## Deployment

### Docker Setup

```dockerfile
# Dockerfile (Python FastAPI)
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# Dockerfile (Node.js Express)
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

## Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/orderly_hub

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ALGORITHM=HS256

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# App
APP_ENV=development
APP_DEBUG=true
LOG_LEVEL=DEBUG

# TOTP (2FA)
TOTP_ISSUER=OrderlyHub
TOTP_WINDOW=1

# Email (future)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-password
```

---

**Implementation Status:** ✅ Ready to Code  
**Start Date:** April 22, 2026  
**Choose Backend:** Python FastAPI OR Node.js Express
