import { apiClient } from '@/api/client'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(
  path: string,
  options?: {
    params?: Record<string, string | number | boolean | undefined | null>
    init?: RequestInit
  }
): Promise<T> {
  const method = options?.init?.method?.toUpperCase() || 'GET'

  const params = options?.params
    ? Object.fromEntries(
        Object.entries(options.params).filter(([, v]) => v != null && v !== '')
      )
    : undefined

  let data: unknown = undefined
  if (options?.init?.body) {
    try {
      data = JSON.parse(options.init.body as string)
    } catch {
      data = options.init.body
    }
  }

  try {
    const response = await apiClient.request<T>({ url: path, method, params, data })
    return response.data
  } catch (err: any) {
    if (err?.response) {
      const status: number = err.response.status
      const detail = err.response.data?.detail
      const message = typeof detail === 'string' ? detail : 'Request failed'
      throw new ApiError(status, message)
    }
    throw err
  }
}
