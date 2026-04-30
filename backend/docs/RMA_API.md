# RMA API — Documentação

**Sprint 1 | Autor:** Maria Eduarda Soares  
**Data:** Abril 2026

---

## Visão Geral

O módulo de RMA (Return Merchandise Authorization) permite registrar e acompanhar devoluções de produtos vinculadas a pedidos existentes. Cada RMA é criado a partir de um pedido de origem e contém uma lista de itens a serem devolvidos ou reparados.

---

## Arquitetura

Seguindo o padrão em camadas do projeto:

```
app/schemas/rma.py       — validação de entrada/saída (Pydantic)
app/services/rma.py      — regras de negócio (RmaService)
app/api/routes/rma.py    — endpoints FastAPI
app/api/__init__.py      — registro do rma_router (atualizado)
```

Os modelos ORM (`Rma`, `ItemRma`) já existiam em `app/models/`.

---

## Modelos de Dados

### Rma (`rmas`)

| Campo             | Tipo        | Descrição                                      |
|-------------------|-------------|------------------------------------------------|
| `id`              | UUID        | Chave primária                                 |
| `id_pedido_origem`| UUID (FK)   | Pedido de origem da devolução                  |
| `id_vendedor`     | UUID (FK)   | Herdado do pedido de origem                    |
| `id_loja`         | UUID (FK)   | Herdado do pedido de origem                    |
| `numero_rma`      | String(50)  | Identificador único — gerado automaticamente   |
| `data_registro`   | Date        | Data de criação (preenchida automaticamente)   |
| `prazo_entrega`   | Date        | Prazo estimado para conclusão (opcional)       |
| `status`          | Enum        | Status atual do RMA                            |
| `created_by`      | UUID (FK)   | Usuário que criou o registro                   |

### ItemRma (`item_rma`)

| Campo              | Tipo       | Descrição                          |
|--------------------|------------|------------------------------------|
| `id`               | UUID       | Chave primária                     |
| `id_rma`           | UUID (FK)  | RMA pai                            |
| `id_produto_origem`| UUID (FK)  | Produto sendo devolvido/reparado   |
| `descricao`        | Text       | Descrição do defeito/motivo        |
| `quantidade`       | Integer    | Quantidade de unidades             |
| `status`           | Enum       | Status do item                     |
| `consertado_por`   | String     | Responsável pelo reparo (opcional) |

### RmaStatus (fluxo)

```
REGISTERED → IN_ANALYSIS → APPROVED → IN_REPAIR → REPAIRED → READY → SHIPPED → DELIVERED → COMPLETED
                                                                              ↘ CANCELLED (qualquer etapa)
```

> `PATCH /rma/:id/close` transiciona diretamente para `COMPLETED`.

### ItemRmaStatus

`NOT_RECEIVED` → `RECEIVED` → `IN_REPAIR` → `REPAIRED` → `READY` → `SHIPPED` → `DELIVERED`  
`CANCELLED` (qualquer etapa)

---

## Endpoints

Base URL: `/api/rma`  
Autenticação: Bearer JWT (todos os endpoints)

---

### POST `/api/rma` — Criar RMA

Cria um RMA a partir de um pedido existente. O `id_vendedor` e `id_loja` são herdados automaticamente do pedido de origem. O `numero_rma` é gerado automaticamente no formato `RMA-YYYY-XXXXXX` se não fornecido.

**Request body:**
```json
{
  "id_pedido_origem": "uuid-do-pedido",
  "numero_rma": "RMA-2026-000001",   // opcional
  "prazo_entrega": "2026-05-15",     // opcional
  "itens": [
    {
      "id_produto_origem": "uuid-do-produto",
      "descricao": "Tela trincada",
      "quantidade": 1
    }
  ]
}
```

**Resposta:** `201 Created`
```json
{
  "id": "uuid",
  "id_pedido_origem": "uuid",
  "id_vendedor": "uuid",
  "id_loja": "uuid",
  "numero_rma": "RMA-2026-000001",
  "data_registro": "2026-04-30",
  "prazo_entrega": "2026-05-15",
  "status": "Registered",
  "created_by": "uuid",
  "created_at": "2026-04-30T...",
  "updated_at": "2026-04-30T...",
  "itens": [
    {
      "id": "uuid",
      "id_rma": "uuid",
      "id_produto_origem": "uuid",
      "descricao": "Tela trincada",
      "quantidade": 1,
      "status": "Not Received",
      "consertado_por": null,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**Erros:**
- `404` — Pedido de origem não encontrado
- `400` — `numero_rma` já existe ou lista de itens vazia

---

### GET `/api/rma` — Listar RMAs

Retorna lista paginada de RMAs com filtros opcionais.

**Query params:**

| Parâmetro        | Tipo    | Padrão        | Descrição                  |
|------------------|---------|---------------|----------------------------|
| `page`           | int     | `1`           | Página atual               |
| `limit`          | int     | `20`          | Itens por página (máx 100) |
| `status`         | string  | —             | Filtrar por status do RMA  |
| `id_loja`        | UUID    | —             | Filtrar por loja           |
| `id_vendedor`    | UUID    | —             | Filtrar por vendedor       |
| `id_pedido_origem`| UUID   | —             | Filtrar por pedido origem  |
| `sort_by`        | string  | `data_registro`| Campo de ordenação        |
| `sort_dir`       | string  | `desc`        | `asc` ou `desc`            |

**Resposta:** `200 OK`
```json
{
  "items": [ /* lista de RmaResponse */ ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

---

### GET `/api/rma/:id` — Detalhes do RMA

Retorna um RMA com todos os seus itens.

**Resposta:** `200 OK` — objeto `RmaResponse` completo  
**Erros:** `404` — RMA não encontrado

---

### PATCH `/api/rma/:id/close` — Concluir RMA

Marca o RMA como `Completed`. Registra a transição no histórico de status e no audit log.

**Request body:** nenhum

**Resposta:** `200 OK` — `RmaResponse` atualizado  
**Erros:**
- `404` — RMA não encontrado
- `400` — RMA já está `Completed` ou está `Cancelled`

---

### PATCH `/api/rma/:id/items/:itemId/status` — Atualizar Status de Item

Atualiza o status de um item individual do RMA. Aceita opcionalmente o campo `consertado_por`.

**Request body:**
```json
{
  "new_status": "Repaired",
  "consertado_por": "Técnico João"   // opcional
}
```

**Valores válidos para `new_status`:**  
`Not Received`, `Received`, `In Repair`, `Repaired`, `Ready`, `Shipped`, `Delivered`, `Cancelled`

**Resposta:** `200 OK` — `ItemRmaResponse` atualizado  
**Erros:**
- `404` — RMA ou item não encontrado

---

## Regras de Negócio

1. **Herança do pedido** — `id_vendedor` e `id_loja` são sempre copiados do pedido de origem, não podem ser sobrescritos na criação.
2. **Número RMA** — Gerado automaticamente como `RMA-{ANO}-{SEQUENCIAL_6_DIGITOS}` se não fornecido. Deve ser único.
3. **Data de registro** — Sempre a data atual no momento da criação.
4. **Status inicial** — RMA criado com `Registered`; itens criados com `Not Received`.
5. **Soft delete** — `deleted_at` no pedido bloqueia a criação de RMA (pedido inexistente). RMAs também usam soft delete.
6. **Audit trail** — Toda criação, conclusão e alteração de status de item gera entrada em `audit_logs` e `status_history`.
7. **Fechamento** — Só pode ser fechado (`close`) se o status não for `Completed` nem `Cancelled`.

---

## Histórico de Status

Todas as transições (RMA e ItemRma) são registradas na tabela `status_history` com `entity_type = "rma"` ou `"item_rma"`, incluindo `old_status`, `new_status`, usuário e timestamp.
