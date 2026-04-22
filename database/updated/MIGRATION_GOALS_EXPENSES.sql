-- ============================================
-- MIGRATION SCRIPT: Add Dashboard & Financial Management
-- Date: April 22, 2026
-- Description: Adds Goals and Expenses tables for Dashboard and Financial Management features
-- ============================================

-- ============================================
-- Goals Table (Sales Targets by Month)
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Key format: "YYYY-MM" for unique constraint (e.g., "2026-04")
  key VARCHAR(7) NOT NULL UNIQUE,
  
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  
  -- Target values
  target DECIMAL(12,2) NOT NULL DEFAULT 0,
  floor DECIMAL(12,2) DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_year_month UNIQUE(year, month)
);

-- Create indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_key ON goals(key);
CREATE INDEX IF NOT EXISTS idx_goals_year_month ON goals(year, month);
CREATE INDEX IF NOT EXISTS idx_goals_created ON goals(created_at);

-- ============================================
-- Expenses Table (Financial Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
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

-- Create indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_kind ON expenses(kind);
CREATE INDEX IF NOT EXISTS idx_expenses_predicted_date ON expenses(predicted_date);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_date ON expenses(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_service ON expenses(service);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at);

-- ============================================
-- Expense Installments Table (Credit Card Payment Plans)
-- ============================================

CREATE TABLE IF NOT EXISTS expense_installments (
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

-- Create indexes for expense_installments
CREATE INDEX IF NOT EXISTS idx_expense_installments_expense ON expense_installments(id_expense);
CREATE INDEX IF NOT EXISTS idx_expense_installments_due_date ON expense_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_expense_installments_status ON expense_installments(status);

-- ============================================
-- Verification Queries
-- ============================================

-- Verify new tables created successfully
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('goals', 'expenses', 'expense_installments')
ORDER BY table_name;

-- ============================================
-- END OF MIGRATION
-- ============================================
-- To apply this migration to an existing database:
-- 1. Ensure you have a backup of your database
-- 2. Run: psql -U postgres -d orderly_hub -f MIGRATION_GOALS_EXPENSES.sql
-- 3. Verify tables were created: \dt goals, \dt expenses, \dt expense_installments
-- ============================================
