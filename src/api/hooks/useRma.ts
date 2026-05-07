import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  RmaResponse,
  PaginatedResponse,
  CreateRmaPayload,
  RmaFilters,
  ItemRmaStatus,
} from '../../types/api';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const rmaKeys = {
  all: ['rma'] as const,
  lists: () => [...rmaKeys.all, 'list'] as const,
  list: (filters: RmaFilters) => [...rmaKeys.lists(), filters] as const,
  details: () => [...rmaKeys.all, 'detail'] as const,
  detail: (id: string) => [...rmaKeys.details(), id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Lista RMAs com filtros e paginação. */
export function useRmas(filters: RmaFilters = {}) {
  return useQuery<PaginatedResponse<RmaResponse>>({
    queryKey: rmaKeys.list(filters),
    queryFn: () =>
      apiClient.get('/rma', { params: filters }).then((r) => r.data),
    staleTime: 60_000,
  });
}

/** Retorna um RMA específico com seus itens. */
export function useRma(id: string) {
  return useQuery<RmaResponse>({
    queryKey: rmaKeys.detail(id),
    queryFn: () => apiClient.get(`/rma/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Cria um novo RMA a partir de um pedido existente. Itens não pode ser lista vazia. */
export function useCreateRma() {
  const qc = useQueryClient();
  return useMutation<RmaResponse, Error, CreateRmaPayload>({
    mutationFn: (payload) =>
      apiClient.post('/rma', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rmaKeys.lists() });
    },
  });
}

/** Conclui o RMA (status → Completed). */
export function useCloseRma(id: string) {
  const qc = useQueryClient();
  return useMutation<RmaResponse, Error, void>({
    mutationFn: () =>
      apiClient.patch(`/rma/${id}/close`).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(rmaKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: rmaKeys.lists() });
    },
  });
}

/** Atualiza o status de um item do RMA. */
export function useUpdateRmaItemStatus(rmaId: string) {
  const qc = useQueryClient();
  return useMutation<
    RmaResponse,
    Error,
    { itemId: string; new_status: ItemRmaStatus; consertado_por?: string }
  >({
    mutationFn: ({ itemId, new_status, consertado_por }) =>
      apiClient
        .patch(`/rma/${rmaId}/items/${itemId}/status`, {
          new_status,
          consertado_por,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(rmaKeys.detail(rmaId), data);
      qc.invalidateQueries({ queryKey: rmaKeys.lists() });
    },
  });
}
