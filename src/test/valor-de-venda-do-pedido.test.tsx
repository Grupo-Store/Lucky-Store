/**
 * O Resumo de Valores do pedido lia um "Valor de Venda" que ninguém preenchia.
 *
 * Havia dois campos com o mesmo nome. O da linha do item (`saleValue`) é onde o
 * vendedor informa por quanto vendeu cada unidade — ele alimentava só o papel da
 * OS. O do resumo era `salesValue`, um campo solto na seção Geral, sem ligação
 * nenhuma com as linhas.
 *
 * Quem preenchia o Val. Venda do item via o resumo em R$ 0,00 e o "Lucro do
 * Pedido" igual ao custo inteiro, negativo — sem nenhum erro na tela dizendo o
 * que faltava.
 *
 * Aqui se lê o que aparece no RESUMO, não o cálculo por dentro: o defeito era
 * exatamente a tela mostrar um número que o cálculo nunca recebeu.
 */
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { OrderModal } from '@/components/OrderModal';
import { ProductModal } from '@/components/ProductModal';
import { calcOrderSalesValue } from '@/store/OrderStore';
import type { Order, OrderItem } from '@/store/OrderStore';

vi.mock('@/api/hooks/useOrders', () => ({
  useCreateOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useOrderHistory: () => ({ data: undefined, isLoading: false }),
  orderKeys: {
    all: ['orders'], lists: () => ['orders', 'list'],
    list: (f: unknown) => ['orders', 'list', f],
    details: () => ['orders', 'detail'], detail: (id: string) => ['orders', 'detail', id],
    history: (id: string) => ['orders', 'history', id],
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/client', () => ({
  apiClient: {
    put: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  getApiError: (e: unknown) => String(e),
}));
vi.mock('@/api/storeConfig', () => ({
  LOJA_IDS: { 'Lucky Store': 'uuid-lucky' },
  VENDEDOR_IDS: {},
  FORMA_PAGAMENTO_MAP: { Pix: 'pix' },
}));
vi.mock('@/hooks/useVendedores', () => ({
  useVendedores: () => ({ data: { items: [] }, isLoading: false }),
}));
vi.mock('@/hooks/useOrderHistory', () => ({ useOrderHistory: () => ({ data: undefined, isLoading: false }) }));
vi.mock('@/components/StatusTimeline', () => ({ StatusTimeline: () => null, ItemStatusTimeline: () => null }));

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
};

/** O R$ do Intl vem com espaço fino (U+202F); comparar com espaço comum não casa. */
const texto = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Valor da linha do Resumo com este rótulo (Valor de Venda, Custo final...). */
function linhaDoResumo(rotulo: string): string {
  const linha = [...document.querySelectorAll('.opm-aside .opm-line')]
    .find(l => texto(l.querySelector('.k')?.textContent) === rotulo);
  expect(linha, `não achei a linha "${rotulo}" no Resumo de Valores`).toBeTruthy();
  return texto(linha!.querySelector('.v')?.textContent);
}

/** Valor do card de resultado (Lucro parcial / Lucro do pedido). */
function cardDeLucro(rotulo: string): string {
  const card = [...document.querySelectorAll('.opm-aside .opm-result')]
    .find(c => texto(c.querySelector('.lk')?.textContent) === rotulo);
  expect(card, `não achei o card "${rotulo}"`).toBeTruthy();
  return texto(card!.querySelector('.lv')?.textContent);
}

/** O caso relatado: 30 unidades, custo projetado 175, compra 170, venda 175. */
function item(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'i1', name: 'Produto', quantity: 30, status: 'To Buy',
    projectedValue: 175, purchaseValue: 170, saleValue: 175,
    ...over,
  } as OrderItem;
}

function pedido(itens: OrderItem[], over: Partial<Order> = {}): Order {
  return {
    id: 'order-uuid', os: '1001', createdAt: 1000000,
    orderDate: '2026-01-01', customer: 'Tech Corp', cnpj: '12.345.678/0001-99',
    company: 'Lucky Store', seller: '', ocAfPed: '',
    directBilling: false, supplier: '', invoice: '', invoiceSupplier: '',
    paymentMethods: [], installments: 1, deliveryDate: '',
    status: 'To Buy', isRMA: false,
    // Zero de propósito: é o campo que ficava para trás.
    salesValue: 0,
    items: itens, directSupplyItems: [], freight: [], observations: '',
    ...over,
  } as unknown as Order;
}

function abrir(itens: OrderItem[], over: Partial<Order> = {}) {
  render(<OrderModal open order={pedido(itens, over)} onClose={vi.fn()} onSave={vi.fn()} nextOS={() => '1001'} />,
    { wrapper: wrapper() });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('calcOrderSalesValue', () => {
  it('soma o valor de venda de cada item pela quantidade dele', () => {
    expect(calcOrderSalesValue([{ saleValue: 175, quantity: 30 }])).toBe(5250);
  });

  it('soma itens normais e de fornecimento direto', () => {
    // No fornecimento direto o preço do cliente mora em closingValue.
    expect(calcOrderSalesValue(
      [{ saleValue: 100, quantity: 2 }],
      [{ closingValue: 50, quantity: 3 }],
    )).toBe(350);
  });

  it('não confunde custo com venda: item sem preço de venda não soma nada', () => {
    expect(calcOrderSalesValue([{ quantity: 30 } as never])).toBe(0);
  });
});

describe('Resumo de Valores do pedido', () => {
  it('mostra o valor de venda somado dos itens, e não o campo digitado à parte', () => {
    abrir([item()]);
    // 175 × 30. Antes: R$ 0,00, porque lia salesValue, que ninguém preenchia.
    expect(linhaDoResumo('Valor de Venda')).toBe('R$ 5.250,00');
  });

  it('o lucro do pedido é a venda menos a compra, os dois × quantidade', () => {
    abrir([item()]);
    // Compra 170 × 30 = 5.100. Antes o custo final parava em R$ 170,00, porque
    // o valor de compra entrava na conta sem multiplicar.
    expect(linhaDoResumo('Custo final')).toBe('R$ 5.100,00');
    expect(cardDeLucro('Lucro do pedido')).toBe('R$ 150,00');
  });

  it('o lucro parcial usa o mesmo valor de venda', () => {
    abrir([item()]);
    // Custo parcial 175 × 30 = 5.250, então o lucro parcial zera.
    expect(linhaDoResumo('Custo parcial')).toBe('R$ 5.250,00');
    expect(cardDeLucro('Lucro parcial')).toBe('R$ 0,00');
  });

  it('acompanha a quantidade', () => {
    abrir([item({ quantity: 10 })]);
    expect(linhaDoResumo('Valor de Venda')).toBe('R$ 1.750,00');
  });

  it('sem valor de venda nas linhas, o total digitado no pedido continua valendo', () => {
    // Pedidos antigos e os que só têm um total fechado não podem zerar.
    abrir([item({ saleValue: 0 })], { salesValue: 9000 } as Partial<Order>);
    expect(linhaDoResumo('Valor de Venda')).toBe('R$ 9.000,00');
  });
});

describe('Modal de Produto', () => {
  const abrirProduto = (over: Partial<OrderItem> = {}) => {
    const it: OrderItem = {
      id: 'item-1', name: 'Produto', quantity: 30, status: 'To Buy',
      projectedValue: 175, purchaseValue: 0,
      subPurchases: [{
        // 30 unidades a R$170 = R$5.100.
        id: 'sub-1', selectedQuantity: 30, supplier: 'Fornecedor', buyer: '',
        purchaseValue: 170, paymentMethod: '', status: 'To Buy',
      }],
      ...over,
    } as OrderItem;
    const order = { id: 'order-1', os: 'OS-1', customer: 'Tech Corp', items: [it] } as Order;
    render(<ProductModal open onClose={vi.fn()} order={order} item={it} onSave={vi.fn()} />,
      { wrapper: wrapper() });
  };

  const linhaPm = (rotulo: string) => {
    const linha = [...document.querySelectorAll('.pm-line')]
      .find(l => texto(l.querySelector('.k')?.textContent).startsWith(rotulo));
    expect(linha, `não achei a linha "${rotulo}"`).toBeTruthy();
    return texto(linha!.querySelector('.v')?.textContent);
  };

  it('o valor projetado é o da linha inteira, não o de uma unidade', () => {
    abrirProduto();
    // 175 × 30. Antes mostrava R$ 175,00 ao lado de um total de compras.
    expect(linhaPm('Valor Projetado')).toBe('R$ 5.250,00');
  });

  it('a economia compara projetado e comprado na mesma grandeza', () => {
    abrirProduto();
    expect(linhaPm('Valor Final')).toBe('R$ 5.100,00');
    // 5.250 − 5.100. Antes saía de 175 − 5.100, um número sem sentido.
    const economia = texto(document.querySelector('.pm-result .lv')?.textContent);
    expect(economia).toBe('R$ 150,00');
  });
});
