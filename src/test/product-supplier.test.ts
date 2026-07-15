/**
 * Unit tests for the supplier derivation logic used in the Products tab
 * (Sales.tsx).
 *
 * The logic resolves the displayed supplier for each order item:
 *   - If the item has sub_compras, join unique non-empty supplier names.
 *   - Otherwise fall back to the item-level fornecedor field.
 *
 * Also tests that the search filter matches on supplier text.
 */
import { describe, it, expect } from 'vitest';

// ─── Replicated types (mirrors Sales.tsx / api types) ────────────────────────

interface SubCompra {
  supplier: string;
  status: string;
}

interface Produto {
  id: string;
  descricao: string;
  quantidade: number;
  valor_projetado: string;
  valor_compra: string | null;
  status: string;
  fornecedor: string | null;
  is_direct_supply: boolean;
  sub_compras: SubCompra[] | null;
}

// ─── Replicated logic (mirrors Sales.tsx exactly) ────────────────────────────

function deriveSupplier(p: Produto): string {
  return p.sub_compras && p.sub_compras.length > 0
    ? [...new Set(p.sub_compras.map(sc => sc.supplier).filter(Boolean))].join(', ')
    : (p.fornecedor ?? '');
}

function matchesSearch(supplier: string, query: string): boolean {
  return (supplier || '').toLowerCase().includes(query.toLowerCase().trim());
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeProduto(overrides: Partial<Produto> = {}): Produto {
  return {
    id: '1',
    descricao: 'Test Product',
    quantidade: 1,
    valor_projetado: '100',
    valor_compra: null,
    status: 'To Buy',
    fornecedor: null,
    is_direct_supply: false,
    sub_compras: null,
    ...overrides,
  };
}

// ─── deriveSupplier ──────────────────────────────────────────────────────────

describe('deriveSupplier', () => {

  it('returns empty string when no sub_compras and fornecedor is null', () => {
    const p = makeProduto({ fornecedor: null, sub_compras: null });
    expect(deriveSupplier(p)).toBe('');
  });

  it('returns fornecedor when no sub_compras', () => {
    const p = makeProduto({ fornecedor: 'Fornecedor A', sub_compras: null });
    expect(deriveSupplier(p)).toBe('Fornecedor A');
  });

  it('returns fornecedor when sub_compras is empty array', () => {
    const p = makeProduto({ fornecedor: 'Fornecedor B', sub_compras: [] });
    expect(deriveSupplier(p)).toBe('Fornecedor B');
  });

  it('returns single supplier from sub_compras', () => {
    const p = makeProduto({
      fornecedor: 'Ignored',
      sub_compras: [
        { supplier: 'Supplier X', status: 'Bought' },
      ],
    });
    expect(deriveSupplier(p)).toBe('Supplier X');
  });

  it('joins multiple unique suppliers from sub_compras', () => {
    const p = makeProduto({
      sub_compras: [
        { supplier: 'Supplier A', status: 'To Buy' },
        { supplier: 'Supplier B', status: 'Bought' },
      ],
    });
    expect(deriveSupplier(p)).toBe('Supplier A, Supplier B');
  });

  it('deduplicates suppliers from sub_compras', () => {
    const p = makeProduto({
      sub_compras: [
        { supplier: 'Same Supplier', status: 'To Buy' },
        { supplier: 'Same Supplier', status: 'Bought' },
        { supplier: 'Other', status: 'In Stock' },
      ],
    });
    expect(deriveSupplier(p)).toBe('Same Supplier, Other');
  });

  it('filters out empty supplier strings from sub_compras', () => {
    const p = makeProduto({
      sub_compras: [
        { supplier: '', status: 'To Buy' },
        { supplier: 'Valid Supplier', status: 'Bought' },
      ],
    });
    expect(deriveSupplier(p)).toBe('Valid Supplier');
  });

  it('returns empty string when all sub_compras have empty supplier', () => {
    const p = makeProduto({
      sub_compras: [
        { supplier: '', status: 'To Buy' },
        { supplier: '', status: 'Bought' },
      ],
    });
    expect(deriveSupplier(p)).toBe('');
  });

  it('ignores fornecedor field when sub_compras are present', () => {
    const p = makeProduto({
      fornecedor: 'Should Be Ignored',
      sub_compras: [
        { supplier: 'From SubCompra', status: 'To Buy' },
      ],
    });
    expect(deriveSupplier(p)).toBe('From SubCompra');
  });
});

// ─── search filter on supplier ───────────────────────────────────────────────

describe('supplier search filter', () => {

  it('matches partial supplier name', () => {
    expect(matchesSearch('Fornecedor ABC', 'abc')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesSearch('Supplier X', 'supplier x')).toBe(true);
  });

  it('does not match when supplier is empty', () => {
    expect(matchesSearch('', 'abc')).toBe(false);
  });

  it('matches when query is empty', () => {
    expect(matchesSearch('Any Supplier', '')).toBe(true);
  });

  it('matches on comma-separated supplier list', () => {
    expect(matchesSearch('Supplier A, Supplier B', 'supplier b')).toBe(true);
  });
});
