-- =============================================================
-- MIGRATION: Cotações V2 — novos campos do frontend
-- Run this in pgAdmin > orderly_hub > Query Tool
-- =============================================================

-- 1. cotacoes: adicionar b2b_company, observacao, impostos
ALTER TABLE cotacoes
  ADD COLUMN IF NOT EXISTS b2b_company  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS observacao   TEXT,
  ADD COLUMN IF NOT EXISTS pct_imposto_lucky DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS pct_imposto_btech DECIMAL(5,2);

-- 2. item_cotacao: adicionar valor de fechamento e fornecedor
ALTER TABLE item_cotacao
  ADD COLUMN IF NOT EXISTS valor_fechamento       DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS fornecedor             TEXT;

-- Coluna gerada: total do fechamento (quantidade × valor_fechamento)
ALTER TABLE item_cotacao
  ADD COLUMN IF NOT EXISTS valor_total_fechamento DECIMAL(12,2)
    GENERATED ALWAYS AS (quantidade * valor_fechamento) STORED;

-- =============================================================
-- VERIFICAÇÃO
-- =============================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cotacoes'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'item_cotacao'
ORDER BY ordinal_position;
