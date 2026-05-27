# Orderly Hub

Sistema de gestão de pedidos multi-empresa para Lucky Store, BTech e AJJ. Centraliza operações de vendas, cotações, RMA e financeiro com trilha de auditoria completa e conformidade com a LGPD.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Estado do servidor | TanStack Query v5 |
| Formulários | React Hook Form + Zod |
| Backend | Python 3.12 + FastAPI |
| ORM | SQLAlchemy 2.x + Alembic |
| Banco de dados | PostgreSQL 14+ |
| Autenticação | JWT + TOTP 2FA |
| Deploy backend | Railway |
| Deploy frontend | Vercel |

---

## Estrutura do projeto

```
orderly-hub/
├── src/                  # Frontend React + TypeScript
│   ├── components/       # Componentes reutilizáveis (shadcn/ui)
│   ├── pages/            # Páginas da aplicação
│   └── hooks/            # Custom hooks
├── backend/              # API Python FastAPI
│   ├── app/
│   │   ├── api/routes/   # Endpoints REST
│   │   ├── models/       # ORM SQLAlchemy
│   │   ├── schemas/      # Validação Pydantic
│   │   ├── services/     # Lógica de negócio
│   │   └── utils/        # Helpers (JWT, erros)
│   ├── alembic/          # Migrations de banco
│   ├── main.py           # Entry point FastAPI
│   ├── requirements.txt  # Dependências Python
│   └── .env.example      # Template de variáveis de ambiente
├── database/
│   └── updated/
│       └── DATABASE_INIT.sql  # Schema completo PostgreSQL
└── backlog/              # Documentação e roadmap do projeto
```

---

## Pré-requisitos

- Node.js 18+ e npm
- Python 3.12+
- PostgreSQL 14+

---

## Setup — Frontend

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
# Acesse: http://localhost:5173

# Build para produção
npm run build
```

---

## Setup — Backend

```bash
cd backend

# Criar e ativar ambiente virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais locais

# Rodar o servidor
uvicorn main:app --reload
# Acesse: http://localhost:8000/docs
```

---

## Setup — Banco de dados

```bash
# 1. Criar o banco no PostgreSQL
psql -U postgres -c "CREATE DATABASE orderly_hub;"

# 2. Criar todas as tabelas (22 tabelas + views + índices)
psql -U postgres -d orderly_hub -f database/updated/DATABASE_INIT.sql

# 3. Stampar o baseline do Alembic
cd backend
alembic stamp head

# 4. Verificar
alembic current
# deve mostrar: <revision_id> (head)
```

---

## Variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` e preencha:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `JWT_SECRET` | Chave secreta para tokens JWT (mín. 32 chars) |
| `JWT_ALGORITHM` | Algoritmo JWT (padrão: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiração do access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Expiração do refresh token |
| `ALLOWED_ORIGINS` | URLs permitidas no CORS |
| `TOTP_ISSUER` | Nome exibido no app autenticador |

---

## Endpoints de autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Criar usuário (admin only) |
| POST | `/api/auth/login` | Login com email e senha |
| POST | `/api/auth/verify-2fa` | Verificar código TOTP |
| POST | `/api/auth/refresh-token` | Renovar access token |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/auth/me` | Dados do usuário autenticado |
| POST | `/api/auth/2fa/setup` | Configurar 2FA |
| POST | `/api/auth/2fa/confirm` | Confirmar configuração 2FA |

Documentação completa disponível em `http://localhost:8000/docs` (Swagger UI).

---

## Banco de dados

O schema PostgreSQL inclui 22 tabelas com:

- **UUIDs** como chaves primárias (não sequenciais, mais seguro)
- **Soft deletes** via coluna `deleted_at` (dados recuperáveis)
- **Trilha de auditoria** completa (`status_history` + `audit_logs` com JSONB)
- **40+ índices** otimizados para as queries mais comuns
- **Views** de relatório (`resultado_mensal`, `resultado_anual`)
- **Conformidade LGPD** via exportação e exclusão de dados

---

## Papéis de usuário (RBAC)

| Papel | Permissões |
|---|---|
| `ADMIN` | Acesso total + gestão de usuários |

---

## Funcionalidades principais

- **Pedidos** — CRUD completo com histórico de status e audit log
- **Cotações** — Criação e conversão em pedidos
- **RMA** — Gestão de devoluções vinculadas a pedidos
- **Dashboard** — KPIs financeiros, metas e projeções
- **Financeiro** — Controle de despesas e formas de pagamento
- **Auditoria** — Rastreamento completo de alterações (LGPD)

---

## Equipe

| Nome | Frente principal |
|---|---|
| Rafael | Backend (ORM, Orders API, Audit) + CI/CD |
| Gustavo | Backend (Auth, Quotes API, Goals) + Railway DB |
| Duda | Backend (RMA API, Financial) + Monitoring |
| Peu | Frontend (API Client, RMA Modal) + Vercel |

---

## Status do projeto

- [x] Schema PostgreSQL completo (22 tabelas)
- [x] Backend FastAPI rodando (`localhost:8000/docs`)
- [x] Autenticação JWT + TOTP 2FA implementada
- [x] Alembic configurado com baseline
- [ ] ORM models (1/22 concluído)
- [ ] APIs de pedidos, cotações e RMA
- [ ] Integração frontend ↔ backend
- [ ] Deploy em produção (Railway + Vercel)

**MVP target:** Semana 10
