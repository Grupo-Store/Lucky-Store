# Implementação: React Query Integration (Phase 2.2)

**Data:** 7 de maio de 2026  
**Responsável original no backlog:** Gustavo (queries/cache) + Peu (mutations/error states)  
**Status:** Implementado

---

## O que foi feito

Criação da camada completa de integração com a API usando React Query v5 + Axios. O projeto já tinha o `@tanstack/react-query` instalado e o `QueryClientProvider` no `App.tsx`, mas nenhum hook estava implementado e o `src/api/` estava vazio.

---

## Arquivos criados/modificados

### `src/api/client.ts` — Cliente HTTP (Axios)

**O que é:** Instância centralizada do axios com interceptors configurados.

**Por que foi necessário:** Sem um cliente HTTP centralizado, cada hook precisaria replicar a lógica de autenticação e refresh de token. Com o `apiClient`, isso fica em um único lugar.

**O que faz:**
- Define `baseURL` via variável de ambiente `VITE_API_URL` (fallback: `http://localhost:8000/api`)
- **Interceptor de request:** lê o `access_token` do `localStorage` e injeta o header `Authorization: Bearer <token>` automaticamente em todas as chamadas
- **Interceptor de response:** se receber `401`, tenta renovar o token com `POST /auth/refresh-token`. Se o refresh também falhar (token expirado), limpa o localStorage e recarrega a página (forçando o login)
- **`getApiError(error)`:** helper que extrai o campo `detail` da resposta da API para exibir mensagens de erro legíveis ao usuário

**Como usar:**
```typescript
import { apiClient, getApiError } from '@/api/client';

// Chamada direta (para casos simples fora de hooks)
const { data } = await apiClient.get('/pedidos');

// Extração de erro
catch (err) {
  toast.error(getApiError(err)); // ex: "Pedido OS-001 não encontrado"
}
```

**Nota sobre tokens:** O `AuthStore` atual é mock. Para conectar ao backend real, ao fazer login com sucesso o `access_token` e `refresh_token` precisam ser salvos em `localStorage`:
```typescript
localStorage.setItem('access_token', data.access_token);
localStorage.setItem('refresh_token', data.refresh_token);
```

---

### `src/types/api.ts` — Tipos TypeScript da API

**O que é:** Interfaces TypeScript que espelham exatamente os schemas do backend (Pydantic → TypeScript).

**Por que foi necessário:** O frontend tinha tipos próprios nos stores (ex: `Order` em `OrderStore.tsx`) com campos em inglês e nomes diferentes dos retornados pela API (ex: `os` vs `numero_os`). Criar tipos separados para a API evita confusão e permite que a integração seja feita progressivamente sem quebrar os stores existentes.

**Tipos definidos:**

| Tipo | Descrição |
|---|---|
| `PaginatedResponse<T>` | Wrapper de paginação (`items`, `total`, `page`, `limit`, `pages`) |
| `StatusHistoryEntry` | Entrada do histórico de status |
| `UserResponse` | Dados do usuário retornados pela API |
| `LoginResponse` | Resposta do login com tokens |
| `PedidoResponse` | Pedido completo com itens, custos, formas de pagamento e histórico |
| `CreatePedidoPayload` | Body para criação de pedido |
| `UpdatePedidoPayload` | Body para atualização de pedido (todos opcionais) |
| `PedidoFilters` | Parâmetros de query para listagem |
| `PedidoStatus` | Union type com os 11 status possíveis |
| `CotacaoResponse` | Cotação com itens e fases |
| `CreateCotacaoPayload` | Body para criação de cotação |
| `UpdateCotacaoFasePayload` | Body para atualização de fase |
| `CotacaoFilters` | Parâmetros de query para listagem |
| `ConversaoResponse` | Resposta da conversão cotação → pedido |
| `RmaResponse` | RMA com itens |
| `CreateRmaPayload` | Body para criação de RMA |
| `RmaFilters` | Parâmetros de query para listagem |
| `RmaStatus` | Union type com os 10 status possíveis |
| `ItemRmaStatus` | Union type com os 8 status de item RMA |

---

### `src/api/hooks/useOrders.ts` — Hooks de Pedidos

**Hooks de query (leitura):**

**`useOrders(filters?)`**
- Chama `GET /pedidos` com os filtros como query params
- `staleTime: 30s` — dados de pedidos mudam com frequência, então re-busca após 30 segundos
- Retorna `PaginatedResponse<PedidoResponse>` com `items`, `total`, `page`, `pages`

```typescript
const { data, isLoading, isError } = useOrders({ status: 'To Buy', page: 1, limit: 20 });
// data.items → lista de pedidos
// data.total → total de registros no banco
// data.pages → total de páginas
```

**`useOrder(id)`**
- Chama `GET /pedidos/{id}` incluindo `status_history`
- `enabled: !!id` — não dispara se o id for vazio/undefined
- Usado na tela de detalhe e no histórico de status

**Hooks de mutation (escrita):**

**`useCreateOrder()`**
```typescript
const { mutate, isPending, isError, error } = useCreateOrder();

mutate(payload, {
  onSuccess: () => { toast.success("Pedido criado"); onClose(); },
  onError: (err) => { toast.error(getApiError(err)); },
});
```
- Ao ter sucesso, invalida `orderKeys.lists()` → lista atualiza automaticamente

**`useUpdateOrder(id)`**
- Atualiza o cache do detalhe (`setQueryData`) imediatamente ao ter sucesso, sem aguardar re-fetch
- Invalida a lista para sincronizar

**`useUpdateOrderStatus(id)`**
- Muda o status e passa `reason` opcional
- Mesma estratégia de cache: atualiza detalhe + invalida lista

**`useDeleteOrder()`**
- Recebe o `id` como argumento da mutation (não no hook)
- Invalida a lista após soft-delete

**Query Keys (factory pattern):**
```typescript
orderKeys.all          // ['orders']
orderKeys.lists()      // ['orders', 'list']
orderKeys.list(filters)// ['orders', 'list', { status: 'To Buy', page: 1 }]
orderKeys.detail(id)   // ['orders', 'detail', 'uuid-...']
```
Esse padrão permite invalidações precisas (ex: invalidar só listas sem invalidar detalhes).

---

### `src/api/hooks/useQuotes.ts` — Hooks de Cotações

**Hooks de query:**

**`useQuotes(filters?)`** — `staleTime: 60s` (cotações mudam menos que pedidos)

**`useQuote(id)`** — inclui lista de itens com `valor_total` calculado

**Hooks de mutation:**

**`useCreateQuote()`** — cria cotação com itens opcionais no mesmo payload

**`useUpdateQuote(id)`** — atualiza dados principais (cliente, valor, observação, etc.)

**`useUpdateQuotePhase(id)`** — atualiza fases independentemente:
```typescript
const { mutate } = useUpdateQuotePhase(quoteId);
mutate({ status_enviada: true, data_envio: '2026-05-07' });
```

**`useDeleteQuote()`** — soft-delete

**`useConvertQuote()`** — converte cotação em pedido:
```typescript
const { mutate: convert } = useConvertQuote();
convert(quoteId, {
  onSuccess: ({ id_pedido }) => navigate(`/pedidos/${id_pedido}`),
});
```
Invalida tanto `quoteKeys.lists()` quanto `['orders']` pois cria um novo pedido.

**`useAddQuoteItem(quoteId)`** — adiciona item à cotação existente, atualiza o cache do detalhe

**`useDeleteQuoteItem(quoteId)`** — remove item, invalida o detalhe

---

### `src/api/hooks/useRma.ts` — Hooks de RMA

**Hooks de query:**

**`useRmas(filters?)`** — `staleTime: 60s`

**`useRma(id)`** — inclui lista de itens com status individual

**Hooks de mutation:**

**`useCreateRma()`** — cria RMA:
```typescript
mutate({
  id_pedido_origem: pedidoId,
  prazo_entrega: '2026-06-01',
  itens: [{ id_produto_origem: produtoId, descricao: 'Notebook com tela trincada', quantidade: 1 }],
});
```
⚠️ `itens` não pode ser lista vazia — validar no formulário antes de chamar

**`useCloseRma(id)`** — conclui o RMA (status → `Completed`)

**`useUpdateRmaItemStatus(rmaId)`** — atualiza status de um item:
```typescript
mutate({ itemId, new_status: 'Received', consertado_por: 'Técnico João' });
```

---

### `src/App.tsx` — QueryClient com cache strategy

**O que mudou:** O `QueryClient` passou de configuração vazia para:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // dados frescos por 30s
      gcTime: 5 * 60_000,      // cache mantido 5min após desmontar
      retry: (failureCount, error) => {
        // Não retenta erros 4xx (são erros de negócio, não falhas de rede)
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false;
        return failureCount < 2; // retenta até 2x em erros de rede/5xx
      },
      refetchOnWindowFocus: false, // não re-busca ao voltar para a aba
    },
  },
});
```

**Por que `refetchOnWindowFocus: false`:** O comportamento padrão do React Query re-busca dados ao focar a janela. Para uma plataforma interna com dados que mudam lentamente, isso gera requisições desnecessárias.

**Por que não retenta 4xx:** Erros 400/404/422 são respostas válidas da API (dado não encontrado, validação falhou). Re-tentar não vai mudar o resultado.

---

### `package.json` — axios adicionado

```
axios: ^1.x.x
```

Não havia axios instalado. Necessário para o `client.ts`.

---

## Estrutura final dos arquivos criados

```
src/
├── api/
│   ├── client.ts              # axios instance + interceptors + getApiError
│   └── hooks/
│       ├── useOrders.ts       # useOrders, useOrder, useCreateOrder,
│       │                      # useUpdateOrder, useUpdateOrderStatus, useDeleteOrder
│       ├── useQuotes.ts       # useQuotes, useQuote, useCreateQuote,
│       │                      # useUpdateQuote, useUpdateQuotePhase, useDeleteQuote,
│       │                      # useConvertQuote, useAddQuoteItem, useDeleteQuoteItem
│       └── useRma.ts          # useRmas, useRma, useCreateRma,
│                              # useCloseRma, useUpdateRmaItemStatus
└── types/
    └── api.ts                 # Todos os tipos TypeScript da API
```

---

## Como usar nos modais (próximo passo — fase 2.3)

Exemplo de uso no `OrderModal`:

```typescript
import { useCreateOrder } from '@/api/hooks/useOrders';
import { getApiError } from '@/api/client';
import { toast } from 'sonner';

function OrderModal({ onClose }) {
  const { mutate: createOrder, isPending } = useCreateOrder();

  const onSubmit = (formData) => {
    createOrder(mapFormToApiPayload(formData), {
      onSuccess: () => {
        toast.success('Pedido criado com sucesso');
        onClose();
      },
      onError: (err) => {
        toast.error(getApiError(err));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* campos do formulário */}
      <button disabled={isPending}>
        {isPending ? 'Salvando...' : 'Criar Pedido'}
      </button>
    </form>
  );
}
```

---

## O que ainda precisa ser feito

- [ ] **AuthStore:** substituir o mock por chamadas reais a `POST /auth/login` e `POST /auth/verify-2fa`, salvando os tokens em `localStorage`
- [ ] **OrderModal:** conectar ao `useCreateOrder` (fase 2.3 — Duda)
- [ ] **QuoteModal:** conectar ao `useCreateQuote` (fase 2.3 — Duda)
- [ ] **RmaModal:** conectar ao `useCreateRma` (fase 2.3 — Duda)
- [ ] **Sales page:** substituir dados mockados por `useOrders` com filtros (fase 2.4 — Peu)
- [ ] **Criar `VITE_API_URL`** no `.env` do frontend apontando para o backend em produção (Railway)

---

## Variável de ambiente necessária

Criar arquivo `.env` na raiz do projeto frontend (mesmo nível do `package.json`):

```dotenv
VITE_API_URL=http://localhost:8000/api
```

Para produção (Railway), trocar pela URL real do backend.
