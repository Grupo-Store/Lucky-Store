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
let paidValue: number;
let total: number;
let client: QueryClient;
const freight = () => ({ id: 'frete-1', id_pedido: 'pedido-1', numero_os: 'OS-042',
  nome_cliente: 'Hospital', entregador: 'Alfredo', data_frete: '2026-09-13', valor: String(total), pago: paid, valor_pago: paidValue });

beforeEach(() => {
  vi.resetAllMocks();
  paid = false;
  paidValue = 0;
  total = 30;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(apiFetch).mockImplementation(async path => {
    if (path === '/fretes/summary') return {
      total_entregas: 1, entregadores_ativos: 1, valor_total: total, a_pagar: total - paidValue,
      por_entregador: [{ entregador: 'Alfredo', qtd_entregas: 1, valor_total: total, a_pagar: total - paidValue,
        valor_pago: paidValue, pendentes: paid ? 0 : 1, pagos: paid || paidValue > 0 ? 1 : 0 }],
    };
    if (path === '/fretes/detail') return { items: [freight()] };
    if (path === '/pedidos') return { items: [], pages: 1 };
    throw new Error(`Unexpected request: ${path}`);
  });
  vi.mocked(apiClient.patch).mockImplementation(async (url, body) => {
    if (url === '/fretes/pagamento') {
      const payload = body as { valor: string; desfazer: boolean };
      paidValue += Number(payload.valor) * (payload.desfazer ? -1 : 1);
      paid = total > 0 ? paidValue === total : !payload.desfazer;
    } else {
      paid = (body as { pago: boolean }).pago;
      paidValue = paid ? total : 0;
    }
    return { data: freight() };
  });
});
afterEach(() => { cleanup(); client.clear(); });

async function openPayments() {
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Detalhes' }));
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

it('registra o valor informado, atualiza o saldo e mostra Pago sem alterar o Total', async () => {
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  const confirm = await screen.findByRole('button', { name: 'Confirmar pagamento' });
  expect(screen.getByRole('columnheader', { name: 'Total a pagar' })).toBeInTheDocument();
  fireEvent.click(confirm);
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(apiClient.patch).toHaveBeenCalledWith('/fretes/pagamento', { entregador: 'Alfredo', data_inicio: undefined, data_fim: undefined, valor: '30.00', desfazer: false });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const row = within(screen.getByText('Alfredo').closest('tr')!);
  expect(row.getByRole('cell', { name: 'Pago' })).toBeInTheDocument();
  expect(row.getByRole('button', { name: 'Confirmar pagamento' })).toBeDisabled();
  expect(row.getByRole('cell', { name: /R\$\s*30,00/ })).toBeInTheDocument();
  expect(screen.getByText('A Pagar', { selector: 'p' }).parentElement).toHaveTextContent('Pago');
});

it('nao da baixa na tabela se a confirmacao do entregador falhar', async () => {
  vi.mocked(apiClient.patch).mockRejectedValue(new Error('Servidor indisponível'));
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pagamento' }));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Servidor indisponível'));
  expect(screen.getByLabelText('Valor a pagar agora (R$)')).toHaveValue('30,00');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  const row = within(screen.getByText('Alfredo').closest('tr')!);
  expect(row.queryByRole('cell', { name: 'Pago' })).not.toBeInTheDocument();
  expect(row.getAllByRole('cell', { name: /R\$\s*30,00/ })).toHaveLength(2);
  expect(toast.success).not.toHaveBeenCalled();
});

it('permite pagar 10 de 30 e desfazer parte do pagamento pela propria linha', async () => {
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar pagamento' }));
  fireEvent.change(screen.getByLabelText('Valor a pagar agora (R$)'), { target: { value: '10,00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pagamento' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(within(screen.getByText('Alfredo').closest('tr')!).getByRole('cell', { name: /R\$\s*20,00/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer pagamento' }));
  expect(screen.getByLabelText('Valor a desfazer (R$)')).toHaveValue('10,00');
  fireEvent.change(screen.getByLabelText('Valor a desfazer (R$)'), { target: { value: '5,00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer valor' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(paidValue).toBe(5);
  expect(within(screen.getByText('Alfredo').closest('tr')!).getByRole('cell', { name: /R\$\s*25,00/ })).toBeInTheDocument();
});

it('permite desfazer a confirmacao mesmo de um frete de valor zero', async () => {
  total = 0; paid = true;
  render(<QueryClientProvider client={client}><FinancialManager /></QueryClientProvider>);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Fretes' }), { button: 0, ctrlKey: false });
  fireEvent.click(await screen.findByRole('button', { name: 'Desfazer pagamento' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer valor' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(paid).toBe(false);
  expect(screen.getByRole('button', { name: 'Confirmar pagamento' })).toBeEnabled();
});
