/**
 * Criar a OS a partir de uma cotação tem que trazer o preço do cliente junto.
 *
 * Existem dois caminhos para uma cotação virar OS, e os dois tinham o mesmo
 * buraco:
 *
 *  1. a conversão no backend (`conversao_cotacao.py`), que gravava o preço do
 *     cliente emprestado em `valor_compra` e o perdia na primeira compra;
 *  2. esta tela — "Cadastrar a partir de cotação" —, que montava os itens do
 *     pedido só com `valor_unitario` (o CUSTO) e simplesmente descartava o
 *     `valor_fechamento`.
 *
 * O primeiro foi consertado com o campo `valor_venda`. Sem consertar o segundo,
 * toda OS aberta por aqui nasceria sem preço de venda nenhum e o documento
 * sairia com travessão na coluna — o defeito de novo, por outra porta.
 *
 * O teste anda pela tela como a pessoa anda e lê o `prefill` que sai dela.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { AddOrderChooser, type OrderPrefill } from '@/components/AddOrderChooser';
import { OrderModal } from '@/components/OrderModal';
import { calcDirectSupplyCost, calcProfit } from '@/store/OrderStore';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
const { mockCreateOrder } = vi.hoisted(() => ({ mockCreateOrder: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/hooks/useOrders', () => ({
  useCreateOrder: () => ({ mutate: mockCreateOrder, isPending: false }),
  useUpdateOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useOrderHistory: () => ({ data: undefined, isLoading: false }),
  orderKeys: { all: ['orders'], lists: () => ['orders', 'list'] },
}));
vi.mock('@/hooks/useVendedores', () => ({
  useVendedores: () => ({ data: { items: [
    { id: 'uuid-alcides', nome: 'Alcides', id_loja: 'uuid-lucky', email: null, phone: null },
  ] } }),
}));
vi.mock('@/api/client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a) },
  getApiError: (e: unknown) => String(e),
}));
vi.mock('@/api/storeConfig', () => ({
  LOJA_IDS: { 'Lucky Store': 'uuid-lucky' },
  LOJA_BY_ID: { 'uuid-lucky': 'Lucky Store' },
  VENDEDOR_IDS: {},
  VENDEDOR_BY_ID: { 'uuid-alcides': 'Alcides' },
  FORMA_PAGAMENTO_MAP: {},
}));

const COTACAO = {
  id: 'cot-1', numero: 45, id_loja: 'uuid-lucky', id_vendedor: 'uuid-alcides',
  cliente: 'Ricardo', b2b_company: 'Tech Corp', cnpj_cliente: '12.345.678/0001-99',
  data_cotacao: '2026-09-01', valor_total: '12960.00',
  status_fechada: true, status_caida: false, is_direct_billing: false,
  previsao_entrega: '2026-09-25', forma_pagamento: 'Pix',
  detalhes_pagamento: 'Pagamento na entrega', garantia: '12 meses',
  observacao: 'Entregar na recepção',
  itens: [
    {
      id: 'ic-1', descricao: 'Notebook', quantidade: 2,
      // O caso comum: cota-se o preço do cliente e o custo ainda é zero.
      valor_unitario: '0.00', valor_fechamento: '6480.00',
      is_direct_supply: false, fornecedor: null,
      porcentagem_fornecedor: null, frete_fornecedor: null,
    },
  ],
};

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

/** Percorre a tela até confirmar, e devolve o prefill entregue ao pedido. */
async function criarPedidoDaCotacao(excludedItem?: string) {
  const onChooseFromQuote = vi.fn();
  const chooser = render(
    <AddOrderChooser open onClose={vi.fn()} quotes={[]}
      onChooseNew={vi.fn()} onChooseFromQuote={onChooseFromQuote} />,
    { wrapper: wrapper() },
  );
  fireEvent.click(screen.getByText(/Cadastrar a partir de cotação/i));
  fireEvent.click(await screen.findByText('Tech Corp'));
  if (excludedItem) fireEvent.click(await screen.findByText(excludedItem));
  fireEvent.click(await screen.findByRole('button', { name: /Criar Pedido/i }));
  await waitFor(() => expect(onChooseFromQuote).toHaveBeenCalled());
  chooser.unmount();
  return onChooseFromQuote.mock.calls[0][0] as OrderPrefill;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { items: [COTACAO], total: 1, page: 1, pages: 1 } });
});

describe('pedido criado a partir de uma cotação', () => {
  it('preserva custo, venda, fornecedor e lucro do faturamento direto até salvar a OS', async () => {
    mockGet.mockResolvedValue({ data: {
      items: [{ ...COTACAO, numero: 86, valor_total: '2058.00', is_direct_billing: true,
        itens: [{ ...COTACAO.itens[0], descricao: 'OFFICE PRO PLUS 21', quantidade: 3,
          valor_unitario: '304.50', valor_fechamento: '686.00', is_direct_supply: true,
          fornecedor: 'TECHFORM', porcentagem_fornecedor: '10', frete_fornecedor: '20.00' }],
      }], total: 1, page: 1, pages: 1,
    } });
    const prefill = await criarPedidoDaCotacao();
    expect(prefill.salesValue).toBe(2058);
    expect(prefill.directSupplyItems[0]).toMatchObject({
      quantity: 3, purchaseValue: 304.5, projectedValue: 304.5, closingValue: 686,
      supplier: 'TECHFORM', supplierPct: 10, supplierFreight: 20,
    });
    expect(calcDirectSupplyCost(prefill.directSupplyItems)).toBeCloseTo(134.45, 2);
    expect(calcProfit({ salesValue: prefill.salesValue, directSupplyItems: prefill.directSupplyItems,
      finalProductCost: 913.5 })).toBeCloseTo(1010.05, 2);

    render(<OrderModal open prefill={prefill} onClose={vi.fn()} onSave={vi.fn()} />,
      { wrapper: wrapper() });
    expect(document.querySelector('.opm-aside')).toHaveTextContent('1.010,05');
    fireEvent.change(screen.getByPlaceholderText('Ex: OC-1234'), { target: { value: '0131146' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/i }));
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      valor_venda: '2058', custo: expect.objectContaining({ custo_produto_final: '913.5' }),
      itens: [expect.objectContaining({ preco_custo: 304.5, valor_compra: 686, quantidade: 3,
        frete_fornecedor: '20', porcentagem_fornecedor: '10', is_direct_supply: true })],
    }) }), expect.anything());
  });

  it('o total da OS considera apenas os itens selecionados da cotação', async () => {
    mockGet.mockResolvedValue({ data: { items: [{ ...COTACAO, valor_total: '2158',
      itens: [{ ...COTACAO.itens[0], quantidade: 3, valor_fechamento: '686' },
        { ...COTACAO.itens[0], id: 'excluded', descricao: 'Item não selecionado',
          quantidade: 1, valor_fechamento: '100', is_direct_supply: true }],
    }], total: 1, page: 1, pages: 1 } });
    const prefill = await criarPedidoDaCotacao('Item não selecionado');
    expect(prefill.salesValue).toBe(2058);
    expect(prefill.directBilling).toBe(false);
    expect(prefill.directSupplyItems).toEqual([]);
  });

  it('leva identificação, contato, vendedor e condições até o documento antes de salvar', async () => {
    const prefill = await criarPedidoDaCotacao();
    render(<OrderModal open prefill={prefill} onClose={vi.fn()} onSave={vi.fn()} />,
      { wrapper: wrapper() });
    const documento = document.getElementById('opm-print-root');
    for (const texto of ['Tech Corp', 'Ricardo', '12.345.678/0001-99', 'Alcides',
      'Cotação nº 45', '25/09/2026', 'Pix', 'Pagamento na entrega', '12 meses',
      'Entregar na recepção', 'Notebook', '12.960,00']) {
      expect(documento).toHaveTextContent(texto);
    }
  });

  it('preserva o cliente quando a cotação não tem empresa separada', async () => {
    mockGet.mockResolvedValue({ data: {
      items: [{ ...COTACAO, b2b_company: null, cliente: 'Tech Corp' }],
      total: 1, page: 1, pages: 1,
    } });
    const prefill = await criarPedidoDaCotacao();
    expect(prefill.customerContact).toBe('Tech Corp');
  });

  it('envia o contato importado e o vínculo com a cotação ao salvar', async () => {
    const prefill = await criarPedidoDaCotacao();
    render(<OrderModal open prefill={prefill} onClose={vi.fn()} onSave={vi.fn()} />,
      { wrapper: wrapper() });
    fireEvent.change(screen.getByPlaceholderText('Ex: OC-1234'), { target: { value: 'OC-45' } });
    const custo = screen.getByPlaceholderText('Custo Projetado R$');
    fireEvent.focus(custo);
    fireEvent.change(custo, { target: { value: '4100' } });
    fireEvent.blur(custo);
    fireEvent.click(screen.getByRole('button', { name: /Criar Pedido/i }));
    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      nome_cliente: 'Tech Corp', contato_cliente: 'Ricardo', id_cotacao: 'cot-1',
      id_vendedor: 'uuid-alcides',
    }) }), expect.anything());
  });

  it('leva o valor fechado como preço de venda do item', async () => {
    const prefill = await criarPedidoDaCotacao();
    expect(prefill.items[0].saleValue).toBe(6480);
  });

  it('não confunde o preço de venda com o custo', async () => {
    // `projectedValue` é o custo da cotação, que aqui é zero. Se o preço de
    // venda viesse dele, a coluna do documento zerava — foi assim que o
    // defeito original apareceu.
    const prefill = await criarPedidoDaCotacao();
    expect(prefill.items[0].projectedValue).toBe(0);
    expect(prefill.items[0].saleValue).toBeDefined();
    expect(prefill.items[0].saleValue).not.toBe(prefill.items[0].projectedValue);
  });

  it('item sem valor fechado fica sem preço, e não com zero', async () => {
    mockGet.mockResolvedValue({ data: {
      items: [{ ...COTACAO, itens: [{ ...COTACAO.itens[0], valor_fechamento: null }] }],
      total: 1, page: 1, pages: 1,
    } });
    const prefill = await criarPedidoDaCotacao();
    expect(prefill.items[0].saleValue).toBeUndefined();
  });
});
