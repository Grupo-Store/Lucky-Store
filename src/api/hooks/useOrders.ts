import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  PedidoResponse,
  PaginatedResponse,
  CreatePedidoPayload,
  UpdatePedidoPayload,
  PedidoFilters,
  PedidoStatus,
} from '../../types/api';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: PedidoFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Lista pedidos com filtros e paginação. */
export function useOrders(filters: PedidoFilters = {}) {
  return useQuery<PaginatedResponse<PedidoResponse>>({
    queryKey: orderKeys.list(filters),
    queryFn: () =>
      apiClient.get('/pedidos', { params: filters }).then((r) => r.data),
    staleTime: 30_000,
  });
}

/** Retorna um pedido específico com histórico de status. */
export function useOrder(id: string) {
  return useQuery<PedidoResponse>({
    queryKey: orderKeys.detail(id),
    queryFn: () => apiClient.get(`/pedidos/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Cria um novo pedido. Invalida a listagem ao ter sucesso. */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation<PedidoResponse, Error, CreatePedidoPayload>({
    mutationFn: (payload) =>
      apiClient.post('/pedidos', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Atualiza campos de um pedido. Atualiza o cache do detalhe e invalida a lista. */
export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation<PedidoResponse, Error, UpdatePedidoPayload>({
    mutationFn: (payload) =>
      apiClient.put(`/pedidos/${id}`, payload).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(orderKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Muda o status de um pedido. Suporta motivo opcional. */
export function useUpdateOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation<
    PedidoResponse,
    Error,
    { new_status: PedidoStatus; reason?: string }
  >({
    mutationFn: ({ new_status, reason }) =>
      apiClient
        .patch(`/pedidos/${id}/status`, { new_status, reason })
        .then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(orderKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Muda o status de um pedido com ID dinâmico (para uso em listas). */
export function useUpdateOrderStatusInline() {
  const qc = useQueryClient();
  return useMutation<
    PedidoResponse,
    Error,
    { id: string; new_status: PedidoStatus; reason?: string }
  >({
    mutationFn: ({ id, new_status, reason }) =>
      apiClient
        .patch(`/pedidos/${id}/status`, { new_status, reason })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Atualiza o status de um item de pedido. */
export function useUpdateItemStatus() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { pedidoId: string; itemId: string; newStatus: string }>({
    mutationFn: ({ pedidoId, itemId, newStatus }) =>
      apiClient.patch(`/pedidos/${pedidoId}/items/${itemId}/status`, { new_status: newStatus }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}

/** Soft-delete de um pedido. */
export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/pedidos/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
}
