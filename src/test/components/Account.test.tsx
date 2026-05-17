import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Account from '@/pages/Account';
import { apiClient } from '@/api/client';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/api/client', () => ({
  apiClient: { get: vi.fn() },
  getApiError: vi.fn((_e: unknown) => 'Erro ao exportar dados'),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockGet = (apiClient as any).get as ReturnType<typeof vi.fn>;

const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

const mockUser = {
  id: 'user-uuid-1234-5678',
  name: 'Maria Eduarda',
  email: 'duda@exemplo.com',
  role: 'seller',
  is_active: true,
  totp_enabled: false,
  created_at: '2026-01-10T10:00:00Z',
  updated_at: '2026-05-07T09:00:00Z',
};

// ─── Account page ─────────────────────────────────────────────────────────────

describe('Account page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading spinner while fetching user', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<Account />, { wrapper: makeWrapper() });
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders user info after successful fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: mockUser });
    render(<Account />, { wrapper: makeWrapper() });

    await waitFor(() => screen.getByText('Maria Eduarda'));

    expect(screen.getByText('duda@exemplo.com')).toBeTruthy();
    expect(screen.getByText('Vendedor')).toBeTruthy();
    expect(screen.getByText('10/01/2026')).toBeTruthy();
  });

  it('shows error message when fetch fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network error'));
    render(<Account />, { wrapper: makeWrapper() });

    await waitFor(() =>
      screen.getByText('Não foi possível carregar os dados do usuário.'),
    );
  });

  it('renders LGPD section and export button after fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: mockUser });
    render(<Account />, { wrapper: makeWrapper() });

    await waitFor(() => screen.getByText('Privacidade e dados (LGPD)'));
    expect(screen.getByRole('button', { name: /exportar meus dados/i })).toBeTruthy();
  });

  it('renders unknown role verbatim when not in roleLabels', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...mockUser, role: 'manager' } });
    render(<Account />, { wrapper: makeWrapper() });

    await waitFor(() => screen.getByText('manager'));
  });
});

// ─── DataExportButton ─────────────────────────────────────────────────────────

describe('DataExportButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
  });

  async function renderAndWaitForButton() {
    mockGet.mockResolvedValueOnce({ data: mockUser });
    const result = render(<Account />, { wrapper: makeWrapper() });
    await waitFor(() => screen.getByRole('button', { name: /exportar meus dados/i }));
    return result;
  }

  it('calls the correct export endpoint with user id', async () => {
    await renderAndWaitForButton();
    mockGet.mockResolvedValueOnce({ data: { user: mockUser, audit_logs: [] } });

    fireEvent.click(screen.getByRole('button', { name: /exportar meus dados/i }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(`/users/${mockUser.id}/data-export`);
    });
  });

  it('triggers download blob and shows success toast on export', async () => {
    const { toast } = await import('sonner');
    await renderAndWaitForButton();
    mockGet.mockResolvedValueOnce({ data: { user: mockUser, audit_logs: [] } });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /exportar meus dados/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Dados exportados com sucesso');
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('shows error toast when export request fails', async () => {
    const { toast } = await import('sonner');
    await renderAndWaitForButton();
    mockGet.mockRejectedValueOnce(new Error('server error'));

    fireEvent.click(screen.getByRole('button', { name: /exportar meus dados/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erro ao exportar dados');
    });
  });

  it('disables button and shows loading text while exporting', async () => {
    await renderAndWaitForButton();
    mockGet.mockReturnValueOnce(new Promise(() => {}));

    fireEvent.click(screen.getByRole('button', { name: /exportar meus dados/i }));

    await waitFor(() => screen.getByText('Exportando...'));
    expect(screen.getByRole('button', { name: /exportando/i })).toBeDisabled();
  });

  it('re-enables button after export completes', async () => {
    await renderAndWaitForButton();
    mockGet.mockResolvedValueOnce({ data: { user: mockUser, audit_logs: [] } });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: /exportar meus dados/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /exportar meus dados/i })).not.toBeDisabled(),
    );
  });
});
