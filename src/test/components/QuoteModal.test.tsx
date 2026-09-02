import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QuoteModal } from '@/components/QuoteModal';
import type { Quote } from '@/store/QuoteStore';
import { emptyPhases } from '@/store/QuoteStore';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const { mockCreateQuote, mockUpdateQuote, mockUpdateQuotePhase } = vi.hoisted(() => ({
  mockCreateQuote: vi.fn(),
  mockUpdateQuote: vi.fn(),
  mockUpdateQuotePhase: vi.fn(),
}));

vi.mock('@/api/hooks/useQuotes', () => ({
  useCreateQuote: () => ({ mutate: mockCreateQuote, isPending: false }),
  useUpdateQuote: () => ({ mutate: mockUpdateQuote, isPending: false }),
  useUpdateQuotePhase: () => ({ mutate: mockUpdateQuotePhase, isPending: false }),
  useQuoteHistory: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    delete: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  getApiError: (e: unknown) => String(e),
}));

vi.mock('@/hooks/useVendedores', () => ({
  useVendedores: () => ({ data: { items: [] }, isLoading: false }),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const existingQuote: Quote = {
  id: 'quote-backend-uuid',
  index: 'COT-001',
  createdAt: 1000000,
  customer: 'Tech Corp',
  cnpj: '12.345.678/0001-99',
  requestNumber: 'REQ-001',
  requestDate: '2026-05-01',
  b2bCompany: '',
  company: 'Lucky Store',
  directBilling: false,
  supplier: '',
  seller: 'Alcides',
  value: 5000,
  items: [],
  directSupplyItems: [],
  observations: '',
  phases: emptyPhases(),
  taxLucky: 5,
  taxBTech: 3,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('QuoteModal — create mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with the "Criar Cotação" button', () => {
    render(
      <QuoteModal open onClose={vi.fn()} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );
    expect(screen.getByRole('button', { name: /Criar Cotação/i })).toBeInTheDocument();
  });

  it('calls createQuote when save is clicked', async () => {
    mockCreateQuote.mockImplementation((_p: any, cb: any) => cb?.onSuccess?.({ id: 'new-backend-quote-id' }));

    render(
      <QuoteModal open onClose={vi.fn()} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Criar Cotação/i }));

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalled());
  });

  it('passes the backend id to onSave (not local UUID)', async () => {
    const onSave = vi.fn();
    mockCreateQuote.mockImplementation((_p: any, cb: any) => {
      cb?.onSuccess?.({ id: 'new-backend-quote-id' });
    });

    render(
      <QuoteModal open onClose={vi.fn()} onSave={onSave} nextIndex={() => 'COT-001'} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Criar Cotação/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-backend-quote-id' }),
    );
  });

  it('calls onClose after successful save', async () => {
    const onClose = vi.fn();
    mockCreateQuote.mockImplementation((_p: any, cb: any) => cb?.onSuccess?.({ id: 'qid' }));

    render(
      <QuoteModal open onClose={onClose} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Criar Cotação/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('builds the createQuote payload with correct fields', async () => {
    mockCreateQuote.mockImplementation((_p: any, cb: any) => cb?.onSuccess?.({ id: 'qid' }));

    render(
      <QuoteModal open onClose={vi.fn()} onSave={vi.fn()} nextIndex={() => 'COT-002'} />
    );

    // Fill in customer
    const textboxes = screen.getAllByRole('textbox');
    // First non-readonly textbox is likely the customer/index field
    // Interaction with input to set customer value
    fireEvent.change(textboxes[0], { target: { value: 'Empresa Teste' } });

    fireEvent.click(screen.getByRole('button', { name: /Criar Cotação/i }));

    await waitFor(() => expect(mockCreateQuote).toHaveBeenCalled());

    const [vars] = mockCreateQuote.mock.calls[0];
    expect(vars.payload).toHaveProperty('id_loja');
    expect(vars.payload).toHaveProperty('id_vendedor');
    expect(vars.payload).toHaveProperty('data_cotacao');
    expect(vars.idempotencyKey).toBeTruthy();
  });
});

// ─── Seller name in print template ───────────────────────────────────────────

describe('QuoteModal — seller name in print document', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Alcides Campos in the signature when seller is "Alcides Campos"', () => {
    render(
      <QuoteModal
        open
        quote={{ ...existingQuote, seller: 'Alcides Campos' as any }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextIndex={() => 'COT-001'}
      />
    );
    const signatureNodes = document.querySelectorAll('.qp-sign-name');
    expect(signatureNodes.length).toBeGreaterThan(0);
    signatureNodes.forEach(node => expect(node.textContent).toBe('Alcides Campos'));
  });

  it('shows J. Lucas Campos in the signature — not "Lucas Campos"', () => {
    render(
      <QuoteModal
        open
        quote={{ ...existingQuote, seller: 'J. Lucas Campos' as any }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextIndex={() => 'COT-001'}
      />
    );
    const signatureNodes = document.querySelectorAll('.qp-sign-name');
    expect(signatureNodes.length).toBeGreaterThan(0);
    signatureNodes.forEach(node => {
      expect(node.textContent).toBe('J. Lucas Campos');
      expect(node.textContent).not.toBe('Lucas Campos');
    });
  });

  it('shows J. Pedro Campos in the signature — not "Pedro Campos"', () => {
    render(
      <QuoteModal
        open
        quote={{ ...existingQuote, seller: 'J. Pedro Campos' as any }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextIndex={() => 'COT-001'}
      />
    );
    const signatureNodes = document.querySelectorAll('.qp-sign-name');
    expect(signatureNodes.length).toBeGreaterThan(0);
    signatureNodes.forEach(node => {
      expect(node.textContent).toBe('J. Pedro Campos');
      expect(node.textContent).not.toBe('Pedro Campos');
    });
  });

  it('shows "—" in the signature when seller is empty', () => {
    render(
      <QuoteModal
        open
        quote={{ ...existingQuote, seller: '' as any }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextIndex={() => 'COT-001'}
      />
    );
    const signatureNodes = document.querySelectorAll('.qp-sign-name');
    expect(signatureNodes.length).toBeGreaterThan(0);
    signatureNodes.forEach(node => expect(node.textContent).toBe('—'));
  });

  it('shows same seller name in Liner field and in signature', () => {
    render(
      <QuoteModal
        open
        quote={{ ...existingQuote, seller: 'J. Lucas Campos' as any }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        nextIndex={() => 'COT-001'}
      />
    );
    const linerNodes  = document.querySelectorAll('.qp-info b');
    const signNodes   = document.querySelectorAll('.qp-sign-name');

    const linerTexts = Array.from(linerNodes).map(n => n.textContent);
    expect(linerTexts).toContain('J. Lucas Campos');

    signNodes.forEach(node => expect(node.textContent).toBe('J. Lucas Campos'));
  });
});

// ─── Edit mode ───────────────────────────────────────────────────────────────

describe('QuoteModal — edit mode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with "Salvar Alterações" button when quote is passed', () => {
    render(
      <QuoteModal open quote={existingQuote} onClose={vi.fn()} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );
    expect(screen.getByRole('button', { name: /Salvar Alterações/i })).toBeInTheDocument();
  });

  it('calls updateQuote on save in edit mode', async () => {
    const onSave = vi.fn();
    mockUpdateQuote.mockImplementation((_p: any, cb: any) => cb?.onSuccess?.());

    render(
      <QuoteModal open quote={existingQuote} onClose={vi.fn()} onSave={onSave} nextIndex={() => 'COT-001'} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(mockUpdateQuote).toHaveBeenCalled());
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  it('does NOT call createQuote in edit mode', async () => {
    mockUpdateQuote.mockImplementation((_p: any, cb: any) => cb?.onSuccess?.());

    render(
      <QuoteModal open quote={existingQuote} onClose={vi.fn()} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }));

    await waitFor(() => expect(mockUpdateQuote).toHaveBeenCalled());
    expect(mockCreateQuote).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <QuoteModal open quote={existingQuote} onClose={onClose} onSave={vi.fn()} nextIndex={() => 'COT-001'} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
