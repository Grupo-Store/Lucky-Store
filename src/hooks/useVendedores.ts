import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { apiFetch } from '@/lib/api'

export interface VendedorItem {
  id: string
  nome: string
  email: string | null
  phone: string | null
  id_loja: string
}

export interface VendedoresResponse {
  items: VendedorItem[]
}

export interface CreateVendedorPayload {
  nome: string
  email?: string | null
  id_loja: string
}

export const vendedorKeys = {
  all: ['vendedores'] as const,
  list: () => ['vendedores', 'list'] as const,
}

export function useVendedores() {
  return useQuery<VendedoresResponse>({
    queryKey: vendedorKeys.list(),
    queryFn: () => apiFetch<VendedoresResponse>('/vendedores'),
    staleTime: 60_000,
  })
}

export function useCreateVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateVendedorPayload) =>
      apiClient.post('/vendedores', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vendedorKeys.all })
    },
  })
}
