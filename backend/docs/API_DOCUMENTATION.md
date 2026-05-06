# Orderly Hub — API Documentation

**Base URL:** `http://localhost:8000/api`  
**Swagger interativo:** `http://localhost:8000/docs`  
**Versão:** 1.8 — 42 endpoints  
**Última atualização:** 6 de maio de 2026

---

## Autenticação

Todos os endpoints (exceto `POST /auth/register` e `POST /auth/login`) requerem um **JWT Bearer token** no header:

```
Authorization: Bearer <access_token>
```

### Como obter o token
1. Faça `POST /auth/login` com email e senha.
2. Se o usuário não tiver 2FA habilitado, a resposta retorna `access_token` e `refresh_token` diretamente.
3. Se tiver 2FA, o login retorna `202 Accepted` com `requires_2fa: true`. Use `POST /auth/verify-2fa` para completar.

### Renovar token expirado
Use `POST /auth/refresh-token` com o `refresh_token` para obter um novo `access_token` sem precisar logar novamente.

### Níveis de acesso
Atualmente todos os usuários registrados têm papel **admin** com acesso total. RBAC granular (manager/seller/viewer) é pós-MVP.

### Erros comuns de autenticação
| Código | Significado |
|---|---|
| `401 Unauthorized` | Token ausente, inválido ou expirado |
| `401 Unauthorized` | Token revogado (após logout) |
| `403 Forbidden` | Sem permissão para o recurso |

---

## Grupos de Endpoints

- [Auth](#auth)
- [Users](#users)
- [Pedidos](#pedidos)
- [Itens do Pedido](#itens-do-pedido)
- [Custos do Pedido](#custos-do-pedido)
- [Pagamentos do Pedido](#pagamentos-do-pedido)
- [Cotações](#cotações)
- [Itens de Cotação](#itens-de-cotação)
- [Conversão de Cotação](#conversão-de-cotação)
- [RMA](#rma)

---

## Auth

### POST /auth/register
Cria um novo usuário. O **primeiro registro não requer autenticação** (bootstrap). Os demais exigem token de admin.

**Auth:** Opcional (obrigatório a partir do 2º usuário)

**Request body:**
```json
{
  "email": "novo@empresa.com",
  "name": "Novo Usuário",
  "password": "SenhaSegura123!"
}
```

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "novo@empresa.com",
  "name": "Novo Usuário",
  "role": "admin",
  "is_active": true,
  "totp_enabled": false,
  "created_at": "2026-05-06T10:00:00+00:00",
  "updated_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `401` | Segundo registro sem token |
| `409` | Email já cadastrado |

---

### POST /auth/login
Autentica email e senha. Retorna tokens JWT ou solicita 2FA.

**Auth:** Não requerida

**Request body:**
```json
{
  "email": "admin@empresa.com",
  "password": "SenhaSegura123!"
}
```

**Response 200 (sem 2FA):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@empresa.com",
    "name": "Admin",
    "role": "admin",
    "is_active": true,
    "totp_enabled": false
  }
}
```

**Response 202 (com 2FA habilitado):**
```json
{
  "detail": {
    "requires_2fa": true,
    "user_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `401` | Email ou senha incorretos |

---

### POST /auth/verify-2fa
Valida o código TOTP e retorna os tokens JWT.

**Auth:** Não requerida

**Request body:**
```json
{
  "email": "admin@empresa.com",
  "token": "123456"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": { "..." }
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `401` | Código TOTP inválido |
| `404` | Usuário não encontrado ou 2FA não configurado |

---

### POST /auth/refresh-token
Renova o `access_token` usando o `refresh_token`.

**Auth:** Não requerida

**Request body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `401` | Refresh token inválido ou expirado |

---

### POST /auth/logout
Revoga o access token atual (blacklist). Após isso, o token é rejeitado em qualquer endpoint.

**Auth:** Requerida

**Request body:** Nenhum

**Response:** `204 No Content`

---

### GET /auth/me
Retorna os dados do usuário autenticado.

**Auth:** Requerida

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@empresa.com",
  "name": "Admin",
  "role": "admin",
  "is_active": true,
  "totp_enabled": true,
  "created_at": "2026-01-01T00:00:00+00:00",
  "updated_at": "2026-05-06T10:00:00+00:00"
}
```

---

### POST /auth/change-password
Troca a senha do usuário autenticado.

**Auth:** Requerida

**Request body:**
```json
{
  "current_password": "SenhaAtual123!",
  "new_password": "NovaSenha456!"
}
```

**Response:** `204 No Content`

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Senha atual incorreta |
| `401` | Não autenticado |

---

### POST /auth/2fa/setup
Gera segredo TOTP e retorna QR code em base64 para configurar no Google Authenticator.

**Auth:** Requerida

**Response 200:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgo..."
}
```

---

### POST /auth/2fa/confirm
Confirma a ativação do 2FA após o usuário escanear o QR code.

**Auth:** Requerida

**Request body:**
```json
{
  "email": "admin@empresa.com",
  "token": "123456"
}
```

**Response 200:**
```json
{
  "detail": "2FA enabled successfully"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Código TOTP inválido |

---

## Users

### GET /users
Lista todos os usuários com paginação.

**Auth:** Requerida (admin)

**Query params:**
| Param | Tipo | Padrão | Descrição |
|---|---|---|---|
| `page` | int | 1 | Página |
| `limit` | int | 20 | Itens por página |

**Response 200:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@empresa.com",
      "name": "Admin",
      "role": "admin",
      "is_active": true,
      "totp_enabled": true
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

---

### GET /users/me
Retorna os dados do usuário autenticado (alias de `GET /auth/me`).

**Auth:** Requerida

**Response 200:** Mesmo formato de `GET /auth/me`.

---

### GET /users/{user_id}
Retorna os dados de um usuário específico.

**Auth:** Requerida (admin)

**Response 200:** Objeto `UserResponse`.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Usuário não encontrado |

---

### PATCH /users/{user_id}/deactivate
Desativa um usuário (soft disable — não apaga). Admin não pode desativar a si mesmo.

**Auth:** Requerida (admin)

**Response 200:** Objeto `UserResponse` com `is_active: false`.

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Tentativa de desativar a própria conta |
| `404` | Usuário não encontrado |

---

### GET /users/{user_id}/data-export
Exporta todos os dados de um usuário para fins de conformidade com a LGPD.

**Auth:** Requerida

**Response 200:**
```json
{
  "user": {
    "id": "550e8400-...",
    "email": "usuario@empresa.com",
    "name": "Usuário",
    "role": "admin",
    "is_active": true,
    "totp_enabled": false,
    "created_at": "2026-01-01T00:00:00+00:00",
    "updated_at": "2026-05-06T10:00:00+00:00"
  },
  "audit_logs": [
    {
      "id": "...",
      "entity_type": "user",
      "entity_id": "550e8400-...",
      "action": "CREATE",
      "changed_by": "...",
      "changed_at": "2026-01-01T00:00:00+00:00",
      "old_values": null,
      "new_values": { "role": "admin" },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0"
    }
  ]
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Usuário não encontrado |

---

### DELETE /users/{user_id}/delete-data
Anonimiza os dados pessoais do usuário (LGPD — direito ao esquecimento). Não apaga fisicamente — substitui email/nome, zera senha e TOTP, desativa conta. Gera audit log com valores originais.

**Auth:** Requerida (admin)

**Response 200:**
```json
{
  "deleted": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `200 deleted: false` | Usuário não encontrado |

---

## Pedidos

Valores de `status` aceitos: `To Buy` · `Bought` · `Received` · `To Invoice` · `Invoiced` · `To Pack` · `Ready for Delivery` · `Out for Delivery` · `Delivered` · `Delayed` · `Cancelled`

### POST /pedidos
Cria um novo pedido. O número de OS é gerado automaticamente se não informado.

**Auth:** Requerida

**Request body:**
```json
{
  "id_loja": "uuid-da-loja",
  "id_vendedor": "uuid-do-vendedor",
  "id_cliente": "uuid-do-cliente",
  "data_pedido": "2026-05-06",
  "data_entrega": "2026-05-20",
  "status": "To Buy",
  "valor_venda": "1500.00",
  "observacao": "Pedido urgente",
  "formas_pagamento": [
    { "forma": "credito" }
  ],
  "custo": {
    "custo_produto_inicial": "800.00",
    "pct_imposto_compra": "5.00"
  }
}
```

**Response 201:**
```json
{
  "id": "uuid-do-pedido",
  "numero_os": "OS-001",
  "id_loja": "uuid-da-loja",
  "id_vendedor": "uuid-do-vendedor",
  "id_cliente": "uuid-do-cliente",
  "data_pedido": "2026-05-06",
  "data_entrega": "2026-05-20",
  "status": "To Buy",
  "valor_venda": "1500.00",
  "economia": null,
  "formas_pagamento": [{ "id": "...", "forma": "credito" }],
  "custo": { "id": "...", "custo_produto_inicial": "800.00", "pct_imposto_compra": "5.00" },
  "created_by": "uuid-do-usuario",
  "created_at": "2026-05-06T10:00:00+00:00",
  "updated_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Erro de validação ou banco |
| `422` | `status` com valor não permitido |

---

### GET /pedidos
Lista pedidos com filtros e paginação. Exclui registros com `deleted_at` preenchido.

**Auth:** Requerida

**Query params:**
| Param | Tipo | Padrão | Descrição |
|---|---|---|---|
| `page` | int | 1 | Página |
| `limit` | int | 20 | Itens por página (máx. 100) |
| `status` | string | — | Filtrar por status |
| `id_loja` | UUID | — | Filtrar por loja |
| `id_vendedor` | UUID | — | Filtrar por vendedor |
| `data_inicio` | string | — | Data inicial (YYYY-MM-DD) |
| `data_fim` | string | — | Data final (YYYY-MM-DD) |
| `sort_by` | string | `data_pedido` | Campo de ordenação |
| `sort_dir` | `asc`/`desc` | `desc` | Direção da ordenação |

**Response 200:**
```json
{
  "items": [ { "...pedido..." } ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

---

### GET /pedidos/{pedido_id}
Retorna detalhes completos de um pedido, incluindo histórico de status.

**Auth:** Requerida

**Response 200:**
```json
{
  "id": "uuid-do-pedido",
  "numero_os": "OS-001",
  "status": "Bought",
  "status_history": [
    {
      "id": "...",
      "old_status": null,
      "new_status": "To Buy",
      "changed_by": "uuid-usuario",
      "changed_at": "2026-05-06T10:00:00+00:00",
      "reason": "Pedido criado"
    },
    {
      "id": "...",
      "old_status": "To Buy",
      "new_status": "Bought",
      "changed_by": "uuid-usuario",
      "changed_at": "2026-05-07T09:00:00+00:00",
      "reason": null
    }
  ]
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido não encontrado ou deletado |

---

### PUT /pedidos/{pedido_id}
Atualiza campos do pedido. Todos os campos são opcionais — apenas os enviados são alterados.

**Auth:** Requerida

**Request body (todos opcionais):**
```json
{
  "observacao": "Pedido atualizado",
  "valor_venda": "1800.00",
  "data_entrega": "2026-05-25",
  "numero_nf": "NF-00123"
}
```

**Response 200:** Objeto `PedidoResponse` atualizado.

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Erro de negócio ou banco |
| `404` | Pedido não encontrado |

---

### PATCH /pedidos/{pedido_id}/status
Altera o status do pedido. Gera registro em `status_history` e `audit_logs`.

**Auth:** Requerida

**Request body:**
```json
{
  "new_status": "Bought",
  "reason": "Compra efetuada no fornecedor X"
}
```

**Response 200:** Objeto `PedidoResponse` com status atualizado.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido não encontrado |
| `422` | Valor de status não permitido |

---

### DELETE /pedidos/{pedido_id}
Soft-delete do pedido (preenche `deleted_at`). Gera registro em `audit_logs`.

**Auth:** Requerida

**Response:** `204 No Content`

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido não encontrado |

---

### GET /pedidos/{pedido_id}/history
Retorna o histórico completo de um pedido: transições de status e audit logs.

**Auth:** Requerida

**Response 200:**
```json
{
  "order_id": "uuid-do-pedido",
  "status_history": [
    {
      "id": "...",
      "entity_type": "pedido",
      "entity_id": "uuid-do-pedido",
      "old_status": null,
      "new_status": "To Buy",
      "changed_by": "uuid-usuario",
      "changed_at": "2026-05-06T10:00:00+00:00",
      "reason": "Pedido criado"
    }
  ],
  "audit_logs": [
    {
      "id": "...",
      "entity_type": "pedido",
      "entity_id": "uuid-do-pedido",
      "action": "CREATE",
      "changed_by": "uuid-usuario",
      "changed_at": "2026-05-06T10:00:00+00:00",
      "old_values": null,
      "new_values": { "status": "To Buy", "numero_os": "OS-001" },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0"
    }
  ]
}
```

---

## Itens do Pedido

Valores de `status` aceitos: `Pending` · `To Purchase` · `In Stock` · `Received` · `Ready` · `Shipped` · `Delivered` · `Delayed` · `Cancelled`

### POST /pedidos/{pedido_id}/items
Adiciona um produto ao pedido.

**Auth:** Requerida

**Request body:**
```json
{
  "id_vendedor": "uuid-do-vendedor",
  "descricao": "Notebook Dell Inspiron 15",
  "quantidade": 2,
  "valor_projetado": "3500.00",
  "fornecedor": "Dell Brasil",
  "status": "Pending"
}
```

**Response 201:**
```json
{
  "id": "uuid-do-produto",
  "id_pedido": "uuid-do-pedido",
  "descricao": "Notebook Dell Inspiron 15",
  "quantidade": 2,
  "valor_projetado": "3500.00",
  "valor_compra": null,
  "economia": null,
  "status": "Pending",
  "created_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Erro de validação |
| `404` | Pedido não encontrado |

---

### PATCH /pedidos/{pedido_id}/items/{item_id}/status
Atualiza o status de um produto do pedido.

**Auth:** Requerida

**Request body:**
```json
{
  "new_status": "In Stock"
}
```

**Response 200:** Objeto `ProdutoResponse` atualizado.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido ou item não encontrado |
| `422` | Status inválido |

---

### DELETE /pedidos/{pedido_id}/items/{item_id}
Remove um produto do pedido.

**Auth:** Requerida

**Response:** `204 No Content`

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido ou item não encontrado |

---

## Custos do Pedido

### POST /pedidos/{pedido_id}/costs
Registra os custos do pedido (relação 1:1 — cada pedido tem um único registro de custos).

**Auth:** Requerida

**Request body (todos opcionais exceto o endpoint em si):**
```json
{
  "custo_produto_inicial": "800.00",
  "custo_produto_final": "750.00",
  "custo_servico": "100.00",
  "pct_imposto_compra": "5.00",
  "imposto_compra": "40.00",
  "pct_imposto_venda": "3.50",
  "imposto_venda": "28.00",
  "pct_custo_credito": "2.99",
  "custo_credito": "23.92"
}
```

**Response 201:**
```json
{
  "id": "uuid-do-custo",
  "id_pedido": "uuid-do-pedido",
  "custo_produto_inicial": "800.00",
  "custo_produto_final": "750.00",
  "custo_servico": "100.00",
  "financials": {
    "custo_total": "850.00",
    "lucro_liquido": "650.00",
    "margem_bruta_pct": "43.33"
  }
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido não encontrado |
| `409` | Custo já registrado para este pedido |

---

### PUT /pedidos/{pedido_id}/costs
Atualiza os custos do pedido.

**Auth:** Requerida

**Request body:** Mesmos campos de `POST` (todos opcionais).

**Response 200:** Objeto `CustoPedidoOut` atualizado.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Custo não encontrado para este pedido |

---

## Pagamentos do Pedido

### POST /pedidos/{pedido_id}/payment-methods
Registra uma forma de pagamento para o pedido. Múltiplos registros são permitidos.

**Auth:** Requerida

**Request body:**
```json
{
  "forma": "credito"
}
```

Valores comuns: `credito` · `debito` · `pix` · `boleto` · `dinheiro`

**Response 201:**
```json
{
  "id": "uuid",
  "id_pedido": "uuid-do-pedido",
  "forma": "credito"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Pedido não encontrado |

---

## Cotações

Fases disponíveis: `status_enviada` · `status_em_fechamento` · `status_fechada` · `status_caida`

### POST /quotes
Cria uma nova cotação.

**Auth:** Requerida

**Request body:**
```json
{
  "id_loja": "uuid-da-loja",
  "id_vendedor": "uuid-do-vendedor",
  "cliente": "Empresa ABC Ltda",
  "cnpj_cliente": "12.345.678/0001-99",
  "data_cotacao": "2026-05-06",
  "data_validade": "2026-05-20",
  "numero_requisicao": "REQ-2026-001",
  "b2b_company": "Lucky Store",
  "fornecedor": "Distribuidor XYZ",
  "valor_total": "5000.00",
  "pct_imposto_lucky": "3.50",
  "pct_imposto_btech": "4.00",
  "observacao": "Cotação para renovação de equipamentos",
  "itens": [
    {
      "descricao": "Notebook Dell i7",
      "quantidade": 2,
      "valor_unitario": "2000.00",
      "fornecedor": "Dell"
    }
  ]
}
```

**Response 201:**
```json
{
  "id": "uuid-da-cotacao",
  "cliente": "Empresa ABC Ltda",
  "status_enviada": false,
  "status_em_fechamento": false,
  "status_fechada": false,
  "status_caida": false,
  "itens": [
    {
      "id": "uuid-do-item",
      "descricao": "Notebook Dell i7",
      "quantidade": 2,
      "valor_unitario": "2000.00",
      "valor_total": "4000.00",
      "valor_fechamento": null,
      "valor_total_fechamento": null
    }
  ],
  "created_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Erro de validação ou duplicidade |

---

### GET /quotes
Lista cotações com filtros e paginação.

**Auth:** Requerida

**Query params:**
| Param | Tipo | Padrão | Descrição |
|---|---|---|---|
| `page` | int | 1 | Página |
| `limit` | int | 20 | Itens por página |
| `id_loja` | UUID | — | Filtrar por loja |
| `id_vendedor` | UUID | — | Filtrar por vendedor |
| `cliente` | string | — | Busca parcial por nome do cliente |
| `data_inicio` | string | — | Data inicial (YYYY-MM-DD) |
| `data_fim` | string | — | Data final |
| `sort_by` | string | `data_cotacao` | Campo de ordenação |
| `sort_dir` | `asc`/`desc` | `desc` | Direção |

**Response 200:**
```json
{
  "items": [ { "...cotacao..." } ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

---

### GET /quotes/{quote_id}
Retorna os detalhes de uma cotação, incluindo seus itens com `valor_total` calculado.

**Auth:** Requerida

**Response 200:** Objeto `CotacaoResponse` completo.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Cotação não encontrada ou deletada |

---

### PUT /quotes/{quote_id}
Atualiza os dados principais da cotação.

**Auth:** Requerida

**Request body (todos opcionais):**
```json
{
  "cliente": "Empresa ABC Atualizada",
  "valor_total": "5500.00",
  "observacao": "Revisão após negociação"
}
```

**Response 200:** Objeto `CotacaoResponse` atualizado.

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Erro de validação |
| `404` | Cotação não encontrada |

---

### PATCH /quotes/{quote_id}/phase
Atualiza o estado de uma ou mais fases da cotação. Cada campo é independente.

**Auth:** Requerida

**Request body (todos opcionais):**
```json
{
  "status_enviada": true,
  "data_envio": "2026-05-07",
  "status_em_fechamento": true,
  "data_prevista_fechamento": "2026-05-15",
  "status_fechada": false,
  "status_caida": false
}
```

**Response 200:** Objeto `CotacaoResponse` com fases atualizadas.

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Violação de regra de negócio |
| `404` | Cotação não encontrada |

---

### DELETE /quotes/{quote_id}
Soft-delete da cotação.

**Auth:** Requerida

**Response:** `204 No Content`

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Cotação não encontrada |

---

## Itens de Cotação

### POST /quotes/{quote_id}/items
Adiciona um item à cotação.

**Auth:** Requerida

**Request body:**
```json
{
  "descricao": "Monitor Dell 27\"",
  "quantidade": 3,
  "valor_unitario": "1500.00",
  "valor_fechamento": "1400.00",
  "fornecedor": "Dell Brasil"
}
```

**Response 201:**
```json
{
  "id": "uuid-do-item",
  "id_cotacao": "uuid-da-cotacao",
  "descricao": "Monitor Dell 27\"",
  "quantidade": 3,
  "valor_unitario": "1500.00",
  "valor_total": "4500.00",
  "valor_fechamento": "1400.00",
  "valor_total_fechamento": "4200.00",
  "fornecedor": "Dell Brasil",
  "created_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Cotação não encontrada |
| `422` | `quantidade` ≤ 0 |

---

### DELETE /quotes/{quote_id}/items/{item_id}
Remove um item da cotação.

**Auth:** Requerida

**Response:** `204 No Content`

**Erros:**
| Código | Motivo |
|---|---|
| `404` | Cotação ou item não encontrado |

---

## Conversão de Cotação

### POST /quotes/{quote_id}/convert
Converte uma cotação em pedido. Gera número de OS automaticamente. O pedido é criado com os dados da cotação.

**Auth:** Requerida

**Response 201:**
```json
{
  "id_pedido": "uuid-do-pedido-criado",
  "id_cotacao": "uuid-da-cotacao",
  "message": "Cotação convertida em pedido com sucesso"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Cotação em estado inválido para conversão |
| `404` | Cotação não encontrada |

---

## RMA

Status do RMA: `Registered` · `In Analysis` · `Approved` · `In Repair` · `Repaired` · `Ready` · `Shipped` · `Delivered` · `Cancelled` · `Completed`

Status do item RMA: `Not Received` · `Received` · `In Repair` · `Repaired` · `Ready` · `Shipped` · `Delivered` · `Cancelled`

### POST /rma
Cria um RMA a partir de um pedido existente. Os dados de loja e vendedor são herdados do pedido.

**Auth:** Requerida

**Request body:**
```json
{
  "id_pedido_origem": "uuid-do-pedido",
  "prazo_entrega": "2026-06-01",
  "itens": [
    {
      "id_produto_origem": "uuid-do-produto",
      "descricao": "Notebook com tela trincada",
      "quantidade": 1
    }
  ]
}
```

**Response 201:**
```json
{
  "id": "uuid-do-rma",
  "id_pedido_origem": "uuid-do-pedido",
  "id_vendedor": "uuid-do-vendedor",
  "id_loja": "uuid-da-loja",
  "numero_rma": "RMA-2026-000001",
  "data_registro": "2026-05-06",
  "prazo_entrega": "2026-06-01",
  "status": "Registered",
  "itens": [
    {
      "id": "uuid-do-item-rma",
      "id_rma": "uuid-do-rma",
      "id_produto_origem": "uuid-do-produto",
      "descricao": "Notebook com tela trincada",
      "quantidade": 1,
      "status": "Not Received",
      "consertado_por": null
    }
  ],
  "created_at": "2026-05-06T10:00:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `400` | Número RMA já existe / erro de validação |
| `404` | Pedido não encontrado |
| `422` | Lista de itens vazia |

---

### GET /rma
Lista RMAs com filtros e paginação.

**Auth:** Requerida

**Query params:**
| Param | Tipo | Padrão | Descrição |
|---|---|---|---|
| `page` | int | 1 | Página |
| `limit` | int | 20 | Itens por página |
| `status` | RmaStatus | — | Filtrar por status |
| `id_loja` | UUID | — | Filtrar por loja |
| `id_vendedor` | UUID | — | Filtrar por vendedor |
| `id_pedido_origem` | UUID | — | Filtrar por pedido de origem |
| `sort_by` | string | `data_registro` | Campo de ordenação |
| `sort_dir` | `asc`/`desc` | `desc` | Direção |

**Response 200:**
```json
{
  "items": [ { "...rma..." } ],
  "total": 8,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

---

### GET /rma/{rma_id}
Retorna os detalhes de um RMA com seus itens.

**Auth:** Requerida

**Response 200:** Objeto `RmaResponse` completo.

**Erros:**
| Código | Motivo |
|---|---|
| `404` | RMA não encontrado |

---

### PATCH /rma/{rma_id}/close
Conclui o RMA (status → `Completed`). Gera registro em `status_history` e `audit_logs`.

**Auth:** Requerida

**Request body:** Nenhum

**Response 200:** Objeto `RmaResponse` com `status: "Completed"`.

**Erros:**
| Código | Motivo |
|---|---|
| `400` | RMA já está `Completed` ou `Cancelled` |
| `404` | RMA não encontrado |

---

### PATCH /rma/{rma_id}/items/{item_id}/status
Atualiza o status de um item do RMA.

**Auth:** Requerida

**Request body:**
```json
{
  "new_status": "Received",
  "consertado_por": "Técnico João Silva"
}
```

> `consertado_por` é opcional — informar quando o item foi reparado.

**Response 200:**
```json
{
  "id": "uuid-do-item-rma",
  "id_rma": "uuid-do-rma",
  "id_produto_origem": "uuid-do-produto",
  "descricao": "Notebook com tela trincada",
  "quantidade": 1,
  "status": "Received",
  "consertado_por": null,
  "created_at": "2026-05-06T10:00:00+00:00",
  "updated_at": "2026-05-06T11:30:00+00:00"
}
```

**Erros:**
| Código | Motivo |
|---|---|
| `404` | RMA ou item não encontrado |
| `422` | Valor de status inválido |

---

## Resumo de Status HTTP

| Código | Significado |
|---|---|
| `200` | Sucesso |
| `201` | Recurso criado |
| `202` | Aceito (requer etapa adicional — 2FA) |
| `204` | Sucesso sem conteúdo (delete/logout) |
| `400` | Erro de validação ou regra de negócio |
| `401` | Não autenticado |
| `403` | Sem permissão |
| `404` | Recurso não encontrado |
| `409` | Conflito (duplicidade) |
| `422` | Dados inválidos (validação Pydantic) |

---

## Formato de Erro

Todos os erros retornam o mesmo formato:

```json
{
  "detail": "Mensagem descrevendo o erro"
}
```

Exemplos:
```json
{ "detail": "Pedido OS-001 não encontrado" }
{ "detail": "Número RMA 'RMA-2026-000001' já existe" }
{ "detail": "Email já cadastrado" }
```

---

*Documentação gerada em: 6 de maio de 2026*
