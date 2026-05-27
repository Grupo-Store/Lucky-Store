export interface ApiError {
  status: number
  detail: string | Record<string, unknown>
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
