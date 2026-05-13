# Relatório de Testes — feature/list-view-integration

**Data:** 2026-05-13  
**Branch:** `feature/list-view-integration`  
**Autor:** Rafael  

---

## Resumo Executivo

| Categoria              | Arquivo(s)                          | Testes | Passou | Falhou |
|------------------------|-------------------------------------|--------|--------|--------|
| Backend — Unitário     | `test_item_rma_statuses.py`         | 33     | 33     | 0      |
| Backend — Unitário     | `test_migration_item_rma.py`        | 21     | 21     | 0      |
| Backend — Schema       | `test_pedido_list_response.py`      | 17     | 17     | 0      |
| Frontend — Unitário    | `sales-helpers.test.ts`             | 23     | 23     | 0      |
| Frontend — Unitário    | `sales-date-format.test.ts`         | 9      | 9      | 0      |
| Frontend — Componente  | `AddOrderChooser.test.tsx`          | 12     | 12     | 0      |
| E2E (Playwright)       | `list-view-integration.spec.ts`     | 7      | 7      | 0      |
| **TOTAL**              |                                     | **122**| **122**| **0**  |

---

## O Que Foi Implementado (Escopo da Branch)

### 1. Expansão de `ItemRmaStatus` (8 → 10 valores)
O enum de status dos itens de RMA foi expandido para cobrir todo o ciclo de vida de reparo/entrega, eliminando ambiguidades.

| Valor antigo  | Valor novo             |
|---------------|------------------------|
| `Repaired`    | `Repaired Received`    |
| `Ready`       | `Ready for Delivery`   |
| `Shipped`     | `Out for Delivery`     |
| `Cancelled`   | `Not Received`         |
| *(novos)*     | `Repaired Not Received`, `Sent for Repair`, `To Pack` |

### 2. Script de Migração do Banco
`backend/migrate_item_rma_status.py` — drop da constraint antiga, atualização dos dados e recriação da constraint com os 10 novos valores.

### 3. `PedidoListItemResponse` com `produtos` e `sub_compras`
A resposta da listagem de pedidos passou a incluir os produtos e suas sub-compras (campo JSONB), permitindo derivar o status de compra diretamente na tela de Sales.

### 4. Lógica de Status por Menor Índice (Sales.tsx)
`minItemStatus()` e `getOrderDisplayStatus()` — algoritmo de índice mínimo que determina o status mais urgente de um pedido a partir das suas sub-compras:

```
To Buy (índice 0) < Bought (índice 1) < In Stock (índice 2)
```

Se qualquer sub-compra tiver status "A Comprar", o pedido exibe "A Comprar" independentemente dos demais.

### 5. Correção do Formato de Data nos Filtros de Data
**Antes:** `range.from` (objeto `Date` do JS) era passado diretamente às query params, gerando strings como `"Wed May 06 2026 00:00:00 GMT-0300 (Horário Padrão de Brasília)"` que o PostgreSQL rejeita.  
**Depois:** `format(range.from, 'yyyy-MM-dd')` de `date-fns` formata para `"2026-05-06"` antes de chamar a API. Corrigido em todos os 3 handlers (`orders`, `quotes`, `rma`) em `Sales.tsx`.

### 6. Correção do Endpoint do `AddOrderChooser`
O componente chamava `/cotacoes` (404) em vez de `/quotes` (endpoint correto do backend).

---

## Detalhamento dos Testes

### Backend — `test_item_rma_statuses.py` (33 testes)

Valida o enum expandido e a rota `PATCH /rma/{id}/items/{item_id}/status`.

```
PASSED  TestItemRmaStatusEnum::test_has_exactly_10_members
PASSED  TestItemRmaStatusEnum::test_not_received_value
PASSED  TestItemRmaStatusEnum::test_received_value
PASSED  TestItemRmaStatusEnum::test_sent_for_repair_value
PASSED  TestItemRmaStatusEnum::test_in_repair_value
PASSED  TestItemRmaStatusEnum::test_repaired_not_received_value
PASSED  TestItemRmaStatusEnum::test_repaired_received_value
PASSED  TestItemRmaStatusEnum::test_to_pack_value
PASSED  TestItemRmaStatusEnum::test_ready_for_delivery_value
PASSED  TestItemRmaStatusEnum::test_out_for_delivery_value
PASSED  TestItemRmaStatusEnum::test_delivered_value
PASSED  TestItemRmaStatusEnum::test_old_repaired_is_not_a_member
PASSED  TestItemRmaStatusEnum::test_old_ready_is_not_a_member
PASSED  TestItemRmaStatusEnum::test_old_shipped_is_not_a_member
PASSED  TestItemRmaStatusEnum::test_old_cancelled_is_not_a_member
PASSED  TestItemRmaStatusEnum::test_lookup_by_value_succeeds_for_all_members
PASSED  TestItemRmaStatusEnum::test_lookup_invalid_value_raises
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Not Received]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Received]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Sent for Repair]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[In Repair]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Repaired Not Received]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Repaired Received]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[To Pack]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Ready for Delivery]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Out for Delivery]
PASSED  TestItemStatusRoute::test_accepts_all_valid_statuses[Delivered]
PASSED  TestItemStatusRoute::test_rejects_old_repaired_string
PASSED  TestItemStatusRoute::test_rejects_old_ready_string
PASSED  TestItemStatusRoute::test_rejects_old_shipped_string
PASSED  TestItemStatusRoute::test_rejects_old_cancelled_string
PASSED  TestItemStatusRoute::test_response_contains_status_field
PASSED  TestItemStatusRoute::test_not_received_roundtrip
```

**Tempo:** < 0.3s

---

### Backend — `test_migration_item_rma.py` (21 testes)

Valida os mapeamentos e a lista `NEW_VALUES` do script de migração.

```
PASSED  TestMigrationMappings::test_migrations_has_four_entries
PASSED  TestMigrationMappings::test_repaired_maps_to_repaired_received
PASSED  TestMigrationMappings::test_ready_maps_to_ready_for_delivery
PASSED  TestMigrationMappings::test_shipped_maps_to_out_for_delivery
PASSED  TestMigrationMappings::test_cancelled_maps_to_not_received
PASSED  TestMigrationMappings::test_all_destination_values_are_valid_enum_members
PASSED  TestMigrationMappings::test_source_values_are_not_valid_enum_members
PASSED  TestNewValues::test_new_values_has_ten_entries
PASSED  TestNewValues::test_new_values_matches_enum_count
PASSED  TestNewValues::test_no_duplicates_in_new_values
PASSED  TestNewValues::test_all_new_values_are_valid_enum_members
PASSED  TestNewValues::test_new_values_covers_all_enum_members
PASSED  TestNewValues::test_not_received_in_new_values
PASSED  TestNewValues::test_repaired_received_in_new_values
PASSED  TestNewValues::test_ready_for_delivery_in_new_values
PASSED  TestNewValues::test_out_for_delivery_in_new_values
PASSED  TestNewValues::test_old_repaired_not_in_new_values
PASSED  TestNewValues::test_old_ready_not_in_new_values
PASSED  TestNewValues::test_old_shipped_not_in_new_values
PASSED  TestNewValues::test_old_cancelled_not_in_new_values
```

**Tempo:** < 0.1s

---

### Backend — `test_pedido_list_response.py` (17 testes)

Valida o schema `PedidoListItemResponse` com `produtos`/`sub_compras` e `ProdutoUpdate`.

```
PASSED  TestPedidoListItemResponse::test_has_produtos_field
PASSED  TestPedidoListItemResponse::test_produtos_defaults_to_empty_list
PASSED  TestPedidoListItemResponse::test_accepts_list_of_produto_responses
PASSED  TestPedidoListItemResponse::test_produto_with_sub_compras_serialises
PASSED  TestPedidoListItemResponse::test_produto_sub_compras_multiple_entries
PASSED  TestPedidoListItemResponse::test_multiple_produtos_in_list_item
PASSED  TestPedidoListResponse::test_wraps_items_and_pagination
PASSED  TestProdutoUpdateSubCompras::test_accepts_none
PASSED  TestProdutoUpdateSubCompras::test_accepts_empty_list
PASSED  TestProdutoUpdateSubCompras::test_accepts_list_of_dicts
PASSED  TestProdutoUpdateSubCompras::test_status_to_buy_is_valid
PASSED  TestProdutoUpdateSubCompras::test_status_bought_is_valid
PASSED  TestProdutoUpdateSubCompras::test_status_in_stock_is_valid
PASSED  TestProdutoUpdateSubCompras::test_status_invalid_raises
PASSED  TestProdutoStatuses::test_to_buy_in_statuses
PASSED  TestProdutoStatuses::test_bought_in_statuses
PASSED  TestProdutoStatuses::test_in_stock_in_statuses
```

**Tempo:** < 0.1s

---

### Frontend — `sales-helpers.test.ts` (23 testes) · Vitest

Valida `minItemStatus()` e `getOrderDisplayStatus()` como especificação do algoritmo de índice mínimo.

```
✓ minItemStatus > returns null for an empty list
✓ minItemStatus > returns null when no recognised statuses are present
✓ minItemStatus > returns the single status when only one item is given
✓ minItemStatus > returns To Buy when all three statuses are present
✓ minItemStatus > returns To Buy when mixed with unknown statuses
✓ minItemStatus > returns Bought when To Buy is absent
✓ minItemStatus > returns In Stock when only In Stock is present
✓ minItemStatus > To Buy has lower index than Bought
✓ minItemStatus > Bought has lower index than In Stock
✓ minItemStatus > ignores unknown values in a mixed list
✓ minItemStatus > is case-sensitive — "to buy" is not a match
✓ minItemStatus > handles duplicate statuses
✓ getOrderDisplayStatus > returns null when produtos is undefined
✓ getOrderDisplayStatus > returns null when produtos is an empty array
✓ getOrderDisplayStatus > returns null when produtos is null
✓ getOrderDisplayStatus > uses produto.status directly when sub_compras is absent
✓ getOrderDisplayStatus > uses produto.status when sub_compras is empty array
✓ getOrderDisplayStatus > uses sub_compras min-status when sub_compras are present
✓ getOrderDisplayStatus > sub_compras To Buy overrides produto In Stock status
✓ getOrderDisplayStatus > returns min across multiple produtos (mixed)
✓ getOrderDisplayStatus > returns null when all sub_compras have unrecognised statuses
✓ getOrderDisplayStatus > handles a single produto with all three sub_compras statuses
✓ getOrderDisplayStatus > correctly selects min across two produtos with sub_compras
```

**Tempo:** < 10ms

---

### Frontend — `sales-date-format.test.ts` (9 testes) · Vitest

Valida o contrato de formatação `YYYY-MM-DD` para os filtros de data da API.

```
✓ date formatting > formats a Date object to YYYY-MM-DD
✓ date formatting > pads single-digit months with a leading zero
✓ date formatting > pads single-digit days with a leading zero
✓ date formatting > never produces timezone or locale suffix
✓ date formatting > result matches YYYY-MM-DD regex pattern
✓ date formatting > formats the end of range correctly
✓ range-to fallback > sets data_inicio and data_fim to the same day when only from is given
✓ range-to fallback > sets data_inicio and data_fim independently when both are given
✓ range-to fallback > sets both to undefined when range is cleared
✓ range-to fallback > raw Date.toString() would have failed PostgreSQL before the fix
```

**Tempo:** < 5ms

---

### Frontend — `AddOrderChooser.test.tsx` (12 testes) · Vitest + React Testing Library

Valida o endpoint correto (`/quotes`) e o fluxo de criação de pedido a partir de cotação.

```
✓ AddOrderChooser — initial step > renders the two choice buttons
✓ AddOrderChooser — initial step > calls onChooseNew when "Cadastrar novo pedido" is clicked
✓ AddOrderChooser — initial step > does NOT call the API while on the choose step
✓ AddOrderChooser — pick-quote step > calls GET /quotes when navigating to the pick-quote step
✓ AddOrderChooser — pick-quote step > does NOT call /cotacoes (old broken endpoint)
✓ AddOrderChooser — pick-quote step > passes pagination params to the /quotes call
✓ AddOrderChooser — pick-quote step > shows empty state when API returns no quotes
✓ AddOrderChooser — pick-quote step > renders loaded quotes in the table
✓ AddOrderChooser — pick-quote step > shows the quote value in the table
✓ AddOrderChooser — pick-items step > shows the items of the selected quote
✓ AddOrderChooser — pick-items step > calls onChooseFromQuote with correct prefill when confirmed
```

**Tempo:** < 800ms  
**Avisos:** `Missing aria-describedby for DialogContent` — aviso de acessibilidade do Radix UI, sem impacto funcional, presente em todos os modais do projeto.

---

### E2E — `list-view-integration.spec.ts` (7 testes) · Playwright / Chromium

```
ok  orders list: shows "A Comprar" badge when sub_compras has To Buy status     (14.6s)
ok  date filter: request URL contains YYYY-MM-DD format, not raw Date string     (2.5s)
ok  RMAs tab: displays new 10-value item statuses in the table                   (1.9s)
ok  RMA edit modal: shows "Repaired Received" / "Reparado Recebido"              (2.2s)
ok  AddOrderChooser: clicking "from quote" triggers GET /quotes                  (2.8s)
ok  AddOrderChooser: loaded quotes are shown in the table                        (1.9s)
ok  AddOrderChooser: selecting a quote and confirming opens the OrderModal       (2.1s)
```

**Tempo total:** 31s (Chromium, servidor Vite em modo dev)

---

## Bugs Detectados e Corrigidos Durante os Testes

| Bug | Causa | Arquivo Corrigido |
|-----|-------|-------------------|
| HTTP 500 ao filtrar pedidos por data | `range.from` (objeto `Date`) enviado cru à API; PostgreSQL rejeita `"GMT-0300"` | `src/pages/Sales.tsx` |
| "Falha ao carregar cotações" no `AddOrderChooser` | Endpoint `/cotacoes` (inexistente); backend expõe `/quotes` | `src/components/AddOrderChooser.tsx` |
| Itens RMA com status antigos (500) | Banco com valores `Repaired`, `Ready`, etc. rejeitados pela nova constraint | `backend/migrate_item_rma_status.py` executado em produção |

---

## Arquivos de Teste Criados

```
backend/tests/
  test_item_rma_statuses.py           enum + rota PATCH /rma items (novo enum 10 valores)
  test_migration_item_rma.py          mapeamentos e lista de valores da migração
  test_pedido_list_response.py        schema PedidoListItemResponse com produtos/sub_compras

src/test/
  sales-helpers.test.ts               minItemStatus() e getOrderDisplayStatus()
  sales-date-format.test.ts           formatação YYYY-MM-DD para filtros de data
  components/AddOrderChooser.test.tsx endpoint /quotes + fluxo de criação via cotação

e2e/
  list-view-integration.spec.ts       testes E2E end-to-end (Playwright / Chromium)
```

---

## Como Executar

```bash
# Backend (dentro da pasta backend/)
python -m pytest tests/test_item_rma_statuses.py \
                 tests/test_migration_item_rma.py \
                 tests/test_pedido_list_response.py -v

# Frontend — unitários e componentes
npm test -- --run \
  src/test/sales-helpers.test.ts \
  src/test/sales-date-format.test.ts \
  src/test/components/AddOrderChooser.test.tsx

# E2E (Playwright — inicia o servidor Vite automaticamente via playwright.config.ts)
npx playwright test e2e/list-view-integration.spec.ts
```

---

*Relatório gerado em 2026-05-13*
