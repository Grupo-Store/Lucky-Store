import { apiClient } from "./client"
import { API } from "./endpoints"
import type { PaginatedResponse } from "./types"
import type { Order, RmaItemStatus } from "../store/OrderStore"

export interface RmaListParams {
  page?: number
  limit?: number
  search?: string
}

export interface UpdateRmaItemStatusPayload {
  status: RmaItemStatus
}

export const rmaApi = {
  list: (params?: RmaListParams) =>
    apiClient.get<PaginatedResponse<Order>>(API.rma.list, { params }).then((r) => r.data),

  create: (data: Omit<Order, "id" | "createdAt">) =>
    apiClient.post<Order>(API.rma.create, data).then((r) => r.data),

  detail: (id: string) =>
    apiClient.get<Order>(API.rma.detail(id)).then((r) => r.data),

  close: (id: string) =>
    apiClient.post(API.rma.close(id)).then((r) => r.data),

  updateItemStatus: (id: string, itemId: string, payload: UpdateRmaItemStatusPayload) =>
    apiClient.patch(API.rma.itemStatus(id, itemId), payload).then((r) => r.data),
}
