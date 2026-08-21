-- ============================================
-- ORDERLY HUB - DATABASE INITIALIZATION SCRIPT
-- PostgreSQL 14+
-- ============================================
-- This script creates the complete refactored database schema with:
-- ✅ UUID primary keys (security, distributed systems)
-- ✅ Audit fields (LGPD compliance)
-- ✅ Soft deletes (data recovery, forensics)
-- ✅ Status history (audit trail for changes)
-- ✅ Complete audit logs (JSONB full change tracking)
-- ✅ Views for reporting (no data redundancy)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'seller', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  totp_secret VARCHAR(32),
  totp_enabled BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deleted ON users(deleted_at);

-- ============================================
-- CORE ENTITIES
-- ============================================

CREATE TABLE lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  cnpj VARCHAR(20) UNIQUE,
  city VARCHAR(100),
  state VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_lojas_nome ON lojas(nome);
CREATE INDEX idx_lojas_deleted ON lojas(deleted_at);


CREATE TABLE vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_loja UUID NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  UNIQUE(id_loja, nome)
);

CREATE INDEX idx_vendedores_loja ON vendedores(id_loja) WHERE deleted_at IS NULL;
CREATE INDEX idx_vendedores_deleted ON vendedores(deleted_at);


CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  -- Sem UNIQUE: a regra de identidade e (mesmo nome E mesmo documento),
  -- entao o mesmo CNPJ com nome diferente sao clientes distintos.
  -- Ver app/services/cliente_identidade.py e a migration a5b6c7d8e9f0.
  cnpj VARCHAR(20),
  email VARCHAR(255),
  phone VARCHAR(20),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_clientes_deleted ON clientes(deleted_at);

-- ============================================
-- PEDIDOS (ORDERS) - MAIN TABLE
-- ============================================

CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_loja UUID NOT NULL REFERENCES lojas(id),
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  id_cliente UUID NOT NULL REFERENCES clientes(id),
  
  -- Order identification
  numero_os VARCHAR(50) NOT NULL,
  numero_nf VARCHAR(50) NOT NULL,
  numero_oc VARCHAR(50),
  
  -- Dates
  data_pedido DATE NOT NULL,
  data_entrega DATE NOT NULL,
  
  -- Status & flags
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'To Buy', 'Bought', 'Received', 'To Invoice',
    'Invoiced', 'To Pack', 'Ready for Delivery',
    'Out for Delivery', 'Delivered', 'Delayed', 'Cancelled'
  )),
  is_rma BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,
  is_direct_billing BOOLEAN DEFAULT false,
  
  -- Financial
  valor_venda DECIMAL(12,2),
  parcelas INTEGER DEFAULT 1,
  
  -- Notes
  observacao TEXT,
  
  -- Supplier info
  fornecedor_principal TEXT,
  nota_fiscal_fornecedor VARCHAR(50),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  UNIQUE(id_loja, numero_nf)
);

CREATE INDEX idx_pedidos_loja ON pedidos(id_loja) WHERE deleted_at IS NULL;
CREATE INDEX idx_pedidos_vendedor ON pedidos(id_vendedor) WHERE deleted_at IS NULL;
CREATE INDEX idx_pedidos_cliente ON pedidos(id_cliente) WHERE deleted_at IS NULL;
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_data_entrega ON pedidos(data_entrega);
CREATE INDEX idx_pedidos_numero_os ON pedidos(numero_os) WHERE deleted_at IS NULL;
CREATE INDEX idx_pedidos_deleted ON pedidos(deleted_at);


-- Payment methods for each order
CREATE TABLE pedido_forma_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  forma VARCHAR(50) NOT NULL CHECK (forma IN ('credito', 'debito', 'boleto', 'pix', 'ted', 'dinheiro')),
  
  UNIQUE(id_pedido, forma)
);

CREATE INDEX idx_pedido_forma_pagamento ON pedido_forma_pagamento(id_pedido);

-- ============================================
-- PRODUTOS (ORDER ITEMS)
-- ============================================

CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  id_comprador UUID REFERENCES vendedores(id),
  
  -- Item details
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  
  -- Pricing
  valor_projetado DECIMAL(12,2) NOT NULL,
  valor_compra DECIMAL(12,2),
  economia DECIMAL(12,2),
  
  -- Supplier & purchase info
  fornecedor TEXT,
  data_compra DATE,
  prazo_entrega DATE,
  data_recebimento DATE,
  
  -- Status
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'Pending', 'To Purchase', 'In Stock', 'Received', 
    'Ready', 'Shipped', 'Delivered', 'Delayed', 'Cancelled'
  )),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_produtos_pedido ON produtos(id_pedido);
CREATE INDEX idx_produtos_status ON produtos(status);
CREATE INDEX idx_produtos_data_recebimento ON produtos(data_recebimento);

-- ============================================
-- CUSTOS DO PEDIDO (ORDER COSTS)
-- ============================================

CREATE TABLE custo_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
  
  -- Product costs
  custo_produto_inicial DECIMAL(12,2),
  custo_produto_final DECIMAL(12,2),
  
  -- Services
  custo_servico DECIMAL(12,2),
  brinde DECIMAL(12,2),
  
  -- Purchase taxes
  pct_imposto_compra DECIMAL(5,2),
  imposto_compra DECIMAL(12,2),
  
  -- Sales taxes
  pct_imposto_venda DECIMAL(5,2),
  imposto_venda DECIMAL(12,2),
  
  -- Payment method costs
  pct_custo_credito DECIMAL(5,2),
  custo_credito DECIMAL(12,2),
  pct_custo_debito DECIMAL(5,2),
  custo_debito DECIMAL(12,2),
  custo_boleto DECIMAL(12,2),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custo_pedido_created ON custo_pedido(created_at);

-- ============================================
-- RMA (RETURN MANAGEMENT)
-- ============================================

CREATE TABLE rmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido_origem UUID NOT NULL REFERENCES pedidos(id),
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  id_loja UUID NOT NULL REFERENCES lojas(id),
  
  numero_rma VARCHAR(50) NOT NULL UNIQUE,
  data_registro DATE NOT NULL,
  prazo_entrega DATE,
  
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'Registered', 'In Analysis', 'Approved', 'In Repair', 
    'Repaired', 'Ready', 'Shipped', 'Delivered', 'Cancelled', 'Completed'
  )),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_rmas_pedido ON rmas(id_pedido_origem);
CREATE INDEX idx_rmas_vendedor ON rmas(id_vendedor);
CREATE INDEX idx_rmas_status ON rmas(status);
CREATE INDEX idx_rmas_numero ON rmas(numero_rma) WHERE deleted_at IS NULL;
CREATE INDEX idx_rmas_deleted ON rmas(deleted_at);

-- ============================================
-- FRETE (FREIGHT/DELIVERY) — após rmas para FK funcionar
-- ============================================

CREATE TABLE frete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  id_rma UUID REFERENCES rmas(id) ON DELETE CASCADE,

  valor DECIMAL(12,2) NOT NULL,
  entregador VARCHAR(255),
  data_frete DATE NOT NULL,

  CONSTRAINT frete_one_or_other CHECK (
    (id_pedido IS NOT NULL AND id_rma IS NULL) OR
    (id_pedido IS NULL AND id_rma IS NOT NULL)
  ),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_frete_pedido ON frete(id_pedido);
CREATE INDEX idx_frete_rma ON frete(id_rma);

-- Items within an RMA
CREATE TABLE item_rma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_rma UUID NOT NULL REFERENCES rmas(id) ON DELETE CASCADE,
  id_produto_origem UUID NOT NULL REFERENCES produtos(id),
  
  -- Denormalized data from original product
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  
  -- Status & repair info
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'Not Received', 'Received', 'In Repair', 
    'Repaired', 'Ready', 'Shipped', 'Delivered', 'Cancelled'
  )),
  consertado_por VARCHAR(255),
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id_rma, id_produto_origem)
);

CREATE INDEX idx_item_rma_rma ON item_rma(id_rma);
CREATE INDEX idx_item_rma_status ON item_rma(status);

-- ============================================
-- COTACAO (QUOTES)
-- ============================================

CREATE TABLE cotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_loja UUID NOT NULL REFERENCES lojas(id),
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  
  -- Quote info
  numero_requisicao VARCHAR(50),
  cliente VARCHAR(255) NOT NULL,
  cnpj_cliente VARCHAR(20),
  
  -- Dates
  data_cotacao DATE NOT NULL,
  data_validade DATE,
  
  -- Status phases
  status_enviada BOOLEAN DEFAULT false,
  data_envio DATE,
  status_em_fechamento BOOLEAN DEFAULT false,
  status_fechada BOOLEAN DEFAULT false,
  data_fechamento DATE,
  status_caida BOOLEAN DEFAULT false,
  data_queda DATE,
  
  -- Financial
  is_direct_billing BOOLEAN DEFAULT false,
  fornecedor VARCHAR(255),
  valor_total DECIMAL(12,2),
  
  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  UNIQUE(id_loja, id_vendedor, data_cotacao, numero_requisicao)
);

CREATE INDEX idx_cotacoes_loja ON cotacoes(id_loja) WHERE deleted_at IS NULL;
CREATE INDEX idx_cotacoes_vendedor ON cotacoes(id_vendedor) WHERE deleted_at IS NULL;
CREATE INDEX idx_cotacoes_data ON cotacoes(data_cotacao);
CREATE INDEX idx_cotacoes_deleted ON cotacoes(deleted_at);

-- Items in a quote
CREATE TABLE item_cotacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cotacao UUID NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  valor_unitario DECIMAL(12,2) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_item_cotacao_cotacao ON item_cotacao(id_cotacao);

-- ============================================
-- SALES & PURCHASES TRACKING
-- ============================================

CREATE TABLE venda_vendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_pedido UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  
  valor_venda DECIMAL(12,2),
  lucro DECIMAL(12,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id_pedido, id_vendedor)
);

CREATE INDEX idx_venda_vendedor_vendedor ON venda_vendedor(id_vendedor);
CREATE INDEX idx_venda_vendedor_pedido ON venda_vendedor(id_pedido);

CREATE TABLE compra_vendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_produto UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  
  valor_compra DECIMAL(12,2),
  lucro DECIMAL(12,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id_produto, id_vendedor)
);

CREATE INDEX idx_compra_vendedor_vendedor ON compra_vendedor(id_vendedor);
CREATE INDEX idx_compra_vendedor_produto ON compra_vendedor(id_produto);

-- ============================================
-- METAS (TARGETS/GOALS)
-- ============================================

CREATE TABLE meta_vendedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_vendedor UUID NOT NULL REFERENCES vendedores(id),
  
  ano_mes DATE NOT NULL,
  
  piso DECIMAL(12,2),
  alvo_equipe DECIMAL(12,2),
  alvo_individual DECIMAL(12,2),
  retirada_mes DECIMAL(12,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(id_vendedor, ano_mes)
);

CREATE INDEX idx_meta_vendedor_vendedor ON meta_vendedor(id_vendedor);
CREATE INDEX idx_meta_vendedor_mes ON meta_vendedor(ano_mes);

-- ============================================
-- STATUS HISTORY (Audit Trail for Status Changes)
-- ============================================

CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('pedido', 'produto', 'rma', 'item_rma', 'cotacao')),
  entity_id UUID NOT NULL,
  
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  reason TEXT
);

CREATE INDEX idx_status_history_entity ON status_history(entity_type, entity_id);
CREATE INDEX idx_status_history_changed_at ON status_history(changed_at);
CREATE INDEX idx_status_history_changed_by ON status_history(changed_by);

-- ============================================
-- AUDIT LOG (Complete Audit Trail)
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE')),
  
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  old_values JSONB,
  new_values JSONB,
  
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- VIEWS (For Reporting - No Data Redundancy)
-- ============================================

-- Monthly results view
CREATE VIEW resultado_mensal AS
SELECT
  p.id_loja,
  v.id as id_vendedor,
  DATE_TRUNC('month', p.data_pedido)::DATE as mes,
  
  COUNT(DISTINCT p.id) as qtde_pedidos,
  SUM(p.valor_venda) as venda_total,
  SUM(COALESCE(cp.custo_produto_final, 0)) as custo_total,
  SUM(p.valor_venda) - SUM(COALESCE(cp.custo_produto_final, 0)) as lucro_bruto,
  
  SUM(COALESCE(cp.imposto_compra, 0)) as imposto_compra_total,
  SUM(COALESCE(cp.imposto_venda, 0)) as imposto_venda_total,
  SUM(COALESCE(cp.custo_credito, 0) + COALESCE(cp.custo_debito, 0) + COALESCE(cp.custo_boleto, 0)) as custos_pagamento,
  
  SUM(p.valor_venda) 
    - SUM(COALESCE(cp.custo_produto_final, 0))
    - SUM(COALESCE(cp.imposto_compra, 0))
    - SUM(COALESCE(cp.imposto_venda, 0))
    - SUM(COALESCE(cp.custo_credito, 0) + COALESCE(cp.custo_debito, 0) + COALESCE(cp.custo_boleto, 0))
    as lucro_liquido,
  
  COUNT(DISTINCT DATE(p.data_pedido)) as dias_com_vendas
  
FROM pedidos p
JOIN vendedores v ON p.id_vendedor = v.id
LEFT JOIN custo_pedido cp ON p.id = cp.id_pedido
WHERE p.deleted_at IS NULL
GROUP BY p.id_loja, v.id, DATE_TRUNC('month', p.data_pedido);

-- Annual results view
CREATE VIEW resultado_anual AS
SELECT
  p.id_loja,
  EXTRACT(YEAR FROM p.data_pedido)::INTEGER as ano,
  
  COUNT(DISTINCT p.id) as qtde_pedidos,
  SUM(p.valor_venda) as venda_total,
  SUM(COALESCE(cp.custo_produto_final, 0)) as custo_total,
  SUM(p.valor_venda) - SUM(COALESCE(cp.custo_produto_final, 0)) as lucro_bruto,
  
  SUM(COALESCE(cp.imposto_compra, 0)) as imposto_compra_total,
  SUM(COALESCE(cp.imposto_venda, 0)) as imposto_venda_total,
  SUM(COALESCE(cp.custo_credito, 0) + COALESCE(cp.custo_debito, 0) + COALESCE(cp.custo_boleto, 0)) as custos_pagamento,
  
  SUM(p.valor_venda) 
    - SUM(COALESCE(cp.custo_produto_final, 0))
    - SUM(COALESCE(cp.imposto_compra, 0))
    - SUM(COALESCE(cp.imposto_venda, 0))
    - SUM(COALESCE(cp.custo_credito, 0) + COALESCE(cp.custo_debito, 0) + COALESCE(cp.custo_boleto, 0))
    as lucro_liquido
  
FROM pedidos p
LEFT JOIN custo_pedido cp ON p.id = cp.id_pedido
WHERE p.deleted_at IS NULL
GROUP BY p.id_loja, EXTRACT(YEAR FROM p.data_pedido);

-- ============================================
-- FUNCTIONS & TRIGGERS (Optional but recommended)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for lojas table
CREATE TRIGGER trigger_lojas_updated_at
BEFORE UPDATE ON lojas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for vendedores table
CREATE TRIGGER trigger_vendedores_updated_at
BEFORE UPDATE ON vendedores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for clientes table
CREATE TRIGGER trigger_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for pedidos table
CREATE TRIGGER trigger_pedidos_updated_at
BEFORE UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for produtos table
CREATE TRIGGER trigger_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for custo_pedido table
CREATE TRIGGER trigger_custo_pedido_updated_at
BEFORE UPDATE ON custo_pedido
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for frete table
CREATE TRIGGER trigger_frete_updated_at
BEFORE UPDATE ON frete
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for rmas table
CREATE TRIGGER trigger_rmas_updated_at
BEFORE UPDATE ON rmas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for cotacoes table
CREATE TRIGGER trigger_cotacoes_updated_at
BEFORE UPDATE ON cotacoes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for venda_vendedor table
CREATE TRIGGER trigger_venda_vendedor_updated_at
BEFORE UPDATE ON venda_vendedor
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for compra_vendedor table
CREATE TRIGGER trigger_compra_vendedor_updated_at
BEFORE UPDATE ON compra_vendedor
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for meta_vendedor table
CREATE TRIGGER trigger_meta_vendedor_updated_at
BEFORE UPDATE ON meta_vendedor
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DASHBOARD & FINANCIAL MANAGEMENT (New - April 2026)
-- ============================================

-- Goals (Sales Targets by Month)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Key format: "YYYY-MM" (e.g., "2026-04")
  key VARCHAR(7) NOT NULL UNIQUE,

  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- Target values
  target DECIMAL(12,2) NOT NULL DEFAULT 0,
  floor DECIMAL(12,2) DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_goals_key ON goals(key);
CREATE INDEX idx_goals_year_month ON goals(year, month);
CREATE INDEX idx_goals_created ON goals(created_at);

-- ============================================
-- EXPENSES (Financial Tracking)
-- ============================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Expense type
  kind VARCHAR(50) NOT NULL CHECK (kind IN ('PREVISAO', 'PAGO')),
  
  -- Description
  service VARCHAR(255) NOT NULL,
  destination VARCHAR(255),
  observations TEXT,
  
  -- Predicted values
  predicted_value DECIMAL(12,2),
  predicted_date DATE,
  
  -- Paid values
  status VARCHAR(50) CHECK (status IN ('Não Pago', 'Pago')),
  paid_value DECIMAL(12,2),
  payment_date DATE,
  payment_method VARCHAR(50) CHECK (payment_method IN ('Boleto', 'Credit Card', 'Debit', 'PIX', 'TED', 'Dinheiro', '')),
  
  -- Credit card installments
  installments INTEGER DEFAULT 1,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_expenses_kind ON expenses(kind);
CREATE INDEX idx_expenses_predicted_date ON expenses(predicted_date);
CREATE INDEX idx_expenses_payment_date ON expenses(payment_date);
CREATE INDEX idx_expenses_service ON expenses(service);
CREATE INDEX idx_expenses_deleted ON expenses(deleted_at);

-- ============================================
-- EXPENSE INSTALLMENTS (Credit Card Payment Plans)
-- ============================================

CREATE TABLE expense_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_expense UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  
  -- Installment details
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  value DECIMAL(12,2) NOT NULL,
  due_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago')),
  paid_date DATE,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_installment UNIQUE(id_expense, installment_number)
);

CREATE INDEX idx_expense_installments_expense ON expense_installments(id_expense);
CREATE INDEX idx_expense_installments_due_date ON expense_installments(due_date);
CREATE INDEX idx_expense_installments_status ON expense_installments(status);

-- ============================================
-- SEED DATA (Optional - for development)
-- ============================================

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO users (email, password_hash, name, role)
VALUES ('admin@orderlyhub.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUqIzlCi', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create sample stores
INSERT INTO lojas (nome, cnpj, city, state)
VALUES 
  ('Lucky Store', '12345678000195', 'São Paulo', 'SP'),
  ('BTech', '87654321000180', 'Rio de Janeiro', 'RJ'),
  ('AJJ', '11111111000111', 'Belo Horizonte', 'MG')
ON CONFLICT (nome) DO NOTHING;

-- ============================================
-- SCRIPT END
-- ============================================
-- To run this script:
-- 1. Make sure PostgreSQL is running
-- 2. Create a database: CREATE DATABASE orderly_hub;
-- 3. Run this script: psql -U postgres -d orderly_hub -f DATABASE_INIT.sql
-- 4. Verify: \dt (to see all tables)
--
-- To verify the schema:
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM information_schema.views WHERE table_schema = 'public';
-- ============================================
