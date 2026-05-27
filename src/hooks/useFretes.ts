import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { apiFetch } from '@/lib/api'
import { orderKeys } from '@/api/hooks/useOrders'

// ── Query keys ────────────────────────────────────────────────────────────────

export const freteKeys = {
  all: ['fretes'] as const,
  summary: (filters: FreteFilters) => ['fretes', 'summary', filters] as const,
  detail: (entregador: string, filters: FreteFilters) =>
    ['fretes', 'detail', entregador, filters] as const,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FreteFilters {
  id_loja?: string
  data_inicio?: string
  data_fim?: string
}

export interface FreteEntregadorSummary {
  entregador: string
  qtd_entregas: number
  valor_total: string | number
  a_pagar: string | number
}

export interface FretesSummaryResponse {
  total_entregas: number
  entregadores_ativos: number
  valor_total: string | number
  a_pagar: string | number
  por_entregador: FreteEntregadorSummary[]
}

export interface FreteDetalheItem {
  id: string
  id_pedido: string
  numero_os: string
  nome_cliente: string | null
  entregador: string
  data_frete: string
  valor: string | number
  pago: boolean
}

export interface FretesDetailResponse {
  items: FreteDetalheItem[]
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useFretesSummary(filters: FreteFilters) {
  return useQuery<FretesSummaryResponse>({
    queryKey: freteKeys.summary(filters),
    queryFn: () =>
      apiFetch<FretesSummaryResponse>('/fretes/summary', {
        params: {
          id_loja: filters.id_loja,
          data_inicio: filters.data_inicio,
          data_fim: filters.data_fim,
        },
      }),
    staleTime: 30_000,
  })
}

export function useFretesDetail(
  entregador: string,
  filters: FreteFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<FretesDetailResponse>({
    queryKey: freteKeys.detail(entregador, filters),
    queryFn: () =>
      apiFetch<FretesDetailResponse>('/fretes/detail', {
        params: {
          entregador,
          id_loja: filters.id_loja,
          data_inicio: filters.data_inicio,
          data_fim: filters.data_fim,
        },
      }),
    staleTime: 30_000,
    enabled: options?.enabled ?? !!entregador,
  })
}

export function useToggleFretePago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      pedidoId,
      freteId,
      pago,
    }: {
      pedidoId: string
      freteId: string
      pago: boolean
    }) =>
      apiClient
        .patch(`/pedidos/${pedidoId}/fretes/${freteId}/pago`, { pago })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() })
      qc.invalidateQueries({ queryKey: freteKeys.all })
    },
  })
}
