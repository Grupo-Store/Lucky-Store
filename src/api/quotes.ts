import { apiClient } from "./client"
import { API } from "./endpoints"
import type { PaginatedResponse } from "./types"
import type { Quote, QuotePhaseKey } from "../store/QuoteStore"

export interface QuotesListParams {
  page?: number
  limit?: number
  phase?: QuotePhaseKey
  company?: string
  seller?: string
  search?: string
}

export interface UpdatePhasePayload {
  phase: QuotePhaseKey
  date?: string
  value?: number
}

export const quotesApi = {
  list: (params?: QuotesListParams) =>
    apiClient.get<PaginatedResponse<Quote>>(API.quotes.list, { params }).then((r) => r.data),

  create: (data: Omit<Quote, "id" | "createdAt">) =>
    apiClient.post<Quote>(API.quotes.create, data).then((r) => r.data),

  detail: (id: string) =>
    apiClient.get<Quote>(API.quotes.detail(id)).then((r) => r.data),

  update: (id: string, data: Partial<Quote>) =>
    apiClient.put<Quote>(API.quotes.update(id), data).then((r) => r.data),

  updatePhase: (id: string, payload: UpdatePhasePayload) =>
    apiClient.patch<Quote>(API.quotes.phase(id), payload).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(API.quotes.delete(id)).then((r) => r.data),

  convert: (id: string) =>
    apiClient.post(API.quotes.convert(id)).then((r) => r.data),
}
