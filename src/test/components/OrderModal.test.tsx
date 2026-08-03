import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderModal } from '@/components/OrderModal';
import type { Order } from '@/store/OrderStore';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockCreateOrder, mockUpdateOrder } = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockUpdateOrder: vi.fn(),
}));

vi.mock('@/api/hooks/useOrders', () => ({
  useCreateOrder: () => ({ mutate: mockCreateOrder, isPending: false }),
  useUpdateOrder: () => ({ mutate: mockUpdateOrder, isPending: false }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useOrderHistory: () => ({ data: undefined, isLoading: false }),
  orderKeys: {
    all: ['orders'],
    lists: () => ['orders', 'list'],
    list: (f: unknown) => ['orders', 'list', f],
    details: () => ['orders', 'detail'],
    detail: (id: string) => ['orders', 'detail', id],
    history: (id: string) => ['orders', 'history', id],
  },
}));

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/client', () => ({
  apiClient: {},
  getApiError: (e: unknown) => String(e),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const existingOrder: Order = {
  id: 'backend-order-uuid',
  os: '1001',
  createdAt: 1000000,
  orderDate: '2026-01-01',
  customer: 'Tech Corp',
  cnpj: '12.345.678/0001-99',
  company: 'Lucky Store',
  seller: 'Alcides',
  ocAfPed: 'OC-9999',
  directBilling: false,
  supplier: '',
  invoice: 'NF-001',
  invoiceSupplier: '',
  paymentMethods: ['Pix'],
  installments: 1,
  deliveryDate: '2026-02-01',
  status: 'Bought',
  isRMA: false,
  cancelled: false,
  observations: '',
  initialProductCost: 1000,
  finalProductCost: 1000,
  boletoCost: 0,
  giftCost: 0,
  creditCostPercent: 0,
  creditCostValue: 0,
  debitCostPercent: 0,
  debitCostValue: 0,
  purchaseTaxPercent: 0,
  purchaseTaxValue: 0,
  salesTaxPercent: 0,
  salesTaxValue: 0,
  salesValue: 2000,
  items: [],
  freight: [],
  directSupplyItems: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrderModal — create mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with "Novo Pedido" title when no order is passed', () => {
    render(
      <OrderModal
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextOS={() => '1006'}
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getAllByText(/Novo Pedido/i).length).toBeGreaterThan(0);
  });

  it('shows the "Criar Pedido" save button', () => {
    render(
      <OrderModal open onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1006'} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByRole('button', { name: /Criar Pedido/i })).toBeInTheDocument();
  });

  it('shows validation error toast when required fields are missing', async () => {
    const { toast } = await import('sonner');
    render(
      <OrderModal open onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1006'} />,
      { wrapper: makeWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('campos obrigatórios'),
      );
    });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('calls createOrder and passes backend id to onSave', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    mockCreateOrder.mockImplementation((_payload: any, callbacks: any) => {
      callbacks?.onSuccess?.({ id: 'new-backend-id-xyz' });
    });

    render(
      <OrderModal open onClose={onClose} onSave={onSave} nextOS={() => '1006'} />,
      { wrapper: makeWrapper() }
    );

    // Fill in required fields
    const textboxes = screen.getAllByRole('textbox');
    // textboxes[0] = OS (readOnly), [1] = Cliente, [2] = CPF/CNPJ, [3] = OC/AF/PED
    fireEvent.change(textboxes[1], { target: { value: 'Test Client' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: OC-1234'), { target: { value: 'OC-0001' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/i }));

    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalled());

    const [payload] = mockCreateOrder.mock.calls[0];
    expect(payload.nome_cliente).toBe('Test Client');
    expect(payload.numero_oc).toBe('OC-0001');

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-backend-id-xyz' }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});

describe('OrderModal — edit mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with "Editar Pedido" title when an order is passed', () => {
    render(
      <OrderModal
        open
        order={existingOrder}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextOS={() => '1001'}
      />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getAllByText(/Editar Pedido/i).length).toBeGreaterThan(0);
  });

  it('shows the "Salvar Alterações" button in edit mode', () => {
    render(
      <OrderModal open order={existingOrder} onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1001'} />,
      { wrapper: makeWrapper() }
    );
    expect(screen.getByRole('button', { name: /Salvar Alterações/i })).toBeInTheDocument();
  });

  it('calls updateOrder with correct payload when saving', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    mockUpdateOrder.mockImplementation((_payload: any, callbacks: any) => {
      callbacks?.onSuccess?.({ ...existingOrder });
    });

    render(
      <OrderModal open order={existingOrder} onClose={onClose} onSave={onSave} nextOS={() => '1001'} />,
      { wrapper: makeWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(mockUpdateOrder).toHaveBeenCalled());

    const [payload] = mockUpdateOrder.mock.calls[0];
    expect(payload).toMatchObject({
      numero_oc: 'OC-9999',
    });
    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows loading state while saving', () => {
    const { rerender } = render(
      <OrderModal open order={existingOrder} onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1001'} />,
      { wrapper: makeWrapper() }
    );
    // Default: not pending
    expect(screen.getByRole('button', { name: /Salvar Alterações/i })).not.toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <OrderModal open order={existingOrder} onClose={onClose} onSave={vi.fn()} nextOS={() => '1001'} />,
      { wrapper: makeWrapper() }
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('includes nota_fiscal_fornecedor in payload when directBilling is active', async () => {
    mockUpdateOrder.mockImplementation((_payload: any, callbacks: any) => {
      callbacks?.onSuccess?.({ ...existingOrder });
    });

    const orderWithDirectBilling: Order = {
      ...existingOrder,
      directBilling: true,
      supplier: 'Fornecedor XYZ',
      invoiceSupplier: 'NF-FORN-001',
    };

    render(
      <OrderModal open order={orderWithDirectBilling} onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1001'} />,
      { wrapper: makeWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(mockUpdateOrder).toHaveBeenCalled());

    const [payload] = mockUpdateOrder.mock.calls[0];
    expect(payload.nota_fiscal_fornecedor).toBe('NF-FORN-001');
    expect(payload.is_direct_billing).toBe(true);
  });
});
