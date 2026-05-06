# Orderly Hub — Relatório de Testes Unitários

**Data:** 6 de maio de 2026  
**Resultado geral:** ✅ **196 / 196 — 100% de aprovação**  
**Tempo de execução:** 1.53s  
**Framework:** pytest 7.4.3 + FastAPI TestClient + SQLite in-memory  

---

## Resumo Executivo

| Categoria | Arquivos | Testes | Aprovados | Taxa |
|---|---|---|---|---|
| Models | 1 | 61 | 61 | 100% |
| Rotas — Pedidos | 2 | 28 | 28 | 100% |
| Rotas — Cotações | 1 | 27 | 27 | 100% |
| Rotas — RMA | 1 | 22 | 22 | 100% |
| Rotas — Audit/LGPD | 1 | 7 | 7 | 100% |
| Rotas — Itens/Custos/Pagamentos | 3 | 18 | 18 | 100% |
| Serviços — Pedido Audit | 1 | 5 | 5 | 100% |
| Serviços — LGPD | 1 | 8 | 8 | 100% |
| Serviços — Custo/Item/Pagamento | 3 | 21 | 21 | 100% |
| Schemas | 1 | 6 | 6 | 100% |
| **TOTAL** | **16** | **196** | **196** | **100%** |

---

## Estratégia de Testes

**Banco de dados:** SQLite in-memory (sem psycopg2, sem PostgreSQL real). O conftest.py substitui `DATABASE_URL` e corrige kwargs incompatíveis com SQLite antes de qualquer import da aplicação.

**Serviços:** Isolados via `unittest.mock.patch` — o banco é um `MagicMock` e os métodos de serviço são patchados nas rotas. As chamadas reais ao banco são verificadas via `mock_db.add.call_args_list`.

**Rotas:** Cada rota é montada em um `FastAPI` isolado com as dependências `get_db` e `get_current_user_dep` substituídas, via fixture `make_test_client`.

---

## Detalhamento por Arquivo

---

### `test_models.py` — 61 testes

Verifica enums, `__tablename__`, `__repr__` e instanciação de todos os models SQLAlchemy sem necessidade de sessão de banco.

#### TestUserRole (5)
| Teste | Resultado |
|---|---|
| `test_admin_value` — UserRole.ADMIN == "admin" | ✅ |
| `test_manager_value` — UserRole.MANAGER == "manager" | ✅ |
| `test_seller_value` — UserRole.SELLER == "seller" | ✅ |
| `test_viewer_value` — UserRole.VIEWER == "viewer" | ✅ |
| `test_all_four_roles_exist` — len(UserRole) == 4 | ✅ |

#### TestUserModel (4)
| Teste | Resultado |
|---|---|
| `test_tablename` — `__tablename__ == "users"` | ✅ |
| `test_instantiation_with_required_fields` | ✅ |
| `test_repr` — email aparece no repr | ✅ |
| `test_totp_defaults` — totp_enabled é False por padrão | ✅ |

#### TestAuditAction (5)
| Teste | Resultado |
|---|---|
| `test_create_value` — AuditAction.CREATE == "CREATE" | ✅ |
| `test_update_value` — AuditAction.UPDATE == "UPDATE" | ✅ |
| `test_delete_value` — AuditAction.DELETE == "DELETE" | ✅ |
| `test_restore_value` — AuditAction.RESTORE == "RESTORE" | ✅ |
| `test_all_four_actions_exist` — len(AuditAction) == 4 | ✅ |

#### TestAuditLogModel (4)
| Teste | Resultado |
|---|---|
| `test_tablename` — `__tablename__ == "audit_logs"` | ✅ |
| `test_instantiation` — campos entity_type, action, new_values | ✅ |
| `test_ip_and_ua_are_optional` — ip_address e user_agent são None por padrão | ✅ |
| `test_repr` — action e entity_type aparecem no repr | ✅ |

#### TestEntityType (6)
| Teste | Resultado |
|---|---|
| `test_pedido_value` — EntityType.PEDIDO == "pedido" | ✅ |
| `test_produto_value` — EntityType.PRODUTO == "produto" | ✅ |
| `test_rma_value` — EntityType.RMA == "rma" | ✅ |
| `test_item_rma_value` — EntityType.ITEM_RMA == "item_rma" | ✅ |
| `test_cotacao_value` — EntityType.COTACAO == "cotacao" | ✅ |
| `test_five_entity_types_exist` — len(EntityType) == 5 | ✅ |

#### TestStatusHistoryModel (3)
| Teste | Resultado |
|---|---|
| `test_tablename` — `__tablename__ == "status_history"` | ✅ |
| `test_instantiation` — entity_type, new_status, old_status=None | ✅ |
| `test_repr` — old e new status aparecem no repr | ✅ |

#### TestPedidoModel + TestPedidoFormaPagamento + TestCustoPedido (7)
| Teste | Resultado |
|---|---|
| `TestPedidoModel::test_tablename` | ✅ |
| `TestPedidoModel::test_instantiation_and_defaults` — deleted_at=None | ✅ |
| `TestPedidoModel::test_repr` — numero_os e status no repr | ✅ |
| `TestPedidoFormaPagamento::test_tablename` | ✅ |
| `TestPedidoFormaPagamento::test_instantiation` | ✅ |
| `TestCustoPedido::test_tablename` | ✅ |
| `TestCustoPedido::test_instantiation_all_optional` — todos os campos de custo são None | ✅ |

#### TestProdutoStatuses + TestProdutoModel (5)
| Teste | Resultado |
|---|---|
| `test_all_expected_statuses_present` — 9 status listados existem | ✅ |
| `test_nine_statuses` — len(PRODUTO_STATUSES) == 9 | ✅ |
| `TestProdutoModel::test_tablename` | ✅ |
| `TestProdutoModel::test_instantiation` | ✅ |
| `TestProdutoModel::test_repr` — descricao e status no repr | ✅ |

#### TestCotacaoModel + TestItemCotacaoModel (7)
| Teste | Resultado |
|---|---|
| `TestCotacaoModel::test_tablename` | ✅ |
| `TestCotacaoModel::test_instantiation` | ✅ |
| `TestCotacaoModel::test_phase_defaults_are_false` — 4 booleans de fase são False | ✅ |
| `TestCotacaoModel::test_repr` — numero_requisicao e cliente no repr | ✅ |
| `TestItemCotacaoModel::test_tablename` | ✅ |
| `TestItemCotacaoModel::test_instantiation` — valor_fechamento=None | ✅ |
| `TestItemCotacaoModel::test_repr` — descricao e quantidade no repr | ✅ |

#### TestRmaStatus + TestRmaModel (8)
| Teste | Resultado |
|---|---|
| `test_registered_value` — RmaStatus.REGISTERED == "Registered" | ✅ |
| `test_completed_value` — RmaStatus.COMPLETED == "Completed" | ✅ |
| `test_cancelled_value` — RmaStatus.CANCELLED == "Cancelled" | ✅ |
| `test_ten_statuses_exist` — len(RmaStatus) == 10 | ✅ |
| `test_all_values_are_title_case` — todos iniciam com maiúscula | ✅ |
| `TestRmaModel::test_tablename` | ✅ |
| `TestRmaModel::test_instantiation` — status=Registered, deleted_at=None | ✅ |
| `TestRmaModel::test_repr` — numero_rma no repr | ✅ |

#### TestItemRmaStatus + TestItemRmaModel (7)
| Teste | Resultado |
|---|---|
| `test_not_received_value` — ItemRmaStatus.NOT_RECEIVED == "Not Received" | ✅ |
| `test_received_value` — ItemRmaStatus.RECEIVED == "Received" | ✅ |
| `test_delivered_value` — ItemRmaStatus.DELIVERED == "Delivered" | ✅ |
| `test_eight_statuses_exist` — len(ItemRmaStatus) == 8 | ✅ |
| `TestItemRmaModel::test_tablename` | ✅ |
| `TestItemRmaModel::test_instantiation` — consertado_por=None | ✅ |
| `TestItemRmaModel::test_repr` | ✅ |

---

### `test_routes_pedidos.py` — 21 testes

Cobre as 6 rotas de pedidos: POST, GET (lista), GET (detalhe), PUT, PATCH status, DELETE.

#### TestCreatePedido (4)
| Teste | Resultado |
|---|---|
| `test_returns_201_on_success` | ✅ |
| `test_response_contains_numero_os` — campo numero_os presente no body | ✅ |
| `test_returns_400_on_service_exception` — exceção genérica → 400 | ✅ |
| `test_returns_422_on_invalid_status` — status inválido no payload → 422 | ✅ |

#### TestListPedidos (3)
| Teste | Resultado |
|---|---|
| `test_returns_200_with_empty_list` — items=[], total=0 | ✅ |
| `test_returns_items_and_pagination_fields` — total=1, pages=1, len(items)=1 | ✅ |
| `test_passes_query_params_to_service` — status e page repassados ao serviço | ✅ |

#### TestGetPedido (3)
| Teste | Resultado |
|---|---|
| `test_returns_200_when_found` | ✅ |
| `test_response_contains_correct_id` — id no body bate com o path | ✅ |
| `test_returns_404_when_not_found` — NotFoundException → 404 | ✅ |

#### TestUpdatePedido (3)
| Teste | Resultado |
|---|---|
| `test_returns_200_on_success` | ✅ |
| `test_returns_404_when_not_found` | ✅ |
| `test_returns_400_on_general_exception` | ✅ |

#### TestChangeStatus (5)
| Teste | Resultado |
|---|---|
| `test_returns_200_on_valid_transition` | ✅ |
| `test_new_status_reflected_in_response` — status atualizado aparece no body | ✅ |
| `test_returns_422_on_invalid_status_value` — valor não permitido → 422 | ✅ |
| `test_returns_404_when_order_not_found` | ✅ |
| `test_accepts_optional_reason` — reason passado como 5º arg posicional | ✅ |

#### TestDeletePedido (3)
| Teste | Resultado |
|---|---|
| `test_returns_204_on_success` | ✅ |
| `test_returns_404_when_not_found` | ✅ |
| `test_calls_soft_delete_with_user_id` — user_id do token passado ao serviço | ✅ |

---

### `test_routes_custos.py` — 6 testes

Cobre `POST /pedidos/{id}/costs` e `PUT /pedidos/{id}/costs`.

| Teste | Resultado |
|---|---|
| `test_create_costs_success` — 201 | ✅ |
| `test_create_costs_conflict` — custo duplicado → 409 | ✅ |
| `test_create_costs_pedido_not_found` — 404 | ✅ |
| `test_update_costs_success` — 200 | ✅ |
| `test_update_costs_not_found` — 404 | ✅ |
| `test_update_costs_no_auth` — sem token → 401 | ✅ |

---

### `test_routes_itens.py` — 9 testes

Cobre `POST`, `PATCH status` e `DELETE` de `/pedidos/{id}/items`.

| Teste | Resultado |
|---|---|
| `test_add_item_success` — 201 | ✅ |
| `test_add_item_pedido_not_found` — 404 | ✅ |
| `test_add_item_no_auth` — 401 | ✅ |
| `test_update_status_success` — 200 | ✅ |
| `test_update_status_item_not_found` — 404 | ✅ |
| `test_update_status_invalid_status` — 422 | ✅ |
| `test_delete_item_success` — 204 | ✅ |
| `test_delete_item_not_found` — 404 | ✅ |
| `test_delete_item_no_auth` — 401 | ✅ |

---

### `test_routes_pagamentos.py` — 3 testes

Cobre `POST /pedidos/{id}/payment-methods`.

| Teste | Resultado |
|---|---|
| `test_add_payment_success` — 201 | ✅ |
| `test_add_payment_pedido_not_found` — 404 | ✅ |
| `test_add_payment_no_auth` — 401 | ✅ |

---

### `test_routes_audit.py` — 7 testes

Cobre os 3 endpoints LGPD/audit da fase 1.7.

#### TestGetOrderHistory (3)
| Teste | Resultado |
|---|---|
| `test_returns_status_history_and_audit_logs` — arrays preenchidos | ✅ |
| `test_empty_history_returns_empty_arrays` — arrays vazios | ✅ |
| `test_order_id_in_response` — order_id no body | ✅ |

#### TestExportUserData (2)
| Teste | Resultado |
|---|---|
| `test_returns_user_and_audit_logs` — user e audit_logs presentes | ✅ |
| `test_user_not_found_returns_404` | ✅ |

#### TestDeleteUserData (2)
| Teste | Resultado |
|---|---|
| `test_successful_deletion_returns_deleted_true` | ✅ |
| `test_deletion_calls_lgpd_service_with_correct_ids` — target_id e requesting_id corretos | ✅ |

---

### `test_routes_cotacoes.py` — 27 testes

Cobre 9 endpoints: 6 de cotação, 2 de itens e 1 de conversão.

#### TestCreateQuote (3) / TestListQuotes (3) / TestGetQuote (3)
| Teste | Resultado |
|---|---|
| `test_returns_201_on_success` | ✅ |
| `test_response_contains_cliente` | ✅ |
| `test_returns_400_on_service_exception` | ✅ |
| `test_returns_200_with_empty_list` | ✅ |
| `test_returns_items_and_pagination` | ✅ |
| `test_passes_filters_to_service` — cliente e page repassados | ✅ |
| `test_returns_200_when_found` | ✅ |
| `test_response_id_matches_path` | ✅ |
| `test_returns_404_when_not_found` | ✅ |

#### TestUpdateQuote (3) / TestUpdatePhase (3) / TestDeleteQuote (2)
| Teste | Resultado |
|---|---|
| `test_returns_200_on_success` | ✅ |
| `test_returns_404_when_not_found` | ✅ |
| `test_returns_400_on_service_exception` | ✅ |
| `test_returns_200_when_marking_sent` — status_enviada=True no body | ✅ |
| `test_returns_404_when_not_found` | ✅ |
| `test_returns_400_on_business_logic_error` | ✅ |
| `test_returns_204_on_success` | ✅ |
| `test_returns_404_when_not_found` | ✅ |

#### TestAddQuoteItem (4) / TestRemoveQuoteItem (2)
| Teste | Resultado |
|---|---|
| `test_returns_201_on_success` | ✅ |
| `test_response_contains_item_fields` | ✅ |
| `test_returns_404_when_quote_not_found` | ✅ |
| `test_returns_422_when_quantidade_zero` — quantidade=0 → 422 | ✅ |
| `test_returns_204_on_success` | ✅ |
| `test_returns_404_when_not_found` | ✅ |

#### TestConvertQuote (4)
| Teste | Resultado |
|---|---|
| `test_returns_201_on_success` | ✅ |
| `test_response_contains_pedido_and_cotacao_ids` | ✅ |
| `test_returns_404_when_quote_not_found` | ✅ |
| `test_returns_400_on_business_logic_error` — cotação não fechada | ✅ |

---

### `test_routes_rma.py` — 22 testes

Cobre os 5 endpoints de RMA: POST, GET lista, GET detalhe, PATCH close, PATCH item status.

#### TestCreateRma (6)
| Teste | Resultado |
|---|---|
| `test_returns_201_on_success` | ✅ |
| `test_response_contains_numero_rma` | ✅ |
| `test_response_status_is_registered` — status inicial "Registered" | ✅ |
| `test_returns_404_when_pedido_not_found` | ✅ |
| `test_returns_400_when_rma_number_already_exists` | ✅ |
| `test_returns_422_when_itens_is_empty` — lista vazia não permitida | ✅ |

#### TestListRmas (3) / TestGetRma (3)
| Teste | Resultado |
|---|---|
| `test_returns_200_with_empty_list` | ✅ |
| `test_returns_items_and_pagination` | ✅ |
| `test_passes_status_filter_to_service` — enum RmaStatus repassado | ✅ |
| `test_returns_200_when_found` | ✅ |
| `test_response_id_matches_path` | ✅ |
| `test_returns_404_when_not_found` | ✅ |

#### TestCloseRma (5)
| Teste | Resultado |
|---|---|
| `test_returns_200_on_success` | ✅ |
| `test_response_status_is_completed` — status "Completed" no body | ✅ |
| `test_returns_404_when_not_found` | ✅ |
| `test_returns_400_when_already_completed` | ✅ |
| `test_returns_400_when_already_cancelled` | ✅ |

#### TestUpdateItemStatus (5)
| Teste | Resultado |
|---|---|
| `test_returns_200_on_success` | ✅ |
| `test_response_reflects_new_status` — novo status no body | ✅ |
| `test_returns_404_when_item_not_found` | ✅ |
| `test_returns_422_on_invalid_status_value` | ✅ |
| `test_accepts_consertado_por_field` — campo opcional passado ao serviço | ✅ |

---

### `test_service_pedido_audit.py` — 5 testes

Verifica que ip_address e user_agent são corretamente capturados e persistidos no `AuditLog` em todas as operações de mutação de pedido.

| Teste | Resultado |
|---|---|
| `test_create_passes_ip_and_ua_to_audit_log` | ✅ |
| `test_update_passes_ip_and_ua_to_audit_log` | ✅ |
| `test_change_status_passes_ip_and_ua` | ✅ |
| `test_soft_delete_passes_ip_and_ua` | ✅ |
| `test_ip_ua_optional_defaults_to_none` — sem ip/ua → None no log | ✅ |

---

### `test_service_lgpd.py` — 8 testes

Verifica o `LgpdService.delete_user_data`: anonimização, limpeza de campos sensíveis e geração de audit log.

| Teste | Resultado |
|---|---|
| `test_anonymizes_email_and_name` — email → anonimizado.invalid, name → "Usuário Removido" | ✅ |
| `test_clears_sensitive_fields` — password_hash="", totp_secret=None, totp_enabled=False | ✅ |
| `test_sets_is_active_false_and_deleted_at` | ✅ |
| `test_creates_audit_log_with_delete_action` — action=DELETE, entity_type="user" | ✅ |
| `test_audit_log_old_values_contains_original_email` — email original preservado | ✅ |
| `test_user_not_found_returns_deleted_false` — sem commit | ✅ |
| `test_anonymized_email_contains_user_id_prefix` — prefixo de 8 chars do UUID | ✅ |
| `test_commits_after_all_changes` — commit chamado exatamente 1 vez | ✅ |

---

### `test_service_custo_pedido.py` — 10 testes

Verifica `CustoPedidoService`: cálculo financeiro e CRUD de custos.

| Teste | Resultado |
|---|---|
| `test_all_fields_sum_correctly_excludes_produto_inicial` | ✅ |
| `test_valor_venda_none_returns_no_lucro_or_margem` | ✅ |
| `test_valor_venda_zero_margem_is_none` | ✅ |
| `test_none_fields_treated_as_zero` | ✅ |
| `test_margem_rounded_to_two_decimal_places` | ✅ |
| `test_happy_path_calls_db_add_and_commit` | ✅ |
| `test_existing_custo_raises_business_logic_exception` | ✅ |
| `test_happy_path_updates_fields_and_commits` | ✅ |
| `test_custo_not_found_raises_not_found_exception` | ✅ |
| `test_update_costs_adds_audit_log` | ✅ |

---

### `test_service_item_pedido.py` — 8 testes + `test_service_pagamento_pedido.py` — 3 testes

| Teste | Resultado |
|---|---|
| `test_get_item_not_found` | ✅ |
| `test_get_item_found` | ✅ |
| `test_add_item_success` | ✅ |
| `test_add_item_pedido_not_found` | ✅ |
| `test_update_status_success` | ✅ |
| `test_update_status_item_not_found` | ✅ |
| `test_remove_item_success` | ✅ |
| `test_remove_item_not_found` | ✅ |
| `test_add_payment_success` | ✅ |
| `test_add_payment_pedido_not_found` | ✅ |
| `test_add_payment_forma_salva` | ✅ |

---

### `test_schemas_produto.py` — 6 testes

Verifica validação dos schemas Pydantic de produto.

| Teste | Resultado |
|---|---|
| `test_status_update_valid` | ✅ |
| `test_status_update_invalid` — status inexistente rejeitado | ✅ |
| `test_create_quantidade_zero` — quantidade=0 rejeitada | ✅ |
| `test_create_valor_projetado_negativo` — valor negativo rejeitado | ✅ |
| `test_create_valid` | ✅ |
| `test_create_all_statuses_valid` — todos os 9 status aceitos | ✅ |

---

## Cobertura por Camada

| Camada | Endpoints/Métodos cobertos | Status |
|---|---|---|
| Models — enums | UserRole (4), AuditAction (4), EntityType (5), RmaStatus (10), ItemRmaStatus (8) | ✅ Completo |
| Models — tabelas | users, pedidos, pedido_forma_pagamento, custo_pedido, produtos, cotacoes, item_cotacao, rmas, item_rma, audit_logs, status_history | ✅ Completo |
| Rotas — Auth | Dependências testadas indiretamente via mocks | ✅ |
| Rotas — Pedidos | POST, GET lista, GET detalhe, PUT, PATCH status, DELETE | ✅ Completo |
| Rotas — Cotações | POST, GET lista, GET detalhe, PUT, PATCH phase, DELETE | ✅ Completo |
| Rotas — Quote Items | POST item, DELETE item | ✅ Completo |
| Rotas — Quote Conversion | POST convert | ✅ Completo |
| Rotas — RMA | POST, GET lista, GET detalhe, PATCH close, PATCH item status | ✅ Completo |
| Rotas — Order Items | POST, PATCH status, DELETE | ✅ Completo |
| Rotas — Custos | POST, PUT | ✅ Completo |
| Rotas — Pagamentos | POST | ✅ Completo |
| Rotas — Audit/LGPD | GET history, GET data-export, DELETE delete-data | ✅ Completo |
| Serviço — PedidoService | ip/ua em create, update, change_status, soft_delete | ✅ Completo |
| Serviço — LgpdService | delete_user_data (7 cenários) | ✅ Completo |
| Serviço — CustoPedidoService | calcular financeiros, create, update | ✅ Completo |
| Serviço — ItemPedidoService | get, add, update_status, remove | ✅ Completo |
| Serviço — PagamentoPedidoService | add_payment | ✅ Completo |
| Schemas | Produto (validações de status, quantidade, valor) | ✅ Completo |

---

## Observações Técnicas

- **Warnings de deprecação Pydantic (15):** Gerados por classes com `class Config:` em vez de `ConfigDict`. Não afetam funcionamento — serão resolvidos em refactor futuro para Pydantic V2 puro.
- **Ausência de testes de integração real:** Os testes usam SQLite + mocks. Testes de integração com PostgreSQL real estão previstos na fase 1.8.
- **Não cobertos:** `CotacaoService` diretamente (coberto indiretamente via rotas), `RmaService` diretamente, `ConversaoCotacaoService` diretamente, `ItemCotacaoService` diretamente — todos cobertos via rotas com mocks.

---

*Gerado em: 6 de maio de 2026*
