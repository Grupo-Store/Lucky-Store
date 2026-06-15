# Task 2.5.2 — Audit Log Viewer

**Fase:** 2.5 Audit & Compliance  
**Prioridade:** P1 — MVP Feature  
**Responsável frontend:** Gustavo Nogueira  
**Branch:** `feature/audit-log-viewer`  
**Commit:** `caedc9e`

---

## O que é

A task 2.5.2 implementa um visualizador de auditoria no painel administrativo da Lucky Store. O administrador informa o UUID de qualquer pedido e vê uma tabela completa com todas as ações registradas sobre ele: criações, edições e exclusões, com quem fez, quando, e o diff exato dos campos alterados.

---

## Endpoint utilizado

```
GET /api/pedidos/{pedido_id}/history
```

Retorna um objeto com dois arrays:

```json
{
  "order_id": "uuid-do-pedido",
  "status_history": [...],
  "audit_logs": [
    {
      "id": "uuid",
      "entity_type": "pedido",
      "entity_id": "uuid-do-pedido",
      "action": "CREATE" | "UPDATE" | "DELETE",
      "changed_by": "uuid-do-usuario",
      "changed_at": "2026-05-01T14:30:00",
      "old_values": { "status": "To Buy", ... } | null,
      "new_values": { "status": "Bought", ... } | null,
      "ip_address": "127.0.0.1" | null,
      "user_agent": "Mozilla/5.0..." | null
    }
  ]
}
```

O endpoint já estava implementado pelo backend (Rafael) — a task frontend consumiu ele diretamente.

---

## Arquivos criados/modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/hooks/useOrderHistory.ts` | Criado | Hook React Query para buscar o histórico do pedido |
| `src/components/AuditLogTable.tsx` | Criado | Tabela de auditoria com badge de ação e diff de campos |
| `src/pages/Admin.tsx` | Criado | Página `/admin` com input de UUID e renderização da tabela |
| `src/components/AppSidebar.tsx` | Modificado | Adicionado item "Admin" com ícone Settings no sidebar |
| `src/App.tsx` | Modificado | Adicionada rota `<Route path="/admin" element={<Admin />} />` |

---

## Como foi implementado

### 1. Hook — `useOrderHistory.ts`

```ts
export function useOrderHistory(pedidoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['order-history', pedidoId],
    queryFn: () =>
      apiClient.get<OrderHistory>(`/pedidos/${pedidoId}/history`).then(r => r.data),
    enabled: enabled && !!pedidoId,
  })
}
```

Usa **React Query** (`useQuery`) para buscar os dados. O parâmetro `enabled` impede a requisição de ser feita antes do usuário confirmar o ID — evita chamadas desnecessárias enquanto o campo está vazio ou sendo digitado.

O `queryKey: ['order-history', pedidoId]` garante que cada pedido diferente tem seu próprio cache — buscar o pedido A e depois o pedido B não mistura os resultados.

---

### 2. Componente — `AuditLogTable.tsx`

Tem três partes internas:

**`ActionBadge`** — badge colorido conforme o tipo de ação:
- `CREATE` → verde ("Criado")
- `UPDATE` → azul ("Atualizado")
- `DELETE` → vermelho ("Excluído")

**`AuditDiff`** — exibe apenas os campos que mudaram entre `old_values` e `new_values`:

```ts
const allKeys = new Set([
  ...Object.keys(oldValues ?? {}),
  ...Object.keys(newValues ?? {}),
])
const changed = [...allKeys].filter(
  k => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k])
)
```

Une as chaves dos dois objetos e filtra as que são diferentes. Usa `JSON.stringify` para comparar valores aninhados corretamente. Renderiza cada campo mudado como:

```
campo_nome   valor_antigo (tachado, vermelho) → novo_valor (verde)
```

**`AuditLogTable`** (componente principal) — gerencia os três estados do React Query:
- `isLoading` → skeleton animado (4 retângulos pulsando)
- `isError` → mensagem de erro
- dados carregados → tabela com colunas: Ação, Quem, Quando, Alterações

---

### 3. Página — `Admin.tsx`

```ts
const [input, setInput] = useState('')    // o que o usuário está digitando
const [pedidoId, setPedidoId] = useState('') // ID confirmado (dispara a busca)

function handleBuscar() {
  setPedidoId(input.trim())
}
```

Usa dois estados separados para evitar que a busca seja feita a cada tecla digitada. A tabela só é renderizada após o clique em **Buscar** (ou Enter):

```tsx
{pedidoId && <AuditLogTable pedidoId={pedidoId} />}
```

---

## Fluxo completo

```
Admin digita UUID → clica Buscar
  → Admin.tsx atualiza pedidoId
    → AuditLogTable recebe o pedidoId
      → useOrderHistory chama GET /api/pedidos/{id}/history
        → Backend retorna audit_logs[]
          → Tabela renderiza cada log com ActionBadge + AuditDiff
```

---

## Critérios de sucesso

| Critério | Status |
|---|---|
| Audit logs visíveis | ✅ |
| Alterações claramente exibidas | ✅ |
| Diffs formatados (campo a campo) | ✅ |

---

## Como acessar

1. Rodar o backend: `uvicorn main:app --host 0.0.0.0 --port 8000` (dentro de `backend/`)
2. Rodar o frontend: `npm run dev`
3. Fazer login e clicar em **Admin** no sidebar
4. Colar o UUID de um pedido no campo e clicar em **Buscar**
