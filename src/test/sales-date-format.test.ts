/**
 * Tests for the date-format fix in Sales.tsx onRangeChange handlers.
 *
 * Before the fix: Date objects from the DateFilter component were passed
 * directly as query params, producing strings like
 * "Wed May 06 2026 00:00:00 GMT-0300 (Horário Padrão de Brasília)"
 * which PostgreSQL cannot parse as a timezone ("gmt-0300 is unknown").
 *
 * After the fix: date-fns format(date, 'yyyy-MM-dd') is applied before
 * passing the value to API filters, producing "2026-05-06".
 *
 * These tests verify the formatting contract independently of the React
 * component so they run fast and without DOM setup.
 */
import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';

// ─── Core formatting contract ─────────────────────────────────────────────────

describe('date formatting for API filters (yyyy-MM-dd)', () => {

  it('formats a Date object to YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 6); // May 6, 2026 (months are 0-indexed)
    expect(format(d, 'yyyy-MM-dd')).toBe('2026-05-06');
  });

  it('pads single-digit months with a leading zero', () => {
    const d = new Date(2026, 0, 15); // Jan 15, 2026
    expect(format(d, 'yyyy-MM-dd')).toBe('2026-01-15');
  });

  it('pads single-digit days with a leading zero', () => {
    const d = new Date(2026, 11, 3); // Dec 3, 2026
    expect(format(d, 'yyyy-MM-dd')).toBe('2026-12-03');
  });

  it('never produces timezone or locale suffix', () => {
    const d = new Date(2026, 4, 6, 0, 0, 0);
    const result = format(d, 'yyyy-MM-dd');
    expect(result).not.toMatch(/GMT/i);
    expect(result).not.toMatch(/horário/i);
    expect(result).not.toMatch(/\+/);
    expect(result).not.toMatch(/-\d{4}$/);
  });

  it('result matches YYYY-MM-DD regex pattern', () => {
    const d = new Date(2026, 4, 6);
    const result = format(d, 'yyyy-MM-dd');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats the end of range correctly', () => {
    const from = new Date(2026, 4, 1); // May 1
    const to   = new Date(2026, 4, 31); // May 31
    expect(format(from, 'yyyy-MM-dd')).toBe('2026-05-01');
    expect(format(to,   'yyyy-MM-dd')).toBe('2026-05-31');
  });
});

// ─── Fallback when range.to is absent ────────────────────────────────────────

describe('range-to fallback logic', () => {

  function buildApiDates(from?: Date, to?: Date) {
    return {
      data_inicio: from ? format(from, 'yyyy-MM-dd') : undefined,
      data_fim:    to   ? format(to,   'yyyy-MM-dd')
                        : from ? format(from, 'yyyy-MM-dd')
                        : undefined,
    };
  }

  it('sets data_inicio and data_fim to the same day when only from is given', () => {
    const d = new Date(2026, 4, 6);
    const result = buildApiDates(d, undefined);
    expect(result.data_inicio).toBe('2026-05-06');
    expect(result.data_fim).toBe('2026-05-06');
  });

  it('sets data_inicio and data_fim independently when both are given', () => {
    const from = new Date(2026, 4, 1);
    const to   = new Date(2026, 4, 15);
    const result = buildApiDates(from, to);
    expect(result.data_inicio).toBe('2026-05-01');
    expect(result.data_fim).toBe('2026-05-15');
  });

  it('sets both to undefined when range is cleared', () => {
    const result = buildApiDates(undefined, undefined);
    expect(result.data_inicio).toBeUndefined();
    expect(result.data_fim).toBeUndefined();
  });

  it('raw Date.toString() would have failed PostgreSQL before the fix', () => {
    const d = new Date(2026, 4, 6);
    const rawString = d.toString();
    // Confirm the old buggy value is NOT a valid YYYY-MM-DD
    expect(rawString).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rawString).toMatch(/GMT/);
  });
});
