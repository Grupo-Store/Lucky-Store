# Frontend Integration — Phase 2.6

**Documento:** Detalhamento técnico das fases de Dashboard & Financial Management  
**Fase:** 2.6 Dashboard & Financial Management  
**Responsáveis:** Rafael (2.6.1 + 2.6.6 backend), Peu (2.6.3 frontend), Duda (2.6.2 + 2.6.5), Gustavo (2.6.4 + 2.6.6 frontend)  
**Pré-requisito obrigatório:** Phase 2.5 concluída e mergeada na develop  
**Atualizado em:** 20 de maio de 2026

---

## Contexto

O Dashboard atual funciona com dados locais: os stores `OrderStore`, `FinanceStore` e `QuoteStore` fazem todos os cálculos no cliente. Isso significa que cada usuário vê só os dados que ele mesmo carregou na sessão — não há persistência de metas, os cálculos de breakdowns por empresa/vendedor são feitos com filtros no browser, e projeções dependem do estado local.

O objetivo da fase 2.6 é migrar toda essa lógica para o backend:
- **2.6.1** — Backend cria os endpoints de KPIs ricos, breakdowns, metas e projeções
- **2.6.2** — Backend cria os endpoints de despesas e calendário financeiro
- **2.6.3** — Frontend substitui os cálculos locais por React Query apontando para a API
- **2.6.4** — Frontend cria o calendário financeiro visual
- **2.6.5** — Frontend cria o modal de gestão de metas
- **2.6.6** — Backend + Frontend integra a aba Fretes do Financeiro com dados reais da API

O Dashboard já tem a estrutura visual pronta (`src/pages/Dashboard.tsx`). O trabalho é substituir as fontes de dados, não redesenhar a UI.

---

## Estado atual

| Task | Situação |
|------|----------|
| `GET /api/dashboard/kpis` (básico) | ✅ Pronto — retorna contadores simples |
| KPI cards no frontend | ✅ Pronto — mas usa dados locais para a maioria |
| Filtros de mês/empresa/vendedor | ✅ Pronto no frontend — não conectado à API |
| Metas (Goals) | ⚠️ Existe no `FinanceStore` — não persistido no banco |
| Projeções | ⚠️ Calculadas no frontend com `remainingBusinessDays` |
| Breakdowns por empresa/vendedor | ⚠️ Calculados localmente com `useOrders` |
| Despesas (`FinanceStore`) | ⚠️ Só em memória — não persistidas |
| Calendário financeiro | ❌ Não implementado |

---

## Versionamento

### Estratégia de branches

```
develop
  └── feature/dashboard-backend-apis    → Rafael (2.6.1)
  └── feature/financial-backend         → Duda   (2.6.2)
  └── feature/dashboard-frontend        → Peu    (2.6.3)
  └── feature/financial-calendar        → Gustavo (2.6.4)
  └── feature/goal-management-ui        → Duda   (2.6.5)
```

- Branches criadas a partir de `develop` após o merge de `feat/criando-logica-delete`
- **2.6.1 deve ser mergeado antes de 2.6.3** — o frontend depende dos novos endpoints
- **2.6.2 deve ser mergeado antes de 2.6.4** — o calendário depende das rotas de despesas
- 2.6.5 pode ser desenvolvido em paralelo com 2.6.3 desde que o endpoint de goals (2.6.1) esteja pronto

### Ordem de merge recomendada

```
1. feature/dashboard-backend-apis  (Rafael) → develop
2. feature/financial-backend       (Duda)   → develop
3. feature/dashboard-frontend      (Peu)    → develop   [depende de 1]
4. feature/goal-management-ui      (Duda)   → develop   [depende de 1]
5. feature/financial-calendar      (Gustavo)→ develop   [depende de 2]
```

---

## Phase 2.6.1 — Dashboard Backend APIs

**Responsável:** Rafael  
**Branch:** `feature/dashboard-backend-apis`

### Contexto

O endpoint `GET /api/dashboard/kpis` já existe mas retorna apenas contadores simples (total_pedidos, ticket_medio, etc.). Precisa ser estendido com:
1. KPIs financeiros ricos (receita, custo, lucro, margem por período)
2. Breakdowns por empresa e por vendedor
3. CRUD de metas (Goals)
4. Cálculo de projeções baseado em dias úteis

### Endpoints a implementar

#### 1. `GET /api/dashboard/kpis` — estender o existente

Adicionar parâmetros de query:

| Parâmetro | Tipo | Default | Descrição |
|---|---|---|---|
| `mes` | int (1-12) | mês atual | Mês de referência |
| `ano` | int | ano atual | Ano de referência |
| `data_inicio` | date (YYYY-MM-DD) | — | Início do range customizado |
| `data_fim` | date (YYYY-MM-DD) | — | Fim do range customizado |
| `id_loja` | UUID | — | Filtrar por loja |

Resposta esperada (substituir a atual):

```json
{
  "periodo": { "inicio": "2026-05-01", "fim": "2026-05-31" },
  "receita": 125000.00,
  "custo": 87500.00,
  "lucro": 37500.00,
  "margem": 0.30,
  "num_pedidos": 42,
  "num_cancelamentos": 3,
  "valor_cancelamentos": 4500.00,
  "receita_hoje": 3200.00,
  "ticket_venda": 2976.19,
  "ticket_lucro": 892.86,
  "ticket_custo": 2083.33,
  "imposto_compra": 8750.00,
  "imposto_venda": 5625.00,
  "outros_custos": 73125.00
}
```

#### 2. `GET /api/dashboard/breakdown-by-company`

Mesmos parâmetros de filtro que `/kpis`. Retorna os mesmos campos por empresa:

```json
{
  "items": [
    {
      "empresa": "Lucky Store",
      "receita": 75000.00,
      "custo": 52500.00,
      "lucro": 22500.00,
      "margem": 0.30,
      "num_pedidos": 25
    },
    {
      "empresa": "BTech",
      "receita": 50000.00,
      ...
    }
  ]
}
```

O campo `empresa` corresponde ao nome da loja (`lojas.nome`).

#### 3. `GET /api/dashboard/breakdown-by-seller`

Mesmos parâmetros. Retorna por vendedor:

```json
{
  "items": [
    {
      "id_vendedor": "uuid",
      "nome_vendedor": "Carlos",
      "receita": 45000.00,
      "lucro": 13500.00,
      "margem": 0.30,
      "num_pedidos": 15
    }
  ]
}
```

#### 4. `GET /api/dashboard/goals`

```
GET /api/dashboard/goals?ano=2026&mes=5&id_loja=<uuid>
```

```json
{
  "items": [
    {
      "id": "uuid",
      "ano": 2026,
      "mes": 5,
      "id_loja": "uuid",
      "nome_loja": "Lucky Store",
      "target": 150000.00,
      "floor": 120000.00
    }
  ]
}
```

#### 5. `POST /api/dashboard/goals`

```json
{
  "ano": 2026,
  "mes": 5,
  "id_loja": "uuid",
  "target": 150000.00,
  "floor": 120000.00
}
```

Upsert: se já existe meta para ano+mes+id_loja, atualiza. Se não existe, cria.

#### 6. `DELETE /api/dashboard/goals/{goal_id}`

Deleta a meta. Retorna `204 No Content`.

#### 7. `GET /api/dashboard/projections`

Mesmos parâmetros de filtro. Busca a meta do período e calcula:

```json
{
  "dias_uteis_decorridos": 12,
  "dias_uteis_restantes": 9,
  "media_diaria": 10416.67,
  "projecao_mes": 218750.00,
  "meta_target": 150000.00,
  "meta_floor": 120000.00,
  "gap_target": 24999.96,
  "gap_floor": 0,
  "meta_diaria_dinamica": 2777.78,
  "pct_meta": 0.833
}
```

**Como calcular dias úteis:** usar a lib `workalendar` (Python) com `Brazil` para excluir feriados nacionais:

```python
from workalendar.america import Brazil

cal = Brazil()
# dias úteis de 1 a hoje no mês
dias_decorridos = len([
    d for d in cal.get_working_days_delta(inicio_mes, hoje)
])
# dias úteis de amanhã até fim do mês
dias_restantes = len([
    d for d in cal.get_working_days_delta(amanha, fim_mes)
])
```

### Como implementar

Criar `backend/app/api/routes/dashboard.py` e `backend/app/services/dashboard.py`. Não misturar lógica de negócio na rota — toda query fica no service.

O service faz queries diretamente nas tabelas `pedidos`, `lojas`, `vendedores` e `custo_pedido` usando SQLAlchemy com `func.sum`, `func.count` e `GROUP BY`:

```python
from sqlalchemy import func

def get_kpis(db: Session, inicio: date, fim: date, id_loja: UUID = None):
    q = db.query(
        func.sum(Pedido.valor_venda).label("receita"),
        func.count(Pedido.id).label("num_pedidos"),
    ).filter(
        Pedido.deleted_at.is_(None),
        Pedido.is_cancelled == False,
        Pedido.data_pedido >= inicio,
        Pedido.data_pedido <= fim,
    )
    if id_loja:
        q = q.filter(Pedido.id_loja == id_loja)
    return q.first()
```

O modelo `DashboardGoal` precisa de uma migration:

```sql
CREATE TABLE dashboard_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano INT NOT NULL,
    mes INT NOT NULL,
    id_loja UUID NOT NULL REFERENCES lojas(id),
    target DECIMAL(14, 2) NOT NULL,
    floor DECIMAL(14, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ano, mes, id_loja)
);
```

### Por que implementar no backend

Atualmente as metas vivem apenas no `FinanceStore` (memória do browser). Isso significa que:
- Cada usuário tem metas diferentes
- Ao fechar o browser, as metas somem
- Não é possível que um gerente defina meta e um vendedor acompanhe no mesmo sistema

Mover para o banco resolve todos esses problemas.

---

## Phase 2.6.2 — Financial Management Backend

**Responsável:** Duda  
**Branch:** `feature/financial-backend`

### Contexto

O sistema já registra `multa`, `juros` e `data_pagamento` em pedidos. O que falta é um modelo de **despesas operacionais** (aluguel, salários, boletos) e um **endpoint de calendário** que agregue todos os eventos financeiros do mês em uma estrutura navegável por data.

### Endpoints a implementar

#### 1. `POST /api/expenses`

```json
{
  "descricao": "Aluguel maio",
  "valor": 5000.00,
  "data_prevista": "2026-05-10",
  "data_paga": null,
  "recorrente": true,
  "id_loja": "uuid",
  "parcelas": null
}
```

Resposta: objeto `ExpenseResponse` com `id` gerado.

#### 2. `GET /api/expenses`

Parâmetros: `id_loja`, `data_inicio`, `data_fim`, `page`, `limit`.

#### 3. `PATCH /api/expenses/{id}`

Permite atualizar `data_paga` (marcar como pago), `valor`, `descricao`.

#### 4. `DELETE /api/expenses/{id}`

Soft-delete (`deleted_at`).

#### 5. `GET /api/calendar/entries`

Agrega todos os eventos financeiros de um período e retorna indexado por data:

```
GET /api/calendar/entries?ano=2026&mes=5&id_loja=<uuid>
```

```json
{
  "2026-05-10": [
    {
      "tipo": "expense",
      "descricao": "Aluguel maio",
      "valor": 5000.00,
      "pago": false
    }
  ],
  "2026-05-15": [
    {
      "tipo": "multa",
      "id_pedido": "uuid",
      "numero_os": "OS-042",
      "valor": 150.00
    },
    {
      "tipo": "parcela",
      "id_pedido": "uuid",
      "numero_os": "OS-035",
      "numero_parcela": 2,
      "total_parcelas": 6,
      "valor": 833.33
    }
  ]
}
```

**Tipos de entrada:**
- `expense` — despesa operacional (tabela `expenses`)
- `multa` — multa de pedido (`pedidos.multa` onde `data_pagamento` está no mês)
- `juros` — juros de pedido (`pedidos.juros`)
- `parcela` — parcela de `plano_parcelas` do pedido (campo JSONB)

### Modelo `Expense`

```python
class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    id_loja = Column(UUID(as_uuid=True), ForeignKey("lojas.id"), nullable=False)
    descricao = Column(String(255), nullable=False)
    valor = Column(DECIMAL(12, 2), nullable=False)
    data_prevista = Column(Date, nullable=False)
    data_paga = Column(Date, nullable=True)
    recorrente = Column(Boolean, default=False)
    parcelas = Column(Integer, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True), nullable=True)
```

### Por que implementar

O `FinanceStore` atual armazena despesas em memória — fechou o browser, perdeu tudo. Para o Calendário Financeiro (2.6.4) funcionar, os dados precisam ser persistentes e visíveis para todos os usuários da mesma loja.

---

## Phase 2.6.3 — Dashboard Frontend Components

**Responsável:** Peu  
**Branch:** `feature/dashboard-frontend`  
**Depende de:** `feature/dashboard-backend-apis` mergeado

### Contexto

O `Dashboard.tsx` já tem toda a estrutura visual funcional: KPI cards, gráficos de pizza e barra, tabelas de breakdown e filtros. O trabalho é substituir as fontes de dados locais pelos hooks de React Query que chamam os novos endpoints.

### Novos hooks a criar em `src/api/hooks/useDashboard.ts`

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: (filters: DashboardFilters) => [...dashboardKeys.all, 'kpis', filters] as const,
  breakdownCompany: (filters: DashboardFilters) =>
    [...dashboardKeys.all, 'breakdown-company', filters] as const,
  breakdownSeller: (filters: DashboardFilters) =>
    [...dashboardKeys.all, 'breakdown-seller', filters] as const,
  projections: (filters: DashboardFilters) =>
    [...dashboardKeys.all, 'projections', filters] as const,
  goals: (filters: GoalFilters) => [...dashboardKeys.all, 'goals', filters] as const,
};

export interface DashboardFilters {
  mes?: number;
  ano?: number;
  data_inicio?: string;
  data_fim?: string;
  id_loja?: string;
}

export function useDashboardKpis(filters: DashboardFilters) {
  return useQuery({
    queryKey: dashboardKeys.kpis(filters),
    queryFn: () => apiClient.get('/dashboard/kpis', { params: filters }).then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDashboardBreakdownByCompany(filters: DashboardFilters) {
  return useQuery({
    queryKey: dashboardKeys.breakdownCompany(filters),
    queryFn: () =>
      apiClient.get('/dashboard/breakdown-by-company', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDashboardBreakdownBySeller(filters: DashboardFilters) {
  return useQuery({
    queryKey: dashboardKeys.breakdownSeller(filters),
    queryFn: () =>
      apiClient.get('/dashboard/breakdown-by-seller', { params: filters }).then(r => r.data),
    staleTime: 30_000,
  });
}

export function useDashboardProjections(filters: DashboardFilters) {
  return useQuery({
    queryKey: dashboardKeys.projections(filters),
    queryFn: () =>
      apiClient.get('/dashboard/projections', { params: filters }).then(r => r.data),
    staleTime: 60_000,
  });
}
```

### Como migrar o Dashboard.tsx

A função `computeStats` atualmente faz tudo no cliente. Após a integração, ela deixa de existir — os dados vêm diretamente dos hooks:

**Antes (local):**
```tsx
const filtered = applyFilters(orders, filterCriteria);
const stats = computeStats(filtered, orders, filterCriteria, goal);
// stats.revenue, stats.profit, stats.margin...
```

**Depois (API):**
```tsx
const { data: kpis } = useDashboardKpis(apiFilters);
const { data: projections } = useDashboardProjections(apiFilters);
// kpis.receita, kpis.lucro, projections.pct_meta...
```

O `apiFilters` é derivado do estado de filtro atual do `DashboardFilterStore`:

```tsx
const { mes, ano, rangeFrom, rangeTo, company } = useDashboardFilters();

const apiFilters: DashboardFilters = useMemo(() => ({
  mes: rangeFrom ? undefined : mes + 1,
  ano: rangeFrom ? undefined : ano,
  data_inicio: rangeFrom ? format(rangeFrom, 'yyyy-MM-dd') : undefined,
  data_fim: rangeTo ? format(rangeTo, 'yyyy-MM-dd') : undefined,
  id_loja: company !== 'all' ? LOJA_IDS[company] : undefined,
}), [mes, ano, rangeFrom, rangeTo, company]);
```

### Skeleton de carregamento

Enquanto os dados carregam, exibir skeletons nos cards:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Dentro do KPI card:
{isLoading ? (
  <Skeleton className="h-8 w-32" />
) : (
  <span className="text-2xl font-bold">{BRL(kpis.receita)}</span>
)}
```

### Por que migrar do store local para a API

Com dados locais, o Dashboard mostra apenas os pedidos carregados na sessão atual (paginados). Um gerente que quer ver o resumo mensal precisaria carregar todos os pedidos do mês na listagem primeiro. Com a API, os KPIs são calculados diretamente no banco sobre todos os registros, sem depender de paginação.

---

## Phase 2.6.4 — Financial Calendar

**Responsável:** Gustavo  
**Branch:** `feature/financial-calendar`  
**Depende de:** `feature/financial-backend` mergeado

### Contexto

O `FinanceStore` já tem a lógica de calendário financeiro (despesas, parcelas, multas), mas os dados vivem em memória. Com o endpoint `GET /api/calendar/entries` pronto, o frontend só precisa consumir e renderizar.

### Hook a criar em `src/api/hooks/useCalendar.ts`

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useCalendarEntries(ano: number, mes: number, idLoja?: string) {
  return useQuery({
    queryKey: ['calendar', 'entries', { ano, mes, idLoja }],
    queryFn: () =>
      apiClient
        .get('/calendar/entries', { params: { ano, mes, id_loja: idLoja } })
        .then(r => r.data),
    staleTime: 60_000,
    enabled: !!ano && !!mes,
  });
}
```

### Estrutura do componente

Criar `src/pages/FinancialCalendar.tsx`:

```tsx
function FinancialCalendar() {
  const [mes, setMes] = useState(getMonth(new Date()) + 1);
  const [ano, setAno] = useState(getYear(new Date()));
  const { data: entries, isLoading } = useCalendarEntries(ano, mes);

  const diasDoMes = eachDayOfInterval({
    start: startOfMonth(new Date(ano, mes - 1)),
    end: endOfMonth(new Date(ano, mes - 1)),
  });

  return (
    <div className="p-6 space-y-4">
      <MonthSelector mes={mes} ano={ano} onChange={...} />
      <div className="grid grid-cols-7 gap-1">
        {diasDoMes.map(dia => {
          const key = format(dia, 'yyyy-MM-dd');
          const eventos = entries?.[key] ?? [];
          return (
            <CalendarDay key={key} dia={dia} eventos={eventos} />
          );
        })}
      </div>
    </div>
  );
}
```

### Cores por tipo de evento

| Tipo | Cor |
|------|-----|
| `expense` pago | `bg-green-100 text-green-800` |
| `expense` pendente | `bg-red-100 text-red-700` |
| `multa` | `bg-orange-100 text-orange-700` |
| `juros` | `bg-yellow-100 text-yellow-700` |
| `parcela` | `bg-blue-100 text-blue-700` |

### Adicionar ao sidebar e roteamento

Em `AppSidebar.tsx`, adicionar entrada:
```tsx
{ title: 'Calendário', url: '/calendar', icon: CalendarDays }
```

Em `App.tsx`, adicionar rota:
```tsx
<Route path="/calendar" element={<FinancialCalendar />} />
```

### Por que implementar

O time hoje não tem visibilidade de quando desembolsos acontecerão. O calendário financeiro centraliza em uma view: quando vence uma parcela de cliente, quando cai uma multa, quando pagar um boleto de fornecedor — tudo no mesmo lugar, por data.

---

## Phase 2.6.5 — Goal Management UI

**Responsável:** Duda  
**Branch:** `feature/goal-management-ui`  
**Depende de:** `feature/dashboard-backend-apis` mergeado (endpoints de goals)

### Contexto

O `FinanceStore` tem um sistema de metas (`Goal`) que funciona apenas em memória. Com os endpoints de 2.6.1 prontos, o frontend precisa de um modal para criar, visualizar e deletar metas persistidas no banco.

### Hook a criar em `src/api/hooks/useDashboard.ts` (adicionar ao arquivo de 2.6.3)

```tsx
export interface GoalFilters { ano?: number; mes?: number; id_loja?: string; }
export interface GoalPayload { ano: number; mes: number; id_loja: string; target: number; floor?: number; }

export function useGoals(filters: GoalFilters) {
  return useQuery({
    queryKey: dashboardKeys.goals(filters),
    queryFn: () =>
      apiClient.get('/dashboard/goals', { params: filters }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useUpsertGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GoalPayload) =>
      apiClient.post('/dashboard/goals', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) =>
      apiClient.delete(`/dashboard/goals/${goalId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKeys.all }),
  });
}
```

### Estrutura do modal

O botão de metas já existe no Dashboard (ícone `Target`). Conectar ao novo modal:

```tsx
function GoalModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: goals } = useGoals({ ano: currentYear, mes: currentMonth });
  const { mutate: upsert, isPending } = useUpsertGoal();
  const { mutate: deleteGoal } = useDeleteGoal();

  // Formulário com campos: id_loja (select), target (R$), floor (R$)
  // Tabela listando metas existentes com botão de deleção
}
```

### Por que implementar

O fluxo atual exige que cada usuário recrie as metas a cada sessão. Com o backend, o gerente define a meta uma vez e todos os vendedores da loja veem o mesmo número no Dashboard — inclusive o card de % de atingimento e a meta diária dinâmica.

---

## Padrões técnicos comuns

### Formatação de valores

```tsx
const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
```

Esses helpers já existem no `Dashboard.tsx` — reutilizar, não duplicar.

### Skeleton padrão durante carregamento

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Card de KPI com skeleton:
<Card>
  <CardHeader><CardTitle className="text-sm">Receita</CardTitle></CardHeader>
  <CardContent>
    {isLoading
      ? <Skeleton className="h-8 w-28" />
      : <span className="text-2xl font-bold">{BRL(kpis.receita)}</span>
    }
  </CardContent>
</Card>
```

### Tratamento de erros

```tsx
import { getApiError } from '@/api/client';

onError: (err) => toast.error(getApiError(err)),
```

### Autenticação

O `apiClient` envia o token automaticamente. Nenhuma das rotas do dashboard exige lógica extra de auth no frontend.

---

## Phase 2.6.6 — Fretes Integration

**Responsável:** Rafael (backend) + Gustavo (frontend)  
**Branch backend:** `feature/fretes-backend`  
**Branch frontend:** `feature/fretes-frontend`  
**Depende de:** nenhuma dependência de 2.6.1–2.6.5

### Contexto

A aba **Fretes** em `src/components/finance/FinancialManager.tsx` (linhas 498–643) já tem UI completa:
- Cards de KPI: total de entregas, entregadores ativos, valor total
- Tabela agregada por entregador (qtd + valor)
- Modal de detalhes por entregador com link para o pedido

O problema: dados vêm do `OrderStore` local (`useOrders()`), que só contém os pedidos carregados na sessão (paginados). Um relatório de fretes do mês inteiro fica incompleto se o usuário não tiver carregado todos os pedidos.

A tabela `fretes` já existe no banco com FK para `pedidos`. O trabalho é criar endpoints dedicados e trocar a fonte de dados no frontend.

### Endpoints a criar

#### `GET /api/fretes/summary`

Parâmetros: `id_loja` (obrigatório), `data_inicio`, `data_fim`

```json
{
  "total_entregas": 35,
  "entregadores_ativos": 3,
  "valor_total": 5250.00,
  "items": [
    { "entregador": "João", "qtd_entregas": 12, "valor_total": 1800.00 },
    { "entregador": "Maria", "qtd_entregas": 23, "valor_total": 3450.00 }
  ]
}
```

#### `GET /api/fretes/detail`

Parâmetros: `id_loja`, `data_inicio`, `data_fim`, `entregador`

```json
{
  "items": [
    {
      "id": "uuid",
      "id_pedido": "uuid",
      "numero_os": "OS-042",
      "nome_cliente": "Empresa ABC",
      "entregador": "João",
      "data_frete": "2026-05-10",
      "valor": 150.00
    }
  ]
}
```

### Implementação do service (backend)

```python
# backend/app/services/fretes.py
from sqlalchemy import func
from app.models.pedido import Pedido, Frete
from app.models.cliente import Cliente

def get_summary(db, id_loja, data_inicio, data_fim):
    q = (
        db.query(
            Frete.entregador,
            func.count(Frete.id).label("qtd_entregas"),
            func.sum(Frete.valor).label("valor_total"),
        )
        .join(Pedido, Frete.id_pedido == Pedido.id)
        .filter(
            Pedido.id_loja == id_loja,
            Pedido.deleted_at.is_(None),
            Frete.data_frete >= data_inicio,
            Frete.data_frete <= data_fim,
        )
        .group_by(Frete.entregador)
        .order_by(func.sum(Frete.valor).desc())
        .all()
    )
    ...

def get_detail(db, id_loja, data_inicio, data_fim, entregador):
    q = (
        db.query(Frete, Pedido)
        .join(Pedido, Frete.id_pedido == Pedido.id)
        .filter(
            Pedido.id_loja == id_loja,
            Pedido.deleted_at.is_(None),
            Frete.entregador == entregador,
            Frete.data_frete >= data_inicio,
            Frete.data_frete <= data_fim,
        )
        .order_by(Frete.data_frete.desc())
        .all()
    )
    ...
```

### Hooks do frontend

```tsx
// src/api/hooks/useFretes.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export function useFretesSummary(idLoja?: string, dataInicio?: string, dataFim?: string) {
  return useQuery({
    queryKey: ['fretes', 'summary', { idLoja, dataInicio, dataFim }],
    queryFn: () =>
      apiClient
        .get('/fretes/summary', { params: { id_loja: idLoja, data_inicio: dataInicio, data_fim: dataFim } })
        .then(r => r.data),
    enabled: !!idLoja,
    staleTime: 60_000,
  });
}

export function useFretesDetail(idLoja?: string, dataInicio?: string, dataFim?: string, entregador?: string) {
  return useQuery({
    queryKey: ['fretes', 'detail', { idLoja, dataInicio, dataFim, entregador }],
    queryFn: () =>
      apiClient
        .get('/fretes/detail', { params: { id_loja: idLoja, data_inicio: dataInicio, data_fim: dataFim, entregador } })
        .then(r => r.data),
    enabled: !!idLoja && !!entregador,
    staleTime: 60_000,
  });
}
```

### Ajuste no FinancialManager.tsx

Trocar a derivação local:

```tsx
// Antes (local — só vê pedidos paginados da sessão)
const freightRows = orders.flatMap(o =>
  (o.freight ?? []).map(c => ({ ...c, orderId: o.id, os: o.numero_os, customer: o.nome_cliente }))
);

// Depois (API — todos os fretes do período)
const { data: summary, isLoading } = useFretesSummary(idLoja, dataInicio, dataFim);
const { data: detail } = useFretesDetail(idLoja, dataInicio, dataFim, freightDetail.person);
```

---

## Critérios de conclusão

### 2.6.1 — Dashboard Backend APIs

- [ ] `GET /api/dashboard/kpis` retorna campos financeiros ricos (receita, custo, lucro, margem)
- [ ] Parâmetros `mes`, `ano`, `data_inicio`, `data_fim`, `id_loja` funcionando
- [ ] `GET /api/dashboard/breakdown-by-company` retorna breakdown por loja
- [ ] `GET /api/dashboard/breakdown-by-seller` retorna breakdown por vendedor
- [ ] `GET /api/dashboard/goals` retorna metas com filtro por mês/loja
- [ ] `POST /api/dashboard/goals` faz upsert (cria ou atualiza)
- [ ] `DELETE /api/dashboard/goals/{id}` deleta meta
- [ ] `GET /api/dashboard/projections` calcula dias úteis e projeção mensal
- [ ] Migration da tabela `dashboard_goals` criada e aplicada
- [ ] Testes unitários cobrindo os services

### 2.6.2 — Financial Management Backend

- [ ] Model `Expense` e migration criados
- [ ] `POST /api/expenses` cria despesa
- [ ] `GET /api/expenses` lista com filtros
- [ ] `PATCH /api/expenses/{id}` atualiza (incluindo marcar como pago)
- [ ] `DELETE /api/expenses/{id}` soft-delete
- [ ] `GET /api/calendar/entries` agrega despesas + multas + juros + parcelas por data

### 2.6.3 — Dashboard Frontend Components

- [ ] `useDashboard.ts` criado com todos os hooks
- [ ] `Dashboard.tsx` usa `useDashboardKpis` em vez de `computeStats` local
- [ ] Breakdowns de empresa e vendedor vindos da API
- [ ] Projeções vindas da API (sem `remainingBusinessDays` no cliente)
- [ ] Skeletons exibidos durante carregamento
- [ ] Filtros de mês/empresa/range conectados aos params da API

### 2.6.4 — Financial Calendar

- [ ] Hook `useCalendarEntries` criado
- [ ] Página `FinancialCalendar.tsx` renderiza grid mensal
- [ ] Eventos coloridos por tipo (expense, multa, juros, parcela)
- [ ] Navegação entre meses funcionando
- [ ] Rota `/calendar` e entrada no sidebar adicionadas

### 2.6.5 — Goal Management UI

- [ ] Hooks `useGoals`, `useUpsertGoal`, `useDeleteGoal` criados
- [ ] Modal de metas conectado ao backend (não mais ao `FinanceStore`)
- [ ] Formulário de criação de meta (loja, target, floor)
- [ ] Listagem de metas existentes com deleção
- [ ] Invalidação de cache após upsert/delete atualiza KPIs e projeções

### 2.6.6 — Fretes Integration

**Backend (`feature/fretes-backend` → Rafael)**
- [ ] `GET /api/fretes/summary?id_loja=&data_inicio=&data_fim=` — agrega fretes por entregador
- [ ] `GET /api/fretes/detail?id_loja=&data_inicio=&data_fim=&entregador=` — lista fretes individuais de um entregador
- [ ] Service com queries SQLAlchemy nas tabelas `fretes` e `pedidos` (JOIN para número OS e cliente)
- [ ] Testes unitários para o service

**Frontend (`feature/fretes-frontend` → Gustavo)**
- [ ] Hook `useFretesSummary(idLoja, dataInicio, dataFim)` em `src/api/hooks/useFretes.ts`
- [ ] Hook `useFretesDetail(idLoja, dataInicio, dataFim, entregador)` no mesmo arquivo
- [ ] Substituir derivação local em `FinancialManager.tsx` (`.flatMap(o => o.freight)`) pelos hooks
- [ ] Skeletons durante carregamento nos cards e na tabela agregada
- [ ] Filtros de período existentes conectados aos params dos hooks
