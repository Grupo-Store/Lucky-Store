import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

export interface OrderFilters {
  page: number
  limit: number
  status?: string
  id_loja?: string
  id_vendedor?: string
  data_inicio?: string
  data_fim?: string
  sort_by: string
  sort_dir: 'asc' | 'desc'
}

export interface PedidoListItem {
  id: string
  numero_os: string
  data_pedido: string
  data_entrega: string
  status: string
  is_rma: boolean | null
  is_cancelled: boolean | null
  valor_venda: number | null
  nome_cliente: string | null
  nome_loja: string | null
  nome_vendedor: string | null
}

export interface PedidoListResponse {
  items: PedidoListItem[]
  total: number
  page: number
  limit: number
  pages: number
}

export function useOrdersQuery(filters: OrderFilters) {
  const { data, isLoading, isError, refetch } = useQuery<PedidoListResponse>({
    queryKey: ['pedidos', filters],
    queryFn: () =>
      apiFetch<PedidoListResponse>('/pedidos', {
        params: {
          page: filters.page,
          limit: filters.limit,
          status: filters.status || undefined,
          id_loja: filters.id_loja || undefined,
          id_vendedor: filters.id_vendedor || undefined,
          data_inicio: filters.data_inicio || undefined,
          data_fim: filters.data_fim || undefined,
          sort_by: filters.sort_by,
          sort_dir: filters.sort_dir,
        },
      }),
    staleTime: 30_000,
  })

  return { data, isLoading, isError, refetch }
}
