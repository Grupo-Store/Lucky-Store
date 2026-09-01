/**
 * Regressão: o imposto da cotação incidia sobre o LUCRO em vez da RECEITA.
 *
 * A conta era `grossProfit × (1 − tax%)`, o que subestimava o imposto e inflava
 * o lucro líquido — numa venda de R$ 19.500 com R$ 1.500 de lucro bruto e 20%,
 * descontava R$ 300 em vez de R$ 3.900, transformando um prejuízo em lucro.
 *
 * A regra do negócio tem duas faces:
 *   - venda normal        → imposto sobre a RECEITA faturada
 *   - fornecimento direto → imposto sobre o LUCRO, porque quem fatura a
 *     mercadoria ao cliente é o fornecedor; à empresa cabe só a comissão
 */
import { describe, it, expect } from 'vitest';

interface ItemNormal { quantity: number; quoteValue: number; closingValue: number }
interface ItemDireto extends ItemNormal { supplierPct: number; supplierFreight: number }

/** Réplica da conta do QuoteModal, para exercitar a regra sem montar o modal. */
function calcular(itens: ItemNormal[], diretos: ItemDireto[], taxPct: number) {
  const totalCost = itens.reduce((s, i) => s + i.quoteValue * i.quantity, 0);
  const totalRevenue = itens.reduce((s, i) => s + i.closingValue * i.quantity, 0);
  const regularGrossProfit = totalRevenue - totalCost;
  const dsInternalProfit = diretos.reduce((s, i) => {
    const lineDiff = (i.closingValue - i.quoteValue) * i.quantity;
    return s + (lineDiff - (lineDiff * i.supplierPct / 100 + i.supplierFreight));
  }, 0);
  const grossProfit = regularGrossProfit + dsInternalProfit;
  const baseImposto = totalRevenue + dsInternalProfit;
  const imposto = baseImposto * (taxPct / 100);
  return { grossProfit, baseImposto, imposto, lucroLiquido: grossProfit - imposto };
}

describe('imposto da cotação', () => {
  it('venda normal: incide sobre a receita, não sobre o lucro', () => {
    // R$ 19.500 de venda, R$ 18.000 de custo -> R$ 1.500 de lucro bruto
    const r = calcular([{ quantity: 1, quoteValue: 18000, closingValue: 19500 }], [], 20);

    expect(r.grossProfit).toBe(1500);
    expect(r.baseImposto).toBe(19500);       // a RECEITA
    expect(r.imposto).toBe(3900);            // 20% de 19.500
    expect(r.lucroLiquido).toBe(-2400);      // prejuízo, e é a verdade

    // a conta antiga daria 20% de 1.500 = 300, e "lucro" de 1.200
    expect(r.imposto).not.toBe(300);
  });

  it('fornecimento direto: incide sobre o lucro, não sobre a receita', () => {
    // venda 10.000, custo 8.000 -> margem 2.000; fornecedor fica com 25% = 500
    // lucro da empresa = 1.500, e é essa a base
    const r = calcular([], [{ quantity: 1, quoteValue: 8000, closingValue: 10000,
                              supplierPct: 25, supplierFreight: 0 }], 20);

    expect(r.grossProfit).toBe(1500);
    expect(r.baseImposto).toBe(1500);        // o LUCRO, não os 10.000 faturados
    expect(r.imposto).toBe(300);
    expect(r.lucroLiquido).toBe(1200);
  });

  it('cotação mista soma as duas bases', () => {
    const r = calcular(
      [{ quantity: 1, quoteValue: 18000, closingValue: 19500 }],
      [{ quantity: 1, quoteValue: 8000, closingValue: 10000, supplierPct: 25, supplierFreight: 0 }],
      20,
    );
    expect(r.baseImposto).toBe(19500 + 1500);  // receita normal + lucro do direto
    expect(r.imposto).toBe(4200);
    expect(r.grossProfit).toBe(3000);
    expect(r.lucroLiquido).toBe(-1200);
  });

  it('imposto zero não altera o lucro bruto', () => {
    const r = calcular([{ quantity: 2, quoteValue: 100, closingValue: 150 }], [], 0);
    expect(r.imposto).toBe(0);
    expect(r.lucroLiquido).toBe(r.grossProfit);
  });

  it('frete do fornecedor reduz a base do direto', () => {
    const r = calcular([], [{ quantity: 1, quoteValue: 8000, closingValue: 10000,
                              supplierPct: 25, supplierFreight: 200 }], 10);
    expect(r.baseImposto).toBe(1300);   // 2.000 − 500 − 200
    expect(r.imposto).toBe(130);
  });
});
