import { describe, it, expect } from 'vitest';
import { formatCpfCnpj, onlyDigits, matchesCpfCnpj, isCpfCnpjComplete, displayCpfCnpj } from '@/lib/document';

describe('onlyDigits', () => {
  it('remove qualquer caractere não numérico', () => {
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190');
    expect(onlyDigits('abc')).toBe('');
  });
});

describe('formatCpfCnpj', () => {
  it('formata CPF progressivamente', () => {
    expect(formatCpfCnpj('123')).toBe('123');
    expect(formatCpfCnpj('1234')).toBe('123.4');
    expect(formatCpfCnpj('1234567')).toBe('123.456.7');
    expect(formatCpfCnpj('12345678901')).toBe('123.456.789-01');
  });

  it('formata CNPJ a partir de 12 dígitos', () => {
    expect(formatCpfCnpj('123456789012')).toBe('12.345.678/9012');
    expect(formatCpfCnpj('12345678000190')).toBe('12.345.678/0001-90');
  });

  it('é idempotente com valores já formatados', () => {
    expect(formatCpfCnpj('12.345.678/0001-90')).toBe('12.345.678/0001-90');
    expect(formatCpfCnpj('123.456.789-01')).toBe('123.456.789-01');
  });

  it('ignora caracteres não numéricos e limita a 14 dígitos', () => {
    expect(formatCpfCnpj('abc123')).toBe('123');
    expect(formatCpfCnpj('1234567890123456789')).toBe('12.345.678/9012-34');
  });
});

describe('displayCpfCnpj', () => {
  it('formata normalmente quando há dígitos', () => {
    expect(displayCpfCnpj('12345678000190')).toBe('12.345.678/0001-90');
    expect(displayCpfCnpj('12.345.678/0001-90')).toBe('12.345.678/0001-90');
  });

  it('preserva valores legados sem dígitos em vez de esvaziar o campo', () => {
    expect(displayCpfCnpj('ISENTO')).toBe('ISENTO');
    expect(displayCpfCnpj('A definir')).toBe('A definir');
  });

  it('trata vazio e nulo', () => {
    expect(displayCpfCnpj('')).toBe('');
    expect(displayCpfCnpj(null)).toBe('');
    expect(displayCpfCnpj(undefined)).toBe('');
    expect(displayCpfCnpj('   ')).toBe('');
  });
});

describe('matchesCpfCnpj', () => {
  it('encontra documento formatado a partir de dígitos puros', () => {
    expect(matchesCpfCnpj('12.345.678/0001-90', '12345678')).toBe(true);
    expect(matchesCpfCnpj('12.345.678/0001-90', '99999')).toBe(false);
    expect(matchesCpfCnpj(null, '123')).toBe(false);
    expect(matchesCpfCnpj('12.345.678/0001-90', 'abc')).toBe(false);
  });
});

describe('isCpfCnpjComplete', () => {
  it('valida o tamanho do documento', () => {
    expect(isCpfCnpjComplete('123.456.789-01')).toBe(true);
    expect(isCpfCnpjComplete('12.345.678/0001-90')).toBe(true);
    expect(isCpfCnpjComplete('123')).toBe(false);
  });
});
