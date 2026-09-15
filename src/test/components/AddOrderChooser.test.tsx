/**
 * Tests for AddOrderChooser — specifically the fix that changed the quotes
 * endpoint from /cotacoes (404) to /quotes (correct).
 *
 * Covers:
 *   - Component renders the initial "choose" step
 *   - Navigating to the pick-quote step triggers a GET /quotes API call
 *   - The call is to /quotes NOT /cotacoes
 *   - Correct query params are forwarded (page, limit, sort)
 *   - Loaded quotes are rendered in the table
 *   - Empty state is shown when no quotes are returned
 *   - Selecting a quote and confirming builds a valid OrderPrefill
 *   - A busca vai ao servidor (parametro `busca`), e nao filtra so a pagina
 *     carregada — senao o indice da cotacao e os clientes de paginas
 *     seguintes sumiam da tela sem erro nenhum.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddOrderChooser } from '@/components/AddOrderChooser';
import { apiClient } from '@/api/client';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getApiError: (e: unknown) => String(e),
}));

const mockGet = (apiClient as any).get as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STORE_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';

const mockQuote = {
  id: 'quote-uuid-1',
  numero: 64,
  id_loja: STORE_ID,
  id_vendedor: VENDOR_ID,
  cliente: 'Empresa Teste Ltda',
  cnpj_cliente: '12.345.678/0001-99',
  numero_requisicao: 'REQ-001',
  data_cotacao: '2026-05-01',
  data_validade: null,
  b2b_company: null,
  fornecedor: null,
  valor_total: '5000.00',
  pct_imposto_lucky: null,
  pct_imposto_btech: null,
  observacao: null,
  status_enviada: false,
  status_em_fechamento: false,
  status_fechada: true,
  status_caida: false,
  itens: [
    {
      id: 'item-uuid-1',
      id_cotacao: 'quote-uuid-1',
      descricao: 'Monitor Dell 27"',
      quantidade: 2,
      valor_unitario: '2500.00',
      valor_total: '5000.00',
      valor_fechamento: '4800.00',
      valor_total_fechamento: '9600.00',
      fornecedor: null,
    },
  ],
  created_by: VENDOR_ID,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const emptyPaginatedResponse = { items: [], total: 0, page: 1, limit: 20, pages: 1 };
const paginatedWithQuote = { items: [mockQuote], total: 1, page: 1, limit: 20, pages: 1 };

const makeWrapper = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onChooseNew: vi.fn(),
  onChooseFromQuote: vi.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AddOrderChooser — initial step', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the two choice buttons', () => {
    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/Cadastrar a partir de cotação/i)).toBeInTheDocument();
    expect(screen.getByText(/Cadastrar novo pedido/i)).toBeInTheDocument();
  });

  it('calls onChooseNew when "Cadastrar novo pedido" is clicked', () => {
    const onChooseNew = vi.fn();
    render(<AddOrderChooser {...defaultProps} onChooseNew={onChooseNew} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar novo pedido/i));
    expect(onChooseNew).toHaveBeenCalled();
  });

  it('does NOT call the API while on the choose step', () => {
    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('AddOrderChooser — pick-quote step API call', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls GET /quotes when navigating to the pick-quote step', async () => {
    mockGet.mockResolvedValueOnce({ data: emptyPaginatedResponse });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    const [url] = mockGet.mock.calls[0];
    expect(url).toBe('/quotes');
  });

  it('does NOT call /cotacoes (old broken endpoint)', async () => {
    mockGet.mockResolvedValueOnce({ data: emptyPaginatedResponse });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const calledUrls = mockGet.mock.calls.map((c: any) => c[0]);
    expect(calledUrls).not.toContain('/cotacoes');
  });

  it('passes pagination params to the /quotes call', async () => {
    mockGet.mockResolvedValueOnce({ data: emptyPaginatedResponse });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, config] = mockGet.mock.calls[0];
    expect(config?.params?.page).toBeDefined();
    expect(config?.params?.limit).toBeDefined();
  });

  it('shows empty state when API returns no quotes', async () => {
    mockGet.mockResolvedValueOnce({ data: emptyPaginatedResponse });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => {
      expect(screen.getByText(/Nenhuma cotação fechada encontrada/i)).toBeInTheDocument();
    });
  });

  it('renders loaded quotes in the table', async () => {
    mockGet.mockResolvedValueOnce({ data: paginatedWithQuote });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => {
      expect(screen.getByText('Empresa Teste Ltda')).toBeInTheDocument();
    });
  });

  it('shows the quote value in the table', async () => {
    mockGet.mockResolvedValueOnce({ data: paginatedWithQuote });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => {
      expect(screen.getByText(/5\.000/)).toBeInTheDocument();
    });
  });
});

describe('AddOrderChooser — pick-items step', () => {
  beforeEach(() => vi.clearAllMocks());

  const advanceToItems = async () => {
    mockGet.mockResolvedValueOnce({ data: paginatedWithQuote });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));

    await waitFor(() => expect(screen.getByText('Empresa Teste Ltda')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Empresa Teste Ltda'));

    await waitFor(() => expect(screen.getByText(/Monitor Dell/i)).toBeInTheDocument());
  };

  it('shows the items of the selected quote', async () => {
    await advanceToItems();
    expect(screen.getByText(/Monitor Dell/i)).toBeInTheDocument();
  });

  it('edita quantidade e valores sem desmarcar o item nem alterar a cotação', async () => {
    const original = JSON.stringify(mockQuote);
    await advanceToItems();
    const cost = screen.getByRole('textbox', { name: /Custo unitário de Monitor/ });
    fireEvent.click(cost);
    fireEvent.change(cost, { target: { value: '1.234,56' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Quantidade de Monitor/ }), { target: { value: '3' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Venda unitária de Monitor/ }), { target: { value: '2000,50' } });
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/Total selecionado/)).toHaveTextContent('6.001,50');
    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/ }));
    expect(defaultProps.onChooseFromQuote).toHaveBeenCalledWith(expect.objectContaining({
      salesValue: 6001.5,
      items: [expect.objectContaining({ quantity: 3, projectedValue: 1234.56, saleValue: 2000.5 })],
    }));
    expect(JSON.stringify(mockQuote)).toBe(original);
  });

  it('o check desmarca e remarca uma única vez e impede um pedido sem itens', async () => {
    await advanceToItems();
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Criar Pedido/ })).toBeDisabled();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: /Criar Pedido/ })).toBeEnabled();
  });

  it.each([
    ['Quantidade', '0'], ['Quantidade', '1.5'], ['Custo unitário', '-1'],
    ['Custo unitário', 'abc'], ['Venda unitária', '12.345'],
  ])('bloqueia %s inválido: %s', async (field, value) => {
    await advanceToItems();
    fireEvent.change(screen.getByRole('textbox', { name: new RegExp(`${field} de Monitor`) }), { target: { value } });
    expect(screen.getByRole('button', { name: /Criar Pedido/ })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('valores válidos');
    expect(defaultProps.onChooseFromQuote).not.toHaveBeenCalled();
  });

  it('calls onChooseFromQuote with correct prefill when confirmed', async () => {
    const onChooseFromQuote = vi.fn();
    mockGet.mockResolvedValueOnce({ data: paginatedWithQuote });

    render(
      <AddOrderChooser {...defaultProps} onChooseFromQuote={onChooseFromQuote} />,
      { wrapper: makeWrapper() }
    );

    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));
    await waitFor(() => expect(screen.getByText('Empresa Teste Ltda')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Empresa Teste Ltda'));
    await waitFor(() => expect(screen.getByText(/Monitor Dell/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/i }));

    await waitFor(() => expect(onChooseFromQuote).toHaveBeenCalledTimes(1));

    const [prefill] = onChooseFromQuote.mock.calls[0];
    expect(prefill.customer).toBe('Empresa Teste Ltda');
    expect(prefill.items).toHaveLength(1);
    expect(prefill.items[0].name).toBe('Monitor Dell 27"');
  });
});

describe('AddOrderChooser — busca no servidor', () => {
  beforeEach(() => vi.clearAllMocks());

  const abrirListaEBuscar = async (termo: string) => {
    mockGet.mockResolvedValue({ data: emptyPaginatedResponse });
    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText(/Índice, Cliente/i), { target: { value: termo } });
  };

  it('acessa a segunda pagina e encontra pelo indice uma cotacao fora da pagina inicial', async () => {
    mockGet.mockImplementation(async (_url: string, config: any) => {
      const params = config?.params ?? {};
      const searching = params.busca === '64';
      const secondPage = params.page === 2;
      return { data: {
        items: [searching || secondPage ? mockQuote : { ...mockQuote, id: 'other', numero: 99, cliente: 'Outra empresa' }],
        page: params.page ?? 1, pages: searching ? 1 : 2, limit: 20, total: searching ? 1 : 21,
      } };
    });
    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));
    await screen.findByText('Outra empresa');
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Empresa Teste Ltda');
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Índice, Cliente/i), { target: { value: '64' } });
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/quotes', expect.objectContaining({
      params: expect.objectContaining({ busca: '64', page: 1 }),
    })));
    expect(await screen.findByRole('cell', { name: '64' })).toBeInTheDocument();
  });

  it('manda o termo digitado para o servidor no parâmetro busca', async () => {
    await abrirListaEBuscar('64');

    await waitFor(() => {
      const ultima = mockGet.mock.calls[mockGet.mock.calls.length - 1];
      expect(ultima[1]?.params?.busca).toBe('64');
    });
  });

  it('volta para a página 1 ao buscar, senão a busca herdaria a página anterior', async () => {
    await abrirListaEBuscar('Hospital');

    await waitFor(() => {
      const ultima = mockGet.mock.calls[mockGet.mock.calls.length - 1];
      expect(ultima[1]?.params?.busca).toBe('Hospital');
      expect(ultima[1]?.params?.page).toBe(1);
    });
  });

  it('não refiltra no navegador: a cotação achada pelo índice continua na tela', async () => {
    // O servidor casa o índice exato; "64" não aparece em nenhum campo de texto
    // da linha. Um filtro no navegador esconderia a linha recém-chegada.
    mockGet.mockResolvedValue({ data: paginatedWithQuote });

    render(<AddOrderChooser {...defaultProps} />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));
    await waitFor(() => expect(screen.getByText('Empresa Teste Ltda')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Índice, Cliente/i), { target: { value: '64' } });

    await waitFor(() => {
      const ultima = mockGet.mock.calls[mockGet.mock.calls.length - 1];
      expect(ultima[1]?.params?.busca).toBe('64');
    });
    // Volta assim que a resposta do servidor chega (entre uma e outra a tabela
    // mostra o esqueleto de carregamento).
    await waitFor(() => expect(screen.getByText('Empresa Teste Ltda')).toBeInTheDocument());
  });
});
