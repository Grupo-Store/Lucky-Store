import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, ApiError } from '@/lib/api'
import { apiClient } from '@/api/client'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('omits undefined and empty string params from query string', async () => {
    const mockRequest = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: { items: [] } })
    await apiFetch('/pedidos', { params: { status: undefined, page: 1, limit: 20, id_loja: '' } })
    const config = mockRequest.mock.calls[0][0]
    expect(config.params).not.toHaveProperty('status')
    expect(config.params).not.toHaveProperty('id_loja')
    expect(config.params).toMatchObject({ page: 1, limit: 20 })
  })

  it('throws ApiError with correct status on non-2xx response', async () => {
    const axiosError = {
      response: { status: 404, data: { detail: 'Not found' } },
    }
    vi.spyOn(apiClient, 'request').mockRejectedValue(axiosError)
    await expect(apiFetch<unknown>('/pedidos/999')).rejects.toThrow(ApiError)
    vi.spyOn(apiClient, 'request').mockRejectedValue(axiosError)
    await expect(apiFetch<unknown>('/pedidos/999')).rejects.toMatchObject({ status: 404 })
  })

  it('sends request to the correct URL with the correct method', async () => {
    const mockRequest = vi.spyOn(apiClient, 'request').mockResolvedValue({ data: {} })
    await apiFetch('/pedidos', { init: { method: 'POST' } })
    const config = mockRequest.mock.calls[0][0]
    expect(config.url).toBe('/pedidos')
    expect(config.method).toBe('POST')
  })
})
