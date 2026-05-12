import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface DashboardKpis {
  total_pedidos: number
  pedidos_pendentes: number
  pedidos_concluidos: number
  faturamento_total: number
  faturamento_mes: number
  ticket_medio: number
  cotacoes_abertas: number
  rmas_abertos: number
}

export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => apiFetch<DashboardKpis>('/dashboard/kpis'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}
