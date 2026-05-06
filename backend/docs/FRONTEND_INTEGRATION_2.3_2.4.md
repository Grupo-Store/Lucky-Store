# Frontend Integration — Phases 2.3 e 2.4

**Documento:** Detalhamento técnico das fases de integração frontend-backend  
**Fases:** 2.3 Modal Integration + 2.4 List View Integration  
**Responsáveis:** Duda (2.3), Peu (2.4 Sales), Gustavo (2.4 Dashboard)  
**Pré-requisito obrigatório:** Phase 2.2 (React Query) concluída por Gustavo  
**Atualizado em:** 6 de maio de 2026

---

## Contexto

O frontend já tem os modais e páginas construídos visualmente (fase 2.1 concluída). O que falta é conectá-los à API real. Hoje os dados são estáticos ou mockados — após essas fases, todas as ações do usuário vão persistir no banco de dados e as listagens vão refletir o estado real do sistema.

---

## Pré-requisito: Phase 2.2 — React Query

Antes de qualquer task de 2.3 ou 2.4 começar, o Gustavo precisa entregar:

- `QueryClientProvider` configurado no root da aplicação
- Hooks de query: `useOrders`, `useQuotes`, `useRma`
- Hooks de mutation: `useCreateOrder`, `useUpdateOrder`, `useCreateQuote`, `useCreateRma`, etc.
- Estratégia de cache definida (stale time, garbage collection time)

Sem esses hooks, 2.3 e 2.4 dependem de implementações ad-hoc que serão reescritas depois — desperdício de esforço.

**Se 2.2 estiver atrasada:** Duda e Peu podem começar criando os hooks localmente na própria branch e refatorar quando o 2.2 mergear.

---

## Versionamento

### Estratégia de branches

```
develop
  └── feature/modal-integration          → Duda (2.3)
  └── feature/list-view-integration      → Peu + Gustavo (2.4)
```

- Cada pessoa trabalha na própria branch criada a partir de `develop`
- PRs abertos para `develop` ao finalizar
- Não fazer PR direto para `main`
- Commits em português, descritivos: `"Conecta OrderModal ao POST /api/pedidos"`

### Ordem de merge recomendada

1. `feature/react-query-setup` (Gustavo — 2.2) → `develop`
2. `feature/modal-integration` (Duda — 2.3) → `develop`
3. `feature/list-view-integration` (Peu + Gustavo — 2.4) → `develop`

2.3 e 2.4 podem ser desenvolvidas em paralelo, mas 2.3 deve mergear antes de 2.4 quando possível, para que as listagens já vejam os dados criados pelos modais em ambiente integrado.

---

## Phase 2.3 — Modal Integration

### Visão geral

Cada modal precisa:
1. Chamar o endpoint correto da API ao submeter o formulário
2. Exibir estado de carregamento durante a requisição
3. Exibir a mensagem de erro da API se falhar
4. Exibir notificação de sucesso e fechar/resetar se der certo
5. Invalidar o cache do React Query para que a lista atualize automaticamente

---

### OrderModal → `POST /api/pedidos`

**O que fazer:**
- Ao submeter o formulário, chamar `useCreateOrder` (mutation do React Query)
- Mapear os campos do formulário para o payload da API:

```json
{
  "id_loja": "uuid",
  "id_vendedor": "uuid",
  "id_cliente": "uuid",
  "data_pedido": "2026-05-06",
  "data_entrega": "2026-05-20",
  "status": "To Buy",
  "valor_venda": "1500.00",
  "observacao": "...",
  "formas_pagamento": [{ "forma": "credito" }]
}
```

**Por que fazer assim:**  
O campo `status` só aceita valores específicos (`To Buy`, `Bought`, `Received`, etc.) — valores em inglês, com capitalização exata. Se o formulário usa labels em português, o mapeamento precisa acontecer antes do envio.

**Como implementar:**

```tsx
const { mutate: createOrder, isPending, isError, error } = useCreateOrder();

const handleSubmit = (formData) => {
  createOrder(mapFormToPayload(formData), {
    onSuccess: () => {
      showSuccessToast("Pedido criado com sucesso");
      onClose();
      resetForm();
    },
    onError: (err) => {
      // err.response.data.detail contém a mensagem da API
    },
  });
};
```

**Loading state:**  
Desabilitar o botão de submit e exibir um spinner enquanto `isPending === true`. Isso evita duplo clique e dupla criação.

**Error state:**  
A API retorna `{ "detail": "mensagem de erro" }` em qualquer erro. Exibir `err.response.data.detail` abaixo do formulário ou em um toast de erro.

**Após sucesso:**  
O React Query precisa invalidar a query de listagem de pedidos. Isso é feito no hook de mutation:

```tsx
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
}
```

---

### QuoteModal → `POST /api/quotes`

**O que fazer:**
- Conectar ao endpoint `POST /api/quotes`
- O payload inclui a lista de `itens` — cada item do formulário precisa ser mapeado para:

```json
{
  "descricao": "string",
  "quantidade": 2,
  "valor_unitario": "1500.00",
  "fornecedor": "Dell Brasil"
}
```

**Atenção:** a lista de itens não pode estar vazia — a API aceita cotação sem itens, mas é boa prática validar no frontend também.

**Por que:** A cotação pode ser convertida em pedido depois (`POST /api/quotes/{id}/convert`). Os itens precisam estar corretos desde a criação para evitar retrabalho.

**Como:** Mesmo padrão do OrderModal. A diferença é que o formulário provavelmente tem um sub-formulário dinâmico para adicionar itens — garantir que cada item seja serializado corretamente antes do envio.

---

### RmaModal → `POST /api/rma`

**O que fazer:**
- Conectar ao endpoint `POST /api/rma`
- O RMA é criado **a partir de um pedido existente** — o `id_pedido_origem` deve vir do pedido selecionado na UI

**Payload obrigatório:**

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

**Restrição importante:** `itens` não pode ser lista vazia — a API retorna `422` se enviado sem itens. Validar no frontend antes de submeter.

**Por que:** O RMA precisa de pelo menos um produto para fazer sentido de negócio — não existe RMA sem item a devolver.

---

### Optimistic Updates

**O que é:** A UI se atualiza imediatamente como se a requisição já tivesse dado certo, antes da resposta da API chegar. Se a API falhar, a UI reverte.

**Por que usar:** Para pedidos e cotações, o usuário não precisa esperar 200–500ms para ver o item aparecer na lista. A experiência parece instantânea.

**Como implementar com React Query:**

```tsx
useMutation({
  mutationFn: createOrder,
  onMutate: async (newOrder) => {
    await queryClient.cancelQueries({ queryKey: ['orders'] });
    const previousOrders = queryClient.getQueryData(['orders']);
    queryClient.setQueryData(['orders'], (old) => [...old, { ...newOrder, id: 'temp' }]);
    return { previousOrders };
  },
  onError: (err, newOrder, context) => {
    queryClient.setQueryData(['orders'], context.previousOrders);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  },
});
```

**Quando NÃO usar:** Para RMA e deleção, onde o risco de reverter a UI confunde o usuário. Nesses casos, aguardar a confirmação da API.

---

### Refetch on success

Após qualquer criação/edição bem-sucedida, invalidar as queries relevantes:

```tsx
queryClient.invalidateQueries({ queryKey: ['orders'] });    // lista de pedidos
queryClient.invalidateQueries({ queryKey: ['quotes'] });    // lista de cotações
queryClient.invalidateQueries({ queryKey: ['rma'] });       // lista de RMAs
```

Isso faz o React Query re-buscar os dados automaticamente, mantendo a lista sincronizada com o banco.

---

## Phase 2.4 — List View Integration

### Visão geral

As páginas de listagem (Sales, Dashboard) precisam:
1. Buscar dados da API ao montar o componente
2. Implementar filtros que disparam nova busca
3. Implementar paginação navegável
4. Implementar ordenação por coluna
5. Exibir skeleton de carregamento enquanto os dados chegam
6. Exibir estado de erro se a API falhar

---

### Sales Page → `GET /api/pedidos`

**Responsável:** Peu

**O que fazer:**
Substituir os dados mockados pelo hook `useOrders` que chama:

```
GET /api/pedidos?page=1&limit=20&status=To Buy&sort_by=data_pedido&sort_dir=desc
```

**Parâmetros disponíveis:**

| Param | Tipo | Uso na UI |
|---|---|---|
| `page` | int | Paginação |
| `limit` | int | Itens por página (fixar em 20) |
| `status` | string | Filtro por status |
| `id_loja` | UUID | Filtro por loja |
| `id_vendedor` | UUID | Filtro por vendedor |
| `data_inicio` | string | Filtro de data inicial |
| `data_fim` | string | Filtro de data final |
| `sort_by` | string | Coluna de ordenação |
| `sort_dir` | `asc`/`desc` | Direção da ordenação |

**Por que implementar filtros no backend e não no frontend:**  
Se filtrar no frontend, todos os pedidos precisam ser carregados de uma vez. Com 500+ pedidos, isso é inviável. Os filtros devem ser parâmetros enviados na query string para que o banco filtre antes de retornar.

**Como implementar:**

```tsx
const [filters, setFilters] = useState({ page: 1, status: '', sort_by: 'data_pedido', sort_dir: 'desc' });

const { data, isLoading, isError } = useOrders(filters);
// data.items → lista de pedidos
// data.total → total de registros
// data.pages → total de páginas
```

Cada mudança de filtro deve resetar `page` para `1`.

**Paginação:**  
A API retorna `{ items, total, page, limit, pages }`. Usar `pages` para saber quantos botões de página renderizar.

**Ordenação:**  
Ao clicar no header de uma coluna, alterar `sort_by` e alternar `sort_dir` entre `asc` e `desc`.

**Loading skeleton:**  
Enquanto `isLoading === true`, exibir linhas de skeleton no lugar das linhas reais da tabela. Evita layout shift e indica carregamento sem bloquear a UI.

**Error state:**  
Se `isError === true`, exibir um banner com botão "Tentar novamente" que chama `refetch()`.

---

### Dashboard → `GET /api/pedidos` + analytics

**Responsável:** Gustavo

**O que fazer:**
O Dashboard exibe KPIs calculados a partir dos pedidos. Por enquanto não há um endpoint de analytics dedicado — os dados precisam ser agregados no frontend a partir da listagem de pedidos, ou calculados com base nos dados disponíveis.

**Estratégia recomendada:**

```
GET /api/pedidos?limit=100&sort_by=data_pedido&sort_dir=desc
```

Buscar os pedidos mais recentes e calcular no frontend:
- Total de pedidos por status
- Valor total em aberto
- Pedidos criados no mês

**Por que essa abordagem:**  
Não existe endpoint de analytics ainda (fase 2.6). Usar os dados já disponíveis evita bloquear o dashboard até a fase 2.6 ser implementada.

**Real-time updates (refetch por intervalo):**

```tsx
const { data } = useOrders({}, {
  refetchInterval: 60_000, // re-busca a cada 60 segundos
  refetchIntervalInBackground: false, // não busca se a aba estiver em background
});
```

**Por que 60 segundos:**  
Equilibra atualização frequente com custo de requisições. Para uma equipe pequena, 1 req/min é suficiente.

**Status history na UI:**  
Para exibir o histórico de status de um pedido, usar o campo `status_history` que já vem na resposta de `GET /api/pedidos/{id}`:

```tsx
const { data: pedido } = useOrder(pedidoId);
// pedido.status_history → array ordenado por changed_at
```

Renderizar como timeline vertical com `old_status → new_status`, data/hora e responsável.

---

## Padrões técnicos comuns

### Tratamento de erros da API

Todos os erros da API têm o formato:
```json
{ "detail": "mensagem descrevendo o erro" }
```

Criar um helper para extrair a mensagem:

```tsx
const getApiError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail ?? "Erro desconhecido";
  }
  return "Erro desconhecido";
};
```

### Tokens JWT

O cliente axios (configurado no 2.1 por Peu) já adiciona o `Authorization: Bearer <token>` automaticamente via interceptor. Não é necessário passar o token manualmente em nenhuma chamada.

Se o token expirar, o interceptor tenta o refresh automaticamente. Se o refresh também falhar, redireciona para `/login`.

### Valores de status

Os status de pedido são em inglês e case-sensitive:

```
"To Buy" | "Bought" | "Received" | "To Invoice" | "Invoiced" |
"To Pack" | "Ready for Delivery" | "Out for Delivery" |
"Delivered" | "Delayed" | "Cancelled"
```

Criar um mapa de tradução para exibição na UI:

```tsx
const STATUS_LABELS: Record<string, string> = {
  "To Buy": "A Comprar",
  "Bought": "Comprado",
  "Received": "Recebido",
  // ...
};
```

---

## Critérios de conclusão

### 2.3 — Modal Integration

- [ ] OrderModal cria pedido via API e aparece na lista
- [ ] QuoteModal cria cotação via API e aparece na lista
- [ ] RmaModal cria RMA via API e aparece na lista
- [ ] Formulários bloqueados durante envio (sem duplo clique)
- [ ] Mensagens de erro da API exibidas ao usuário
- [ ] Notificação de sucesso exibida
- [ ] Lista atualizada automaticamente após criação

### 2.4 — List View Integration

- [ ] Sales page exibe pedidos reais do banco
- [ ] Filtro por status funcional
- [ ] Filtro por data funcional
- [ ] Paginação funcional
- [ ] Ordenação por coluna funcional
- [ ] Skeleton de carregamento exibido
- [ ] Dashboard exibe KPIs calculados dos pedidos reais
- [ ] Dashboard atualiza a cada 60 segundos
- [ ] Histórico de status exibido no detalhe do pedido
