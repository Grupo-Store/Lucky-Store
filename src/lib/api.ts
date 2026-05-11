const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DEV_TOKEN = import.meta.env.VITE_DEV_API_TOKEN ?? ''

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
  let url = `${BASE_URL}${path}`

  if (options?.params) {
    const qs = Object.entries(options.params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    if (qs) url += `?${qs}`
  }

  const response = await fetch(url, {
    ...options?.init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEV_TOKEN}`,
      ...options?.init?.headers,
    },
  })

  if (!response.ok) {
    let message = 'Request failed'
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch {
      // ignore parse error — use default message
    }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}
