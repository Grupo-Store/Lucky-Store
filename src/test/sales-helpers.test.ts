/**
 * Unit tests for the min-index status derivation helpers introduced in
 * feature/list-view-integration (Sales.tsx).
 *
 * The helpers are:
 *   minItemStatus(statuses)       — returns the status with the lowest index in
 *                                   ITEM_STATUS_ORDER, or null if none match.
 *   getOrderDisplayStatus(item)   — derives an order's display status from its
 *                                   produtos (and their sub_compras when present).
 *
 * Because these are module-private functions inside Sales.tsx, the tests
 * replicate the algorithm so the test suite acts as a living specification.
 * Any future change to the priority logic must update these tests first.
 */
import { describe, it, expect } from 'vitest';

// ─── Replicated logic (mirrors Sales.tsx exactly) ────────────────────────────

type ItemStatus = 'To Buy' | 'Bought' | 'In Stock';

const ITEM_STATUS_ORDER: ItemStatus[] = ['To Buy', 'Bought', 'In Stock'];

function minItemStatus(statuses: string[]): ItemStatus | null {
  let minIdx = Infinity;
  let minStatus: ItemStatus | null = null;
  for (const s of statuses) {
    const idx = ITEM_STATUS_ORDER.indexOf(s as ItemStatus);
    if (idx !== -1 && idx < minIdx) {
      minIdx = idx;
      minStatus = s as ItemStatus;
    }
  }
  return minStatus;
}

interface SubCompra { status: string }
interface Produto   { status: string; sub_compras?: SubCompra[] | null }
interface PedidoListItem { produtos?: Produto[] | null }

function getOrderDisplayStatus(item: PedidoListItem): ItemStatus | null {
  if (!item.produtos || item.produtos.length === 0) return null;
  const effectiveStatuses = item.produtos
    .map(p =>
      p.sub_compras && p.sub_compras.length > 0
        ? minItemStatus(p.sub_compras.map(sc => sc.status))
        : (p.status as ItemStatus)
    )
    .filter((s): s is ItemStatus => s !== null);
  return minItemStatus(effectiveStatuses);
}

// ─── minItemStatus ────────────────────────────────────────────────────────────

describe('minItemStatus', () => {

  it('returns null for an empty list', () => {
    expect(minItemStatus([])).toBeNull();
  });

  it('returns null when no recognised statuses are present', () => {
    expect(minItemStatus(['Unknown', 'Whatever'])).toBeNull();
  });

  it('returns the single status when only one item is given', () => {
    expect(minItemStatus(['To Buy'])).toBe('To Buy');
    expect(minItemStatus(['Bought'])).toBe('Bought');
    expect(minItemStatus(['In Stock'])).toBe('In Stock');
  });

  it('returns To Buy when all three statuses are present', () => {
    expect(minItemStatus(['In Stock', 'Bought', 'To Buy'])).toBe('To Buy');
  });

  it('returns To Buy when mixed with unknown statuses', () => {
    expect(minItemStatus(['In Stock', 'Unknown', 'To Buy'])).toBe('To Buy');
  });

  it('returns Bought when To Buy is absent', () => {
    expect(minItemStatus(['In Stock', 'Bought'])).toBe('Bought');
  });

  it('returns In Stock when only In Stock is present', () => {
    expect(minItemStatus(['In Stock', 'In Stock'])).toBe('In Stock');
  });

  it('To Buy has lower index than Bought', () => {
    expect(ITEM_STATUS_ORDER.indexOf('To Buy')).toBeLessThan(
      ITEM_STATUS_ORDER.indexOf('Bought')
    );
  });

  it('Bought has lower index than In Stock', () => {
    expect(ITEM_STATUS_ORDER.indexOf('Bought')).toBeLessThan(
      ITEM_STATUS_ORDER.indexOf('In Stock')
    );
  });

  it('ignores unknown values in a mixed list', () => {
    expect(minItemStatus(['Received', 'Delivered', 'Bought'])).toBe('Bought');
  });

  it('is case-sensitive — "to buy" is not a match', () => {
    expect(minItemStatus(['to buy', 'Bought'])).toBe('Bought');
  });

  it('handles duplicate statuses', () => {
    expect(minItemStatus(['In Stock', 'In Stock', 'In Stock'])).toBe('In Stock');
    expect(minItemStatus(['Bought', 'Bought', 'To Buy'])).toBe('To Buy');
  });
});

// ─── getOrderDisplayStatus ────────────────────────────────────────────────────

describe('getOrderDisplayStatus', () => {

  it('returns null when produtos is undefined', () => {
    expect(getOrderDisplayStatus({})).toBeNull();
  });

  it('returns null when produtos is an empty array', () => {
    expect(getOrderDisplayStatus({ produtos: [] })).toBeNull();
  });

  it('returns null when produtos is null', () => {
    expect(getOrderDisplayStatus({ produtos: null })).toBeNull();
  });

  it('uses produto.status directly when sub_compras is absent', () => {
    const item: PedidoListItem = {
      produtos: [{ status: 'To Buy' }, { status: 'In Stock' }],
    };
    expect(getOrderDisplayStatus(item)).toBe('To Buy');
  });

  it('uses produto.status when sub_compras is empty array', () => {
    const item: PedidoListItem = {
      produtos: [{ status: 'Bought', sub_compras: [] }],
    };
    expect(getOrderDisplayStatus(item)).toBe('Bought');
  });

  it('uses sub_compras min-status when sub_compras are present', () => {
    const item: PedidoListItem = {
      produtos: [{
        status: 'In Stock',
        sub_compras: [
          { status: 'Bought' },
          { status: 'In Stock' },
        ],
      }],
    };
    expect(getOrderDisplayStatus(item)).toBe('Bought');
  });

  it('sub_compras To Buy overrides produto In Stock status', () => {
    const item: PedidoListItem = {
      produtos: [{
        status: 'In Stock',
        sub_compras: [{ status: 'To Buy' }],
      }],
    };
    expect(getOrderDisplayStatus(item)).toBe('To Buy');
  });

  it('returns min across multiple produtos (mixed sub_compras and no sub_compras)', () => {
    const item: PedidoListItem = {
      produtos: [
        { status: 'In Stock', sub_compras: [{ status: 'In Stock' }] },
        { status: 'Bought' },
      ],
    };
    expect(getOrderDisplayStatus(item)).toBe('Bought');
  });

  it('returns null when all sub_compras have unrecognised statuses', () => {
    const item: PedidoListItem = {
      produtos: [{
        status: 'In Stock',
        sub_compras: [{ status: 'Unknown' }],
      }],
    };
    expect(getOrderDisplayStatus(item)).toBeNull();
  });

  it('handles a single produto with all three sub_compras statuses', () => {
    const item: PedidoListItem = {
      produtos: [{
        status: 'In Stock',
        sub_compras: [
          { status: 'In Stock' },
          { status: 'Bought' },
          { status: 'To Buy' },
        ],
      }],
    };
    expect(getOrderDisplayStatus(item)).toBe('To Buy');
  });

  it('correctly selects min across two produtos with sub_compras', () => {
    const item: PedidoListItem = {
      produtos: [
        { status: 'In Stock', sub_compras: [{ status: 'Bought' }] },
        { status: 'In Stock', sub_compras: [{ status: 'To Buy' }] },
      ],
    };
    expect(getOrderDisplayStatus(item)).toBe('To Buy');
  });
});
