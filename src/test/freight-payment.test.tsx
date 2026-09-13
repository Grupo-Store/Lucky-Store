import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FinancialManager } from '@/components/finance/FinancialManager';
import { apiFetch } from '@/lib/api';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: { patch: vi.fn() }, getApiError: (err: Error) => err.message }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/hooks/useRma', () => ({ useRmas: () => ({ data: { items: [] } }) }));
vi.mock('@/components/OrderModal', () => ({ OrderModal: () => null }));
vi.mock('@/components/RmaEditModal', () => ({ RmaEditModal: () => null }));
vi.mock('@/components/finance/ExpenseModal', () => ({ ExpenseModal: () => null }));
vi.mock('@/store/FinanceStore', async importOriginal => ({
  ...await importOriginal<typeof import('@/store/FinanceStore')>(),
  useFinance: () => ({ expenses: [] }),
}));
vi.mock('@/store/OrderStore', async importOriginal => ({
  ...await importOriginal<typeof import('@/store/OrderStore')>(),
  useOrders: () => ({}),
}));

let paid: boolean;
let client: QueryClient;
const freight = () => ({ id: 'frete-1', id_pedido: 'pedido-1', numero_os: 'OS-042',
  nome_cliente: 'Hospital', entregador: 'Alfredo', data_frete: '2026-09-13', valor: '30.00', pago: paid });

beforeEach(() => {
  vi.resetAllMocks();
  paid = false;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path === '/fretes/summary') return {
      total_entregas: 1, entregadores_ativos: 1, valor_total: 30, a_pagar: paid ? 0 : 30,
      por_entregador: [{ entregador: 'Alfredo', qtd_entregas: 1, valor_total: 30, a_pagar: paid ? 0 : 30 }],
    };
    if (path === '/fretes/detail') return { items: [freight()] };
    if (path === '/pedidos') return { items: [], pages: 1 };
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.mocked(apiClient.patch).mockImplementation(async (_url, body) => {
    paid = (body as { pago: boolean }).pago;
    return { data: freight() };
  });
});
afterEach(() => { cleanup(); client.clear(); });

async function openPayments() {
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pagamento' }));
  const dialog = within(screen.getByRole('dialog'));
  await dialog.findByRole('button', { name: 'Confirmar pagamento' });
  return dialog;
}

it('confirma um frete, baixa o A pagar, atualiza o Financeiro e permite desfazer', async () => {
  const dialog = await openPayments();
  const readsBefore = vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/pedidos').length;
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pagamento confirmado. Frete baixado do A pagar.'));
  expect(apiClient.patch).toHaveBeenCalledWith('/pedidos/pedido-1/fretes/frete-1/pago', { pago: true });
  expect(dialog.getByText('Pago')).toBeInTheDocument();
  expect(dialog.getByText('A Pagar').parentElement).toHaveTextContent(/R\$\s*0,00/);
  expect(dialog.getByText('Total').parentElement).toHaveTextContent(/R\$\s*30,00/);
  expect(client.getQueryData(['fretes', 'summary', { data_inicio: undefined, data_fim: undefined }])).toMatchObject({ a_pagar: 0, valor_total: 30 });
  expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path === '/pedidos').length).toBeGreaterThan(readsBefore);

  fireEvent.click(dialog.getByRole('button', { name: 'Desfazer pagamento' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Pagamento desfeito. Frete voltou ao A pagar.'));
  expect(apiClient.patch).toHaveBeenLastCalledWith('/pedidos/pedido-1/fretes/frete-1/pago', { pago: false });
  expect(dialog.getByText('A Pagar').parentElement).toHaveTextContent(/R\$\s*30,00/);
});

it('aguarda a gravacao e mantem o frete pendente se o servidor rejeitar', async () => {
  let reject!: (error: Error) => void;
  vi.mocked(apiClient.patch).mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; }));
  const dialog = await openPayments();
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));
  expect(await dialog.findByRole('button', { name: 'Salvando...' })).toBeDisabled();
  fireEvent.click(dialog.getByRole('button', { name: 'Salvando...' }));
  expect(apiClient.patch).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Falha ao registrar pagamento')));
  expect(toast.error).toHaveBeenCalledWith('Falha ao registrar pagamento');
  expect(toast.success).not.toHaveBeenCalled();
  expect(await dialog.findByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled();
  expect(dialog.getByText('A Pagar').parentElement).toHaveTextContent(/R\$\s*30,00/);
});
