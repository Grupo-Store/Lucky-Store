/**
 * Regressão para as correções de cálculo financeiro.
 *
 * Cada bloco replica a fórmula do código de produção e trava o comportamento
 * CORRIGIDO, deixando explícito no assert qual era o número errado antes.
 *
 * Cobre:
 *   1. QuoteModal — margem bruta (era markup)
 *   2. QuoteModal — imposto sobre a receita (era sobre o lucro bruto)
 *   3. Cotação × Pedido — os dois precisam chegar no mesmo lucro
 *   4. OrderModal — custo final não duplica purchaseValue × quantity
 *   5. ProductModal — Economia compara total com total
 *   6. Dashboard — frete deduzido do lucro
 *   7. Parcelamento — sobra de centavos vai na última parcela
 */
import { describe, it, expect } from 'vitest';
import { calcItemFinalValue, calcDirectSupplyCost } from '@/store/OrderStore';
import type { OrderItem, DirectSupplyOrderItem } from '@/store/OrderStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orderItem(over: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'i1', name: 'Item', quantity: 1, status: 'To Buy',
    projectedValue: 0, purchaseValue: 0,
    ...over,
  };
}

function dsItem(over: Partial<DirectSupplyOrderItem> = {}): DirectSupplyOrderItem {
  return {
    id: 'ds-1', name: 'Produto', quantity: 1,
    projectedValue: 0, purchaseValue: 0, closingValue: 0,
    supplier: '', supplierPct: 0, supplierFreight: 0, supplierInvoice: '',
    ...over,
  };
}

// ─── 1. QuoteModal — margem bruta vs markup ──────────────────────────────────

/** Espelha `margin` em QuoteModal.tsx */
function quoteMargin(allRevenue: number, allCost: number): number {
  return allRevenue > 0 ? ((allRevenue - allCost) / allRevenue) * 100 : 0;
}

describe('QuoteModal — margem bruta', () => {

  it('R$1.000 de receita com R$800 de custo dá 20%, não os 25% do markup', () => {
    expect(quoteMargin(1000, 800)).toBeCloseTo(20, 6);
    // markup antigo: (1000/800 - 1) * 100
    expect(((1000 / 800) - 1) * 100).toBeCloseTo(25, 6);
  });

  it('margem é 0 quando receita e custo são iguais', () => {
    expect(quoteMargin(500, 500)).toBe(0);
  });

  it('margem é negativa quando o custo supera a receita', () => {
    expect(quoteMargin(800, 1000)).toBeCloseTo(-25, 6);
  });

  it('margem é 0 (e não NaN/Infinity) quando a receita é zero', () => {
    expect(quoteMargin(0, 800)).toBe(0);
  });

  it('margem nunca passa de 100% (custo zero é o teto)', () => {
    expect(quoteMargin(1000, 0)).toBeCloseTo(100, 6);
  });
});

// ─── 2. QuoteModal — imposto sobre a receita ─────────────────────────────────

/** Espelha profitLucky/profitBTech em QuoteModal.tsx */
function quoteNetProfit(grossProfit: number, companyRevenue: number, taxPct: number): number {
  return grossProfit - companyRevenue * (taxPct / 100);
}

describe('QuoteModal — imposto incide sobre a receita', () => {

  it('venda 1.000, custo 800, imposto 10% → lucro R$100 (antes dava R$180)', () => {
    const grossProfit = 1000 - 800;
    expect(quoteNetProfit(grossProfit, 1000, 10)).toBeCloseTo(100, 6);
    // fórmula antiga: grossProfit * (1 - tax/100)
    expect(grossProfit * (1 - 10 / 100)).toBeCloseTo(180, 6);
  });

  it('imposto zero devolve o lucro bruto intacto', () => {
    expect(quoteNetProfit(200, 1000, 0)).toBe(200);
  });

  it('o lucro pode ficar negativo quando o imposto supera a margem', () => {
    // margem de 5% com imposto de 10% sobre a receita
    expect(quoteNetProfit(50, 1000, 10)).toBeCloseTo(-50, 6);
  });

  it('a base do imposto exclui a parte do fornecedor direto', () => {
    const item = dsItem({ quantity: 2, purchaseValue: 600, closingValue: 1000, supplierPct: 10, supplierFreight: 50 });
    const supplierCost = calcDirectSupplyCost([item]);  // 130
    const companyRevenue = 2000 - supplierCost;         // 1870
    expect(companyRevenue).toBe(1870);
    expect(companyRevenue * 0.05).toBeCloseTo(93.5, 2);
  });
});

// ─── 3. Cotação e Pedido precisam convergir ──────────────────────────────────

describe('Cotação × Pedido — mesmo imposto, mesmo resultado', () => {

  /** Espelha `computed.salesTaxValue` em OrderModal.tsx */
  const orderTax = (companyRevenue: number, pct: number) => companyRevenue * pct / 100;

  it('os dois módulos calculam o mesmo imposto para a mesma venda', () => {
    const revenue = 1000, taxPct = 10;
    const impostoPedido = orderTax(revenue, taxPct);
    const impostoCotacao = revenue * (taxPct / 100);
    expect(impostoCotacao).toBe(impostoPedido);
  });

  it('os dois módulos calculam o mesmo lucro líquido', () => {
    const revenue = 1000, cost = 800, taxPct = 10;
    const lucroCotacao = quoteNetProfit(revenue - cost, revenue, taxPct);
    const lucroPedido = revenue - cost - orderTax(revenue, taxPct);
    expect(lucroCotacao).toBeCloseTo(lucroPedido, 6);
    expect(lucroCotacao).toBeCloseTo(100, 6);
  });

  it('convergem também com fornecimento direto na jogada', () => {
    const item = dsItem({ quantity: 1, purchaseValue: 600, closingValue: 1000, supplierPct: 10 });
    const supplierCost = calcDirectSupplyCost([item]);   // (1000-600)*1*10% = 40
    const companyRevenue = 1000 - supplierCost;          // 960
    const taxPct = 10;
    const grossProfit = (1000 - 600) - supplierCost;     // 360
    const lucroCotacao = quoteNetProfit(grossProfit, companyRevenue, taxPct);
    const lucroPedido = grossProfit - orderTax(companyRevenue, taxPct);
    expect(lucroCotacao).toBeCloseTo(lucroPedido, 6);
    expect(supplierCost).toBe(40);
  });
});

// ─── 4. OrderModal — custo final sem duplicação ──────────────────────────────

/** Espelha `derivedFinalProductCost` em OrderModal.tsx */
function derivedFinalProductCost(items: OrderItem[], ds: DirectSupplyOrderItem[]): number {
  const regular = items.reduce((s, i) => s + calcItemFinalValue(i), 0);
  const dsTotal = ds.reduce((s, i) => s + (i.purchaseValue || 0) * (i.quantity || 0), 0);
  return regular + dsTotal;
}

describe('derivedFinalProductCost — purchaseValue de item normal é TOTAL', () => {

  it('não multiplica por quantity: qty=2 com R$1.000 total continua R$1.000', () => {
    const item = orderItem({ quantity: 2, purchaseValue: 1000 });
    expect(derivedFinalProductCost([item], [])).toBe(1000);
    // comportamento antigo duplicava:
    expect(1000 * 2).toBe(2000);
  });

  it('usa a soma das sub-compras quando elas existem', () => {
    const item = orderItem({
      quantity: 3, purchaseValue: 999,
      subPurchases: [
        { id: 'a', selectedQuantity: 2, supplier: '', buyer: '', purchaseValue: 400, paymentMethod: '', status: 'Bought' },
        { id: 'b', selectedQuantity: 1, supplier: '', buyer: '', purchaseValue: 250, paymentMethod: '', status: 'Bought' },
      ],
    });
    expect(derivedFinalProductCost([item], [])).toBe(650);
  });

  it('item de fornecimento direto SIM é multiplicado (valor unitário)', () => {
    const ds = dsItem({ quantity: 3, purchaseValue: 100 });
    expect(derivedFinalProductCost([], [ds])).toBe(300);
  });

  it('soma normais e diretos com as regras corretas de cada um', () => {
    const item = orderItem({ quantity: 2, purchaseValue: 1000 });   // total → 1000
    const ds = dsItem({ quantity: 3, purchaseValue: 100 });         // unitário → 300
    expect(derivedFinalProductCost([item], [ds])).toBe(1300);
  });

  it('é zero sem itens', () => {
    expect(derivedFinalProductCost([], [])).toBe(0);
  });
});

// ─── 5. ProductModal — Economia ──────────────────────────────────────────────

/** Espelha `savings` em ProductModal.tsx */
function productSavings(projectedUnit: number, quantity: number, subPurchaseTotal: number): number {
  return projectedUnit * quantity - subPurchaseTotal;
}

describe('ProductModal — Economia com sinal correto', () => {

  it('qty=2, projetado R$600/un, real R$1.000 total → economia de +R$200', () => {
    expect(productSavings(600, 2, 1000)).toBe(200);
    // antes comparava unitário com total: 600 - 1000 = -400 ("Estouro")
    expect(600 - 1000).toBe(-400);
  });

  it('mostra estouro quando o custo real supera o projetado', () => {
    expect(productSavings(500, 2, 1200)).toBe(-200);
  });

  it('economia zero quando bate exatamente', () => {
    expect(productSavings(500, 2, 1000)).toBe(0);
  });

  it('funciona com quantidade 1 (caso que já passava antes)', () => {
    expect(productSavings(600, 1, 500)).toBe(100);
  });
});

// ─── 6. Dashboard — frete deduzido do lucro ──────────────────────────────────

/** Espelha `lucro` e `margem` em services/dashboard.py */
function dashboardProfit(receita: number, custo: number, frete: number) {
  const lucro = receita - custo - frete;
  return { lucro, margem: receita > 0 ? lucro / receita : 0 };
}

describe('Dashboard — frete entra no P&L', () => {

  it('R$10.000 de receita, R$6.000 de custo e R$500 de frete → lucro R$3.500', () => {
    const { lucro } = dashboardProfit(10000, 6000, 500);
    expect(lucro).toBe(3500);
    // antes o frete era ignorado e o lucro aparecia inflado
    expect(10000 - 6000).toBe(4000);
  });

  it('a margem acompanha a dedução do frete', () => {
    const { margem } = dashboardProfit(10000, 6000, 500);
    expect(margem).toBeCloseTo(0.35, 4);
  });

  it('sem frete o resultado é o mesmo de antes', () => {
    expect(dashboardProfit(10000, 6000, 0).lucro).toBe(4000);
  });

  it('frete pode empurrar o lucro para negativo', () => {
    expect(dashboardProfit(1000, 900, 200).lucro).toBe(-100);
  });

  it('margem é 0 quando não há receita', () => {
    expect(dashboardProfit(0, 0, 100).margem).toBe(0);
  });
});

// ─── 7. Parcelamento sem centavos perdidos ───────────────────────────────────

/** Espelha a geração de plano de parcelas em ExpenseModal.tsx */
function installments(baseValue: number, n: number): number[] {
  if (n <= 0) return [];
  const valuePer = +(baseValue / n).toFixed(2);
  const last = +(baseValue - valuePer * (n - 1)).toFixed(2);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? last : valuePer));
}

describe('Parcelamento — a soma bate com o total', () => {

  it('R$100 em 3x soma exatamente R$100', () => {
    const p = installments(100, 3);
    expect(p).toEqual([33.33, 33.33, 33.34]);
    expect(+p.reduce((s, v) => s + v, 0).toFixed(2)).toBe(100);
    // antes: 33,33 × 3 = 99,99
  });

  it('divisão exata não cria sobra', () => {
    expect(installments(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it('parcela única devolve o valor cheio', () => {
    expect(installments(99.99, 1)).toEqual([99.99]);
  });

  it('a soma fecha para vários totais e números de parcelas', () => {
    for (const total of [10, 100, 999.99, 1234.56]) {
      for (const n of [1, 2, 3, 6, 7, 12]) {
        const soma = +installments(total, n).reduce((s, v) => s + v, 0).toFixed(2);
        expect(soma).toBe(total);
      }
    }
  });

  it('zero parcelas devolve lista vazia', () => {
    expect(installments(100, 0)).toEqual([]);
  });
});
