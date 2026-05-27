import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
}

export interface OrderHistory {
  order_id: string
  status_history: unknown[]
  audit_logs: AuditLog[]
}

// Hook compartilhado com a task 2.5.1 (Duda — StatusHistoryTimeline)
export function useOrderHistory(pedidoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['order-history', pedidoId],
    queryFn: () =>
      apiClient.get<OrderHistory>(`/pedidos/${pedidoId}/history`).then(r => r.data),
    enabled: enabled && !!pedidoId,
  })
}
