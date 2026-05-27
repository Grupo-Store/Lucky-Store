import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useCreateRma } from '@/api/hooks/useRma';
import { apiClient } from '@/api/client';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiError: vi.fn((e: unknown) => String(e)),
}));

const mockPost = (apiClient as any).post as ReturnType<typeof vi.fn>;

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

const mockRmaResponse = {
  id: 'rma-backend-uuid',
  numero_rma: 'RMA-1003-1',
  status: 'Registered',
  itens: [{ id: 'item-rma-1', descricao: 'Notebook Dell', quantidade: 1, status: 'Not Received', id_produto_origem: null }],
};

describe('useCreateRma', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /rma with the payload', async () => {
    mockPost.mockResolvedValueOnce({ data: mockRmaResponse });

    const { result } = renderHook(() => useCreateRma(), { wrapper: makeWrapper() });

    const payload = {
      id_pedido_origem: 'parent-order-backend-uuid',
      prazo_entrega: '2026-06-01',
      itens: [{ descricao: 'Notebook Dell', quantidade: 1 }],
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith('/rma', payload);
  });

  it('payload must not include id_produto_origem', async () => {
    mockPost.mockResolvedValueOnce({ data: mockRmaResponse });
    const { result } = renderHook(() => useCreateRma(), { wrapper: makeWrapper() });

    const payload = {
      id_pedido_origem: 'parent-order-id',
      itens: [{ descricao: 'Monitor LG', quantidade: 2 }],
    };

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const sentPayload = mockPost.mock.calls[0][1];
    expect(sentPayload.itens[0]).not.toHaveProperty('id_produto_origem');
  });

  it('returns the created RMA with backend id', async () => {
    mockPost.mockResolvedValueOnce({ data: mockRmaResponse });
    const { result } = renderHook(() => useCreateRma(), { wrapper: makeWrapper() });

    let receivedData: any;
    await act(async () => {
      result.current.mutate(
        { id_pedido_origem: 'pid', itens: [{ descricao: 'X', quantidade: 1 }] },
        { onSuccess: (d) => { receivedData = d; } },
      );
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedData.id).toBe('rma-backend-uuid');
  });

  it('surfaces errors from the API', async () => {
    mockPost.mockRejectedValueOnce(new Error('422 Unprocessable Entity'));
    const { result } = renderHook(() => useCreateRma(), { wrapper: makeWrapper() });

    await act(async () => {
      result.current.mutate({ id_pedido_origem: 'pid', itens: [] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
