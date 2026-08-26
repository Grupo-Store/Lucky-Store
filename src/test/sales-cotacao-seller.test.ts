/**
 * Unit tests for the seller name resolution introduced when fixing the
 * quotation signature bug (PR: cotação sempre mostrava "Alcides Campos").
 *
 * Two functions are covered:
 *
 *  resolveSellerName(c, vendedores)
 *    — mirrors the logic at Sales.tsx cotacaoToQuote() line:
 *        seller: vendedores.find(v => v.id === c.id_vendedor)?.nome ?? ''
 *
 *  buildSellerName(seller)
 *    — mirrors the logic at QuoteModal.tsx QuotePrintTemplate():
 *        const sellerName = (form.seller || '').trim() || '—';
 *
 * Both functions are private to their modules; the tests replicate the
 * algorithm so the suite acts as a living specification — any change to
 * the logic must update these tests first.
 */

import { describe, it, expect } from 'vitest';

// ─── Replicated logic ─────────────────────────────────────────────────────────

interface VendedorItem { id: string; nome: string }
interface CotacaoStub  { id_vendedor: string }

/** Mirrors cotacaoToQuote seller field — Sales.tsx */
function resolveSellerName(c: CotacaoStub, vendedores: VendedorItem[]): string {
  return vendedores.find(v => v.id === c.id_vendedor)?.nome ?? '';
}

/** Mirrors sellerName constant — QuoteModal.tsx QuotePrintTemplate */
function buildSellerName(seller: string | undefined | null): string {
  return (seller || '').trim() || '—';
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VENDEDORES: VendedorItem[] = [
  { id: 'id-alcides', nome: 'Alcides Campos' },
  { id: 'id-lucas',   nome: 'J. Lucas Campos' },
  { id: 'id-pedro',   nome: 'J. Pedro Campos' },
];

// ─── resolveSellerName ────────────────────────────────────────────────────────

describe('resolveSellerName', () => {

  it('returns the full name for Alcides', () => {
    expect(resolveSellerName({ id_vendedor: 'id-alcides' }, VENDEDORES))
      .toBe('Alcides Campos');
  });

  it('returns the full name for J. Lucas Campos (not "Lucas Campos")', () => {
    expect(resolveSellerName({ id_vendedor: 'id-lucas' }, VENDEDORES))
      .toBe('J. Lucas Campos');
  });

  it('returns the full name for J. Pedro Campos (not "Pedro Campos")', () => {
    expect(resolveSellerName({ id_vendedor: 'id-pedro' }, VENDEDORES))
      .toBe('J. Pedro Campos');
  });

  it('returns empty string when id_vendedor is not in the list', () => {
    expect(resolveSellerName({ id_vendedor: 'unknown-id' }, VENDEDORES))
      .toBe('');
  });

  it('returns empty string when vendedores list is empty', () => {
    expect(resolveSellerName({ id_vendedor: 'id-alcides' }, []))
      .toBe('');
  });

  it('returns empty string when id_vendedor is empty string', () => {
    expect(resolveSellerName({ id_vendedor: '' }, VENDEDORES))
      .toBe('');
  });

  it('is case-sensitive — mismatched ID casing returns empty string', () => {
    expect(resolveSellerName({ id_vendedor: 'ID-ALCIDES' }, VENDEDORES))
      .toBe('');
  });

  it('returns the first match when two vendedores share the same id (degenerate case)', () => {
    const dupes: VendedorItem[] = [
      { id: 'same-id', nome: 'Primeiro' },
      { id: 'same-id', nome: 'Segundo' },
    ];
    expect(resolveSellerName({ id_vendedor: 'same-id' }, dupes))
      .toBe('Primeiro');
  });

  it('does NOT append "Campos" to any name — name comes verbatim from the API', () => {
    const custom: VendedorItem[] = [{ id: 'id-x', nome: 'Fulano' }];
    const result = resolveSellerName({ id_vendedor: 'id-x' }, custom);
    expect(result).toBe('Fulano');
    expect(result).not.toContain('Campos');
  });
});

// ─── buildSellerName ──────────────────────────────────────────────────────────

describe('buildSellerName', () => {

  it('returns the name as-is when seller is a full name', () => {
    expect(buildSellerName('Alcides Campos')).toBe('Alcides Campos');
  });

  it('returns J. Lucas Campos verbatim — no "Campos" is appended', () => {
    expect(buildSellerName('J. Lucas Campos')).toBe('J. Lucas Campos');
  });

  it('returns J. Pedro Campos verbatim', () => {
    expect(buildSellerName('J. Pedro Campos')).toBe('J. Pedro Campos');
  });

  it('returns "—" when seller is empty string', () => {
    expect(buildSellerName('')).toBe('—');
  });

  it('returns "—" when seller is undefined', () => {
    expect(buildSellerName(undefined)).toBe('—');
  });

  it('returns "—" when seller is null', () => {
    expect(buildSellerName(null)).toBe('—');
  });

  it('trims whitespace before checking emptiness', () => {
    expect(buildSellerName('   ')).toBe('—');
  });

  it('trims leading/trailing whitespace from valid names', () => {
    expect(buildSellerName('  Alcides Campos  ')).toBe('Alcides Campos');
  });

  it('does NOT append "Campos" to a bare first name — that was the old buggy behaviour', () => {
    // Old code: `${seller} Campos` when name didn't end with "Campos"
    // New code: returns the name verbatim
    expect(buildSellerName('Lucas')).toBe('Lucas');
    expect(buildSellerName('Lucas')).not.toBe('Lucas Campos');
  });
});

// ─── Integration: both functions chained (simulates print flow) ───────────────

describe('seller name end-to-end (resolveSellerName → buildSellerName)', () => {

  it('Alcides: resolves full name and displays it in the signature', () => {
    const raw = resolveSellerName({ id_vendedor: 'id-alcides' }, VENDEDORES);
    expect(buildSellerName(raw)).toBe('Alcides Campos');
  });

  it('Lucas: resolves J. Lucas Campos and displays it in the signature', () => {
    const raw = resolveSellerName({ id_vendedor: 'id-lucas' }, VENDEDORES);
    expect(buildSellerName(raw)).toBe('J. Lucas Campos');
  });

  it('Pedro: resolves J. Pedro Campos and displays it in the signature', () => {
    const raw = resolveSellerName({ id_vendedor: 'id-pedro' }, VENDEDORES);
    expect(buildSellerName(raw)).toBe('J. Pedro Campos');
  });

  it('unknown vendor: resolves to empty string and signature shows "—"', () => {
    const raw = resolveSellerName({ id_vendedor: 'ghost-id' }, VENDEDORES);
    expect(buildSellerName(raw)).toBe('—');
  });
});
