import { apiClient } from "./client"
import { API } from "./endpoints"
import type { PaginatedResponse } from "./types"
import type { Order, OrderStatus, ItemStatus } from "../store/OrderStore"

export interface OrdersListParams {
  page?: number
  limit?: number
  status?: OrderStatus
  company?: string
  seller?: string
  search?: string
}

export interface UpdateStatusPayload {
  status: OrderStatus
}

export interface UpdateItemStatusPayload {
  status: ItemStatus
}

export const ordersApi = {
  list: (params?: OrdersListParams) =>
    apiClient.get<PaginatedResponse<Order>>(API.orders.list, { params }).then((r) => r.data),

  create: (data: Omit<Order, "id" | "createdAt">) =>
    apiClient.post<Order>(API.orders.create, data).then((r) => r.data),

  detail: (id: string) =>
    apiClient.get<Order>(API.orders.detail(id)).then((r) => r.data),

  update: (id: string, data: Partial<Order>) =>
    apiClient.put<Order>(API.orders.update(id), data).then((r) => r.data),

  updateStatus: (id: string, payload: UpdateStatusPayload) =>
    apiClient.patch<Order>(API.orders.status(id), payload).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(API.orders.delete(id)).then((r) => r.data),

  history: (id: string) =>
    apiClient.get<unknown[]>(API.orders.history(id)).then((r) => r.data),

  items: (id: string) =>
    apiClient.get(API.orders.items(id)).then((r) => r.data),

  updateItemStatus: (id: string, itemId: string, payload: UpdateItemStatusPayload) =>
    apiClient.patch(API.orders.itemStatus(id, itemId), payload).then((r) => r.data),

  costs: (id: string) =>
    apiClient.get(API.orders.costs(id)).then((r) => r.data),

  payments: (id: string) =>
    apiClient.get(API.orders.payments(id)).then((r) => r.data),
}
