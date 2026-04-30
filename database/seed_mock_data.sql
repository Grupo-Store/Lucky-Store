-- =============================================================
-- ORDERLY HUB — MOCK SEED DATA
-- Run this in pgAdmin > orderly_hub > Query Tool
-- =============================================================

-- UUIDs fixos para referência cruzada
-- Lojas
-- Lucky Store : aa000001-0000-0000-0000-000000000001
-- BTech       : aa000002-0000-0000-0000-000000000002
-- AJJ         : aa000003-0000-0000-0000-000000000003

-- Vendedores (todos operam em todas as lojas)
-- Alcides : bb000001-0000-0000-0000-000000000001
-- Lucas   : bb000002-0000-0000-0000-000000000002
-- Pedro   : bb000003-0000-0000-0000-000000000003

-- Clientes
-- Empresa Alpha : cc000001-0000-0000-0000-000000000001
-- Empresa Beta  : cc000002-0000-0000-0000-000000000002
-- Empresa Gama  : cc000003-0000-0000-0000-000000000003

-- Pedidos
-- PED-001 : dd000001-0000-0000-0000-000000000001
-- PED-002 : dd000002-0000-0000-0000-000000000002
-- PED-003 : dd000003-0000-0000-0000-000000000003
-- PED-004 : dd000004-0000-0000-0000-000000000004
-- PED-005 : dd000005-0000-0000-0000-000000000005
-- PED-006 : dd000006-0000-0000-0000-000000000006

-- =============================================================
-- 0. LIMPAR BANCO (ordem respeita FKs)
-- =============================================================

TRUNCATE TABLE
  status_history,
  audit_logs,
  pedido_forma_pagamento,
  custo_pedido,
  frete,
  produtos,
  pedidos,
  rmas,
  cotacoes,
  vendedores,
  clientes,
  lojas,
  users
CASCADE;

-- =============================================================
-- 1. LOJAS
-- =============================================================

INSERT INTO lojas (id, nome, cnpj, city, state, created_at, updated_at)
VALUES
  ('aa000001-0000-0000-0000-000000000001', 'Lucky Store', '11222333000101', 'Fortaleza', 'CE', now(), now()),
  ('aa000002-0000-0000-0000-000000000002', 'BTech',       '22333444000102', 'Fortaleza', 'CE', now(), now()),
  ('aa000003-0000-0000-0000-000000000003', 'AJJ',         '33444555000103', 'Fortaleza', 'CE', now(), now());

-- =============================================================
-- 2. VENDEDORES
-- id_loja é referência cadastral apenas — todos operam em todas as lojas.
-- =============================================================

INSERT INTO vendedores (id, id_loja, nome, email, phone, created_at, updated_at)
VALUES
  ('bb000001-0000-0000-0000-000000000001', 'aa000001-0000-0000-0000-000000000001', 'Alcides', 'alcides@orderlyhub.com', '(85) 99111-0001', now(), now()),
  ('bb000002-0000-0000-0000-000000000002', 'aa000001-0000-0000-0000-000000000001', 'Lucas',   'lucas@orderlyhub.com',   '(85) 99111-0002', now(), now()),
  ('bb000003-0000-0000-0000-000000000003', 'aa000001-0000-0000-0000-000000000001', 'Pedro',   'pedro@orderlyhub.com',   '(85) 99111-0003', now(), now());

-- =============================================================
-- 3. CLIENTES
-- =============================================================

INSERT INTO clientes (id, nome, cnpj, email, phone, city, state, created_at, updated_at)
VALUES
  ('cc000001-0000-0000-0000-000000000001', 'Empresa Alpha Ltda', '44555666000101', 'contato@alpha.com', '(85) 3111-0001', 'Fortaleza', 'CE', now(), now()),
  ('cc000002-0000-0000-0000-000000000002', 'Empresa Beta S/A',   '55666777000102', 'contato@beta.com',  '(85) 3111-0002', 'Sobral',    'CE', now(), now()),
  ('cc000003-0000-0000-0000-000000000003', 'Empresa Gama ME',    '66777888000103', 'contato@gama.com',  '(85) 3111-0003', 'Caucaia',   'CE', now(), now());

-- =============================================================
-- 4. USERS
-- Senha: admin123 (hash bcrypt 3.2.2)
-- =============================================================

INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  'ee000001-0000-0000-0000-000000000001',
  'rafael.mbxavier@gmail.com',
  'Rafael',
  '$2b$12$nWm7r/m0nAweDuTeUlRTmuBK8oHxiFCQMJE2ncQgD7aJYaJW4kzVm',
  'admin',
  true,
  now(),
  now()
);

-- =============================================================
-- 5. PEDIDOS
-- Vendedores misturados entre lojas — todos operam em todas as lojas
-- =============================================================

INSERT INTO pedidos (
  id, id_loja, id_vendedor, id_cliente,
  numero_os, numero_nf, numero_oc,
  data_pedido, data_entrega, status,
  is_rma, is_cancelled, is_direct_billing,
  valor_venda, parcelas,
  observacao, fornecedor_principal, nota_fiscal_fornecedor,
  created_by, created_at, updated_at
)
VALUES
  -- Alcides na Lucky Store
  ('dd000001-0000-0000-0000-000000000001',
   'aa000001-0000-0000-0000-000000000001',
   'bb000001-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000001',
   'OS-001', 'NF-1001', 'OC-001',
   '2026-04-01', '2026-04-10', 'Delivered',
   false, false, false, 15000.00, 1,
   'Pedido mock 1', 'Fornecedor A', 'NFE-1001',
   'ee000001-0000-0000-0000-000000000001', now(), now()),

  -- Lucas na BTech
  ('dd000002-0000-0000-0000-000000000002',
   'aa000002-0000-0000-0000-000000000002',
   'bb000002-0000-0000-0000-000000000002',
   'cc000002-0000-0000-0000-000000000002',
   'OS-002', 'NF-1002', 'OC-002',
   '2026-04-05', '2026-04-20', 'To Invoice',
   false, false, false, 8500.00, 3,
   'Pedido mock 2', 'Fornecedor B', 'NFE-1002',
   'ee000001-0000-0000-0000-000000000001', now(), now()),

  -- Pedro na AJJ
  ('dd000003-0000-0000-0000-000000000003',
   'aa000003-0000-0000-0000-000000000003',
   'bb000003-0000-0000-0000-000000000003',
   'cc000003-0000-0000-0000-000000000003',
   'OS-003', 'NF-1003', null,
   '2026-04-15', '2026-05-05', 'To Buy',
   false, false, false, 22000.00, 6,
   'Pedido mock 3', 'Fornecedor C', null,
   'ee000001-0000-0000-0000-000000000001', now(), now()),

  -- Alcides na BTech (cross-loja)
  ('dd000004-0000-0000-0000-000000000004',
   'aa000002-0000-0000-0000-000000000002',
   'bb000001-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000001',
   'OS-004', 'NF-1004', 'OC-004',
   '2026-04-18', '2026-04-30', 'Cancelled',
   false, true, false, 5000.00, 1,
   'Cancelado a pedido do cliente', 'Fornecedor A', 'NFE-1004',
   'ee000001-0000-0000-0000-000000000001', now(), now()),

  -- Lucas na AJJ (cross-loja)
  ('dd000005-0000-0000-0000-000000000005',
   'aa000003-0000-0000-0000-000000000003',
   'bb000002-0000-0000-0000-000000000002',
   'cc000002-0000-0000-0000-000000000002',
   'OS-005', 'NF-1005', 'OC-005',
   '2026-04-22', '2026-05-02', 'Out for Delivery',
   false, false, false, 31000.00, 12,
   'Pedido mock 5 — em rota', 'Fornecedor D', 'NFE-1005',
   'ee000001-0000-0000-0000-000000000001', now(), now()),

  -- Pedro na Lucky Store (cross-loja)
  ('dd000006-0000-0000-0000-000000000006',
   'aa000001-0000-0000-0000-000000000001',
   'bb000003-0000-0000-0000-000000000003',
   'cc000003-0000-0000-0000-000000000003',
   'OS-006', 'NF-1006', null,
   '2026-04-25', '2026-05-10', 'Bought',
   false, false, false, 12000.00, 2,
   'Pedido mock 6', 'Fornecedor E', 'NFE-1006',
   'ee000001-0000-0000-0000-000000000001', now(), now());

-- =============================================================
-- 6. CUSTO_PEDIDO
-- =============================================================

INSERT INTO custo_pedido (
  id, id_pedido,
  custo_produto_inicial, custo_produto_final, custo_servico,
  brinde, pct_imposto_compra, imposto_compra,
  pct_imposto_venda, imposto_venda,
  pct_custo_credito, custo_credito,
  created_at, updated_at
)
VALUES
  (gen_random_uuid(), 'dd000001-0000-0000-0000-000000000001', 10000, 10500,  500,   0, 4.5,  450, 3.0,   315, 2.0,  210, now(), now()),
  (gen_random_uuid(), 'dd000002-0000-0000-0000-000000000002',  6000,  6200,  300,   0, 4.5,  270, 3.0,   186, 0.0,    0, now(), now()),
  (gen_random_uuid(), 'dd000003-0000-0000-0000-000000000003', 16000, 16500,  800,   0, 4.5,  720, 3.0,   495, 2.0,  330, now(), now()),
  (gen_random_uuid(), 'dd000004-0000-0000-0000-000000000004',  3500,  3500,    0,   0, 0.0,    0, 0.0,     0, 0.0,    0, now(), now()),
  (gen_random_uuid(), 'dd000005-0000-0000-0000-000000000005', 22000, 22500, 1000, 500, 4.5,  990, 3.0, 682.5, 2.0,  450, now(), now()),
  (gen_random_uuid(), 'dd000006-0000-0000-0000-000000000006',  9000,  9200,  400,   0, 4.5,  414, 3.0,   276, 2.0,  184, now(), now());

-- =============================================================
-- 7. PEDIDO_FORMA_PAGAMENTO
-- =============================================================

INSERT INTO pedido_forma_pagamento (id, id_pedido, forma)
VALUES
  (gen_random_uuid(), 'dd000001-0000-0000-0000-000000000001', 'pix'),
  (gen_random_uuid(), 'dd000002-0000-0000-0000-000000000002', 'credito'),
  (gen_random_uuid(), 'dd000002-0000-0000-0000-000000000002', 'boleto'),
  (gen_random_uuid(), 'dd000003-0000-0000-0000-000000000003', 'credito'),
  (gen_random_uuid(), 'dd000005-0000-0000-0000-000000000005', 'credito'),
  (gen_random_uuid(), 'dd000006-0000-0000-0000-000000000006', 'pix');

-- =============================================================
-- 8. STATUS_HISTORY
-- =============================================================

INSERT INTO status_history (id, entity_type, entity_id, old_status, new_status, changed_by, changed_at, reason)
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '28 days', 'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, 'To Buy',     'Bought',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '25 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, 'Bought',     'Received',         'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '20 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, 'Received',   'To Invoice',       'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '18 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, 'To Invoice', 'Invoiced',         'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '15 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000001-0000-0000-0000-000000000001'::uuid, 'Invoiced',   'Delivered',        'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '12 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000002-0000-0000-0000-000000000002'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '24 days', 'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000002-0000-0000-0000-000000000002'::uuid, 'To Buy',     'Bought',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '20 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000002-0000-0000-0000-000000000002'::uuid, 'Bought',     'Received',         'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '15 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000002-0000-0000-0000-000000000002'::uuid, 'Received',   'To Invoice',       'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '10 days', null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000003-0000-0000-0000-000000000003'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '14 days', 'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000004-0000-0000-0000-000000000004'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '11 days', 'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000004-0000-0000-0000-000000000004'::uuid, 'To Buy',     'Cancelled',        'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '8 days',  'Cancelado a pedido do cliente'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000005-0000-0000-0000-000000000005'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '7 days',  'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000005-0000-0000-0000-000000000005'::uuid, 'To Buy',     'Bought',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '5 days',  null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000005-0000-0000-0000-000000000005'::uuid, 'Bought',     'Out for Delivery', 'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '1 day',   null
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000006-0000-0000-0000-000000000006'::uuid, null,         'To Buy',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '4 days',  'Pedido criado'
UNION ALL
SELECT gen_random_uuid(), 'pedido', 'dd000006-0000-0000-0000-000000000006'::uuid, 'To Buy',     'Bought',           'ee000001-0000-0000-0000-000000000001'::uuid, now() - interval '2 days',  null;

-- =============================================================
-- 9. VERIFICAÇÃO
-- =============================================================

SELECT 'lojas'           AS tabela, count(*) FROM lojas
UNION ALL SELECT 'vendedores',       count(*) FROM vendedores
UNION ALL SELECT 'clientes',         count(*) FROM clientes
UNION ALL SELECT 'users',            count(*) FROM users
UNION ALL SELECT 'pedidos',          count(*) FROM pedidos
UNION ALL SELECT 'custo_pedido',     count(*) FROM custo_pedido
UNION ALL SELECT 'pedido_forma_pag', count(*) FROM pedido_forma_pagamento
UNION ALL SELECT 'status_history',   count(*) FROM status_history;
