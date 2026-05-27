import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, ApiError } from '@/lib/api'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('omits undefined and empty string params from query string', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    )
    await apiFetch('/pedidos', { params: { status: undefined, page: 1, limit: 20, id_loja: '' } })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).not.toContain('status=')
    expect(url).not.toContain('id_loja=')
    expect(url).toContain('page=1')
    expect(url).toContain('limit=20')
  })

  it('throws ApiError with correct status on non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
    )
    await expect(apiFetch<unknown>('/pedidos/999')).rejects.toThrow(ApiError)
    await expect(apiFetch<unknown>('/pedidos/999')).rejects.toMatchObject({ status: 404 })
  })

  it('includes Authorization header in every request', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    )
    await apiFetch('/pedidos')
    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Authorization']).toMatch(/^Bearer /)
  })
})
