import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface DashboardQueryParams {
  mes?: number
  ano?: number
  data_inicio?: string
  data_fim?: string
  id_loja?: string
}

export interface DashboardKpis {
  periodo_inicio: string
  periodo_fim: string
  receita: number
  custo: number
  lucro: number
  margem: number
  num_pedidos: number
  num_cancelamentos: number
  valor_cancelamentos: number
  receita_hoje: number
  ticket_venda: number
  ticket_lucro: number
  ticket_custo: number
  imposto_compra: number
  imposto_venda: number
  outros_custos: number
}

export interface DashboardProjections {
  periodo_inicio: string
  periodo_fim: string
  dias_uteis_decorridos: number
  dias_uteis_restantes: number
  media_diaria: number
  projecao_mes: number
  meta_target: number | null
  meta_floor: number | null
  gap_target: number | null
  gap_floor: number | null
  meta_diaria_dinamica: number | null
  pct_meta: number | null
}

export interface BreakdownItem {
  nome: string
  receita: number
  custo: number
  lucro: number
  margem: number
  num_pedidos: number
  num_cancelamentos: number
  valor_cancelamentos: number
  ticket_venda: number
  ticket_custo: number
  ticket_lucro: number
}

export interface SellerBreakdownItem extends BreakdownItem {
  id_vendedor: string
}

export function useDashboardKpis(params: DashboardQueryParams) {
  return useQuery<DashboardKpis>({
    queryKey: ['dashboard', 'kpis', params],
    queryFn: () => apiFetch<DashboardKpis>('/dashboard/kpis', { params: { ...params } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useDashboardProjections(params: DashboardQueryParams) {
  return useQuery<DashboardProjections>({
    queryKey: ['dashboard', 'projections', params],
    queryFn: () => apiFetch<DashboardProjections>('/dashboard/projections', { params: { ...params } }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useDashboardBreakdownByCompany(params: DashboardQueryParams) {
  return useQuery<{ items: BreakdownItem[] }>({
    queryKey: ['dashboard', 'breakdown-company', params],
    queryFn: () => apiFetch('/dashboard/breakdown-by-company', { params: { ...params } }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useDashboardBreakdownBySeller(params: DashboardQueryParams) {
  return useQuery<{ items: SellerBreakdownItem[] }>({
    queryKey: ['dashboard', 'breakdown-seller', params],
    queryFn: () => apiFetch('/dashboard/breakdown-by-seller', { params: { ...params } }),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface ApiGoal {
  id: string
  ano: number
  mes: number
  id_loja: string
  nome_loja: string | null
  target: number
  floor: number | null
}

export function useDashboardGoals() {
  return useQuery<{ items: ApiGoal[] }>({
    queryKey: ['dashboard', 'goals'],
    queryFn: () => apiFetch('/dashboard/goals'),
    staleTime: 60_000,
  })
}

export function useUpsertGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { ano: number; mes: number; id_loja: string; target: number; floor: number | null }) =>
      apiFetch<ApiGoal>('/dashboard/goals', {
        init: { method: 'POST', body: JSON.stringify(data) },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/dashboard/goals/${id}`, { init: { method: 'DELETE' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'goals'] }),
  })
}
