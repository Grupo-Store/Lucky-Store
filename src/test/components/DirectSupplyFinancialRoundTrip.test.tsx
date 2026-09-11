import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { OrderModal } from '@/components/OrderModal';
import { pedidoListToOrder } from '@/lib/order-adapter';
import { calcFinalCost, calcPartialCost, calcProfit } from '@/store/OrderStore';

vi.mock('@/api/hooks/useOrders', () => ({
  useCreateOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateOrderStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useOrderHistory: () => ({ data: undefined, isLoading: false }),
  orderKeys: { all: ['orders'], lists: () => ['orders', 'list'] },
}));
vi.mock('@/hooks/useVendedores', () => ({ useVendedores: () => ({ data: { items: [] } }) }));

// Produced by the real PostgreSQL/API test, never fabricated by this test.
const contractDir = process.env.DIRECT_SUPPLY_CONTRACT_DIR;
describe.skipIf(!contractDir)('financeiro reaberto com a resposta real da API', () => {
  it.each([0, 20])('preserva os campos financeiros com frete da OS de R$ %s', (freight) => {
    const record = JSON.parse(readFileSync(join(contractDir!, `order-freight-${freight}.json`), 'utf8'));
    const order = pedidoListToOrder(record);
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}>
      <OrderModal open order={order} onClose={vi.fn()} onSave={vi.fn()} />
    </QueryClientProvider>);
    const section = document.getElementById('sec-financeiro')!;
    const field = (label: string) => Array.from(section.querySelectorAll('label'))
      .find(l => l.textContent?.trim().startsWith(label))!.parentElement!.querySelector('input')!;
    const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    expect(field('Custo Inicial Produto')).toHaveValue(money(913.5));
    expect(field('Custo Final Produto')).toHaveValue(money(913.5));
    expect(field('Custo Fornecimento Direto')).toHaveValue(money(134.45));
    expect(field('Frete')).toHaveValue(money(freight));
    expect(field('Custo Boleto')).toHaveValue(money(0));
    expect(field('Brinde')).toHaveValue(money(0));
    for (const label of ['Custo Crédito', 'Custo Débito', 'Imposto Compra', 'Imposto Venda']) {
      const row = Array.from(section.querySelectorAll('label'))
        .find(l => l.textContent?.startsWith(label))!.parentElement!;
      expect(row.querySelectorAll('input')[1]).toHaveValue(money(0));
    }
    expect(calcFinalCost(order)).toBeCloseTo(1047.95 + freight, 2);
    expect(calcPartialCost(order)).toBeCloseTo(1047.95 + freight, 2);
    expect(calcProfit(order)).toBeCloseTo(1010.05 - freight, 2);
    expect(document.querySelector('.opm-aside')).toHaveTextContent(freight ? '990,05' : '1.010,05');
    const documentText = document.getElementById('opm-print-root')!;
    const productTable = documentText.querySelector('table')!;
    expect(productTable.querySelector('tbody')).toHaveTextContent('OFFICE PRO PLUS 21');
    expect(productTable.querySelector('tfoot')).toHaveTextContent('913,50');
    expect(productTable.querySelector('tfoot')).toHaveTextContent('2.058,00');
    for (const text of ['Adriano', 'Hospital Jayme da Fonte', 'OFFICE PRO PLUS 21',
      'TECHFORM', '2.058,00', '12 meses', '0131146']) expect(documentText).toHaveTextContent(text);
    qc.clear();
  });
});
