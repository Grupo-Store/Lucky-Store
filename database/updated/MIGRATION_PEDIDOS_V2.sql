-- MIGRATION_PEDIDOS_V2
-- Torna numero_nf opcional (pedido criado via cotacao ainda nao tem NF)

ALTER TABLE pedidos ALTER COLUMN numero_nf DROP NOT NULL;
