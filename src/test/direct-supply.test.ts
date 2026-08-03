/**
 * Unit tests for direct-supply / b2b_company features introduced in
 * feature/list-view-integration.
 *
 * Covers:
 *   1. cotacaoToQuote — directBilling uses is_direct_billing flag, not heuristic
 *   2. b2b_company display logic — company name takes priority over cliente
 *   3. dsChanged detection — field-level comparison for DS items
 *   4. getCotacaoPhase — quote phase priority order
 *   5. cleanStr — sanitises API string values
 */
import { describe, it, expect } from 'vitest';
import { calcDirectSupplyCost, calcCompanyRevenue } from '@/store/OrderStore';
import type { DirectSupplyOrderItem } from '@/store/OrderStore';

// ─── Minimal type replicas (mirrors src/types/api.ts) ─────────────────────────

interface ItemCotacao {
  id: string;
  id_cotacao: string;
  descricao: string;
  quantidade: number;
  valor_unitario: string;
  valor_total: string;
  valor_fechamento: string | null;
  valor_total_fechamento: string | null;
  fornecedor: string | null;
  is_direct_supply: boolean;
  porcentagem_fornecedor: string | null;
  frete_fornecedor: string | null;
}

interface CotacaoResponse {
  id: string;
  id_loja: string;
  id_vendedor: string;
  cliente: string;
  cnpj_cliente: string | null;
  numero_requisicao: string | null;
  data_cotacao: string;
  data_validade: string | null;
  b2b_company: string | null;
  is_direct_billing: boolean;
  fornecedor: string | null;
  valor_total: string | null;
  pct_imposto_lucky: string | null;
  pct_imposto_btech: string | null;
  observacao: string | null;
  status_enviada: boolean;
  data_envio: string | null;
  status_em_fechamento: boolean;
  data_prevista_fechamento: string | null;
  status_fechada: boolean;
  data_fechamento: string | null;
  valor_fechamento: string | null;
  status_caida: boolean;
  data_queda: string | null;
  itens: ItemCotacao[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Replicated logic (mirrors Sales.tsx exactly) ─────────────────────────────

function cleanStr(v: string | null | undefined): string {
  const s = v?.trim() ?? '';
  return s === 'string' ? '' : s;
}

function cotacaoToQuoteDirectBilling(c: CotacaoResponse): boolean {
  const hasDirect = (c.itens ?? []).some(i => i.is_direct_supply);
  return c.is_direct_billing || hasDirect;
}

function getQuoteDisplayClient(c: Pick<CotacaoResponse, 'b2b_company' | 'cliente'>): string {
  return (c.b2b_company?.trim() || c.cliente);
}

// Quote phase priority (mirrors getCotacaoPhase in Sales.tsx and AddOrderChooser.tsx)
type QuotePhaseKey = 'dropped' | 'closed' | 'forClosing' | 'sent';

function getCotacaoPhase(c: Pick<CotacaoResponse,
  'status_caida' | 'status_fechada' | 'status_em_fechamento' | 'status_enviada'>
): QuotePhaseKey | null {
  if (c.status_caida)          return 'dropped';
  if (c.status_fechada)        return 'closed';
  if (c.status_em_fechamento)  return 'forClosing';
  if (c.status_enviada)        return 'sent';
  return null;
}

// DS item change detection (mirrors OrderModal.tsx dsChanged logic)
interface DsItem {
  id: string;
  name: string;
  quantity: number;
  projectedValue: number;
  closingValue: number;
  supplier: string;
  supplierPct: number;
  supplierFreight: number;
  supplierInvoice: string;
}

function computeDsChanged(origItems: DsItem[], currItems: DsItem[]): boolean {
  if (origItems.length !== currItems.length) return true;
  return currItems.some(curr => {
    const orig = origItems.find(x => x.id === curr.id);
    return (
      !orig ||
      orig.name           !== curr.name           ||
      orig.quantity       !== curr.quantity        ||
      orig.projectedValue !== curr.projectedValue  ||
      orig.closingValue   !== curr.closingValue    ||
      orig.supplier       !== curr.supplier        ||
      orig.supplierPct    !== curr.supplierPct     ||
      orig.supplierFreight !== curr.supplierFreight ||
      orig.supplierInvoice !== curr.supplierInvoice
    );
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function baseCotacao(overrides: Partial<CotacaoResponse> = {}): CotacaoResponse {
  return {
    id: 'cot-1',
    id_loja: 'loja-1',
    id_vendedor: 'vend-1',
    cliente: 'João Silva',
    cnpj_cliente: null,
    numero_requisicao: null,
    data_cotacao: '2026-05-01',
    data_validade: null,
    b2b_company: null,
    is_direct_billing: false,
    fornecedor: null,
    valor_total: '1000.00',
    pct_imposto_lucky: null,
    pct_imposto_btech: null,
    observacao: null,
    status_enviada: false,
    data_envio: null,
    status_em_fechamento: false,
    data_prevista_fechamento: null,
    status_fechada: false,
    data_fechamento: null,
    valor_fechamento: null,
    status_caida: false,
    data_queda: null,
    itens: [],
    created_by: 'vend-1',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

function baseDsItem(overrides: Partial<DsItem> = {}): DsItem {
  return {
    id: 'ds-1',
    name: 'Produto X',
    quantity: 2,
    projectedValue: 500,
    closingValue: 480,
    supplier: 'Fornecedor A',
    supplierPct: 10,
    supplierFreight: 50,
    supplierInvoice: 'NF-001',
    ...overrides,
  };
}

// ─── 1. directBilling derivation ──────────────────────────────────────────────

describe('cotacaoToQuote — directBilling', () => {

  it('is false when is_direct_billing is false and no DS items', () => {
    const c = baseCotacao({ is_direct_billing: false, itens: [] });
    expect(cotacaoToQuoteDirectBilling(c)).toBe(false);
  });

  it('is true when is_direct_billing flag is true, even with no DS items', () => {
    const c = baseCotacao({ is_direct_billing: true, itens: [] });
    expect(cotacaoToQuoteDirectBilling(c)).toBe(true);
  });

  it('is true when any item has is_direct_supply=true, even if flag is false', () => {
    const dsItem: ItemCotacao = {
      id: 'i1', id_cotacao: 'cot-1', descricao: 'Item DS',
      quantidade: 1, valor_unitario: '100', valor_total: '100',
      valor_fechamento: null, valor_total_fechamento: null,
      fornecedor: null, is_direct_supply: true,
      porcentagem_fornecedor: null, frete_fornecedor: null,
    };
    const c = baseCotacao({ is_direct_billing: false, itens: [dsItem] });
    expect(cotacaoToQuoteDirectBilling(c)).toBe(true);
  });

  it('is true when both flag and DS items are present', () => {
    const dsItem: ItemCotacao = {
      id: 'i1', id_cotacao: 'cot-1', descricao: 'Item DS',
      quantidade: 1, valor_unitario: '100', valor_total: '100',
      valor_fechamento: null, valor_total_fechamento: null,
      fornecedor: null, is_direct_supply: true,
      porcentagem_fornecedor: null, frete_fornecedor: null,
    };
    const c = baseCotacao({ is_direct_billing: true, itens: [dsItem] });
    expect(cotacaoToQuoteDirectBilling(c)).toBe(true);
  });

  it('is false when only regular items are present', () => {
    const normalItem: ItemCotacao = {
      id: 'i1', id_cotacao: 'cot-1', descricao: 'Normal',
      quantidade: 1, valor_unitario: '100', valor_total: '100',
      valor_fechamento: null, valor_total_fechamento: null,
      fornecedor: null, is_direct_supply: false,
      porcentagem_fornecedor: null, frete_fornecedor: null,
    };
    const c = baseCotacao({ is_direct_billing: false, itens: [normalItem] });
    expect(cotacaoToQuoteDirectBilling(c)).toBe(false);
  });

  it('is false when itens is undefined (treated as empty)', () => {
    const c = { ...baseCotacao({ is_direct_billing: false }), itens: undefined as unknown as ItemCotacao[] };
    expect(cotacaoToQuoteDirectBilling(c)).toBe(false);
  });
});

// ─── 2. b2b_company display logic ─────────────────────────────────────────────

describe('getQuoteDisplayClient — b2b_company priority', () => {

  it('returns cliente when b2b_company is null', () => {
    expect(getQuoteDisplayClient({ b2b_company: null, cliente: 'João Silva' })).toBe('João Silva');
  });

  it('returns cliente when b2b_company is empty string', () => {
    expect(getQuoteDisplayClient({ b2b_company: '', cliente: 'João Silva' })).toBe('João Silva');
  });

  it('returns cliente when b2b_company is only whitespace', () => {
    expect(getQuoteDisplayClient({ b2b_company: '   ', cliente: 'João Silva' })).toBe('João Silva');
  });

  it('returns b2b_company when it is filled', () => {
    expect(getQuoteDisplayClient({ b2b_company: 'Empresa LTDA', cliente: 'João Silva' })).toBe('Empresa LTDA');
  });

  it('returns b2b_company even when cliente is empty', () => {
    expect(getQuoteDisplayClient({ b2b_company: 'Empresa LTDA', cliente: '' })).toBe('Empresa LTDA');
  });

  it('trims b2b_company before using it', () => {
    expect(getQuoteDisplayClient({ b2b_company: '  Empresa LTDA  ', cliente: 'João' })).toBe('Empresa LTDA');
  });

  it('falls back to cliente when b2b_company trims to empty', () => {
    // '   '.trim() === '' which is falsy — so falls back to cliente
    expect(getQuoteDisplayClient({ b2b_company: '   ', cliente: 'Fallback' })).toBe('Fallback');
  });
});

// ─── 3. DS item change detection (dsChanged) ─────────────────────────────────

describe('computeDsChanged', () => {

  it('returns false for identical empty arrays', () => {
    expect(computeDsChanged([], [])).toBe(false);
  });

  it('returns true when item is added (length differs)', () => {
    const orig = [baseDsItem()];
    const curr = [baseDsItem(), baseDsItem({ id: 'ds-2', name: 'Outro' })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('returns true when item is removed (length differs)', () => {
    const orig = [baseDsItem(), baseDsItem({ id: 'ds-2' })];
    const curr = [baseDsItem()];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('returns false when all items are identical', () => {
    const item = baseDsItem();
    expect(computeDsChanged([item], [{ ...item }])).toBe(false);
  });

  it('detects name change', () => {
    const orig = [baseDsItem({ name: 'A' })];
    const curr = [baseDsItem({ name: 'B' })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects quantity change', () => {
    const orig = [baseDsItem({ quantity: 1 })];
    const curr = [baseDsItem({ quantity: 2 })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects projectedValue change', () => {
    const orig = [baseDsItem({ projectedValue: 100 })];
    const curr = [baseDsItem({ projectedValue: 200 })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects closingValue change', () => {
    const orig = [baseDsItem({ closingValue: 90 })];
    const curr = [baseDsItem({ closingValue: 95 })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects supplier change', () => {
    const orig = [baseDsItem({ supplier: 'A' })];
    const curr = [baseDsItem({ supplier: 'B' })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects supplierPct change', () => {
    const orig = [baseDsItem({ supplierPct: 10 })];
    const curr = [baseDsItem({ supplierPct: 15 })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects supplierFreight change', () => {
    const orig = [baseDsItem({ supplierFreight: 50 })];
    const curr = [baseDsItem({ supplierFreight: 75 })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('detects supplierInvoice change', () => {
    const orig = [baseDsItem({ supplierInvoice: 'NF-001' })];
    const curr = [baseDsItem({ supplierInvoice: 'NF-002' })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('returns true when item id is replaced (treated as new)', () => {
    const orig = [baseDsItem({ id: 'ds-1' })];
    const curr = [baseDsItem({ id: 'ds-new' })];
    expect(computeDsChanged(orig, curr)).toBe(true);
  });

  it('returns false for multiple identical items', () => {
    const a = baseDsItem({ id: 'ds-1' });
    const b = baseDsItem({ id: 'ds-2', name: 'Outro' });
    expect(computeDsChanged([a, b], [{ ...a }, { ...b }])).toBe(false);
  });

  it('detects change in one of multiple items', () => {
    const a = baseDsItem({ id: 'ds-1' });
    const b = baseDsItem({ id: 'ds-2', name: 'Original' });
    const bChanged = baseDsItem({ id: 'ds-2', name: 'Alterado' });
    expect(computeDsChanged([a, b], [{ ...a }, bChanged])).toBe(true);
  });
});

// ─── 4. getCotacaoPhase priority ──────────────────────────────────────────────

describe('getCotacaoPhase', () => {

  it('returns null when all statuses are false', () => {
    expect(getCotacaoPhase({ status_caida: false, status_fechada: false,
      status_em_fechamento: false, status_enviada: false })).toBeNull();
  });

  it('returns "dropped" when status_caida is true (highest priority)', () => {
    expect(getCotacaoPhase({ status_caida: true, status_fechada: true,
      status_em_fechamento: true, status_enviada: true })).toBe('dropped');
  });

  it('returns "closed" when status_fechada is true and caida is false', () => {
    expect(getCotacaoPhase({ status_caida: false, status_fechada: true,
      status_em_fechamento: true, status_enviada: true })).toBe('closed');
  });

  it('returns "forClosing" when em_fechamento is true and caida/fechada are false', () => {
    expect(getCotacaoPhase({ status_caida: false, status_fechada: false,
      status_em_fechamento: true, status_enviada: true })).toBe('forClosing');
  });

  it('returns "sent" when only status_enviada is true', () => {
    expect(getCotacaoPhase({ status_caida: false, status_fechada: false,
      status_em_fechamento: false, status_enviada: true })).toBe('sent');
  });

  it('"dropped" beats "sent" when both are true', () => {
    expect(getCotacaoPhase({ status_caida: true, status_fechada: false,
      status_em_fechamento: false, status_enviada: true })).toBe('dropped');
  });

  it('"closed" beats "forClosing" when both are true', () => {
    expect(getCotacaoPhase({ status_caida: false, status_fechada: true,
      status_em_fechamento: true, status_enviada: false })).toBe('closed');
  });
});

// ─── 5. Divisão venda: fornecedor × empresa ───────────────────────────────────

function dsOrderItem(over: Partial<DirectSupplyOrderItem> = {}): DirectSupplyOrderItem {
  return {
    id: 'ds-1', name: 'Produto X', quantity: 1,
    projectedValue: 0, purchaseValue: 0, closingValue: 0,
    supplier: '', supplierPct: 0, supplierFreight: 0, supplierInvoice: '',
    ...over,
  };
}

describe('calcDirectSupplyCost — parte que vai para o fornecedor', () => {

  it('aplica a % sobre a margem (venda − compra) × qtd e soma o frete', () => {
    // margem = (1000 − 600) × 2 = 800 ; 10% = 80 ; + frete 50 = 130
    const item = dsOrderItem({ quantity: 2, purchaseValue: 600, closingValue: 1000, supplierPct: 10, supplierFreight: 50 });
    expect(calcDirectSupplyCost([item])).toBe(130);
  });

  it('retorna apenas o frete quando a % é zero', () => {
    const item = dsOrderItem({ quantity: 1, purchaseValue: 600, closingValue: 1000, supplierPct: 0, supplierFreight: 40 });
    expect(calcDirectSupplyCost([item])).toBe(40);
  });

  it('soma múltiplos itens', () => {
    const a = dsOrderItem({ id: 'a', quantity: 1, purchaseValue: 100, closingValue: 200, supplierPct: 50 });   // 50
    const b = dsOrderItem({ id: 'b', quantity: 1, purchaseValue: 0, closingValue: 100, supplierFreight: 25 }); // 25
    expect(calcDirectSupplyCost([a, b])).toBe(75);
  });

  it('é zero quando não há itens de fornecimento direto', () => {
    expect(calcDirectSupplyCost([])).toBe(0);
    expect(calcDirectSupplyCost(undefined)).toBe(0);
  });
});

describe('calcCompanyRevenue — base dos impostos', () => {

  it('desconta a parte do fornecedor do valor de venda', () => {
    const item = dsOrderItem({ quantity: 2, purchaseValue: 600, closingValue: 1000, supplierPct: 10, supplierFreight: 50 });
    // venda 2000 − 130 = 1870
    expect(calcCompanyRevenue(2000, [item])).toBe(1870);
  });

  it('é igual ao valor de venda quando não há fornecimento direto', () => {
    expect(calcCompanyRevenue(2000, [])).toBe(2000);
    expect(calcCompanyRevenue(2000, undefined)).toBe(2000);
  });

  it('o imposto de venda incide sobre a empresa, não sobre empresa + fornecedor', () => {
    const item = dsOrderItem({ quantity: 2, purchaseValue: 600, closingValue: 1000, supplierPct: 10, supplierFreight: 50 });
    const base = calcCompanyRevenue(2000, [item]);
    const impostoCorreto = base * 5 / 100;       // 1870 × 5% = 93,50
    const impostoAntigo  = 2000 * 5 / 100;       // 100,00 — comportamento errado anterior
    expect(impostoCorreto).toBeCloseTo(93.5, 2);
    expect(impostoCorreto).toBeLessThan(impostoAntigo);
  });
});

// ─── 6. cleanStr ──────────────────────────────────────────────────────────────

describe('cleanStr', () => {

  it('trims leading and trailing whitespace', () => {
    expect(cleanStr('  hello  ')).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(cleanStr(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(cleanStr(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(cleanStr('')).toBe('');
  });

  it('returns empty string for the literal word "string" (API default artifact)', () => {
    expect(cleanStr('string')).toBe('');
  });

  it('does not strip "string" from words that contain it', () => {
    expect(cleanStr('some string value')).toBe('some string value');
  });

  it('preserves normal values unchanged after trim', () => {
    expect(cleanStr('Empresa LTDA')).toBe('Empresa LTDA');
  });

  it('handles whitespace-only string as empty', () => {
    expect(cleanStr('   ')).toBe('');
  });
});
