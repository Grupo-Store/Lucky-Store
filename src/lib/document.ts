/**
 * Utilitários de formatação de documentos brasileiros (CPF/CNPJ).
 *
 * O usuário digita apenas números; a pontuação (".", "-", "/") é aplicada
 * automaticamente conforme a quantidade de dígitos.
 */

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Aplica a máscara de CPF (000.000.000-00) até 11 dígitos e de
 * CNPJ (00.000.000/0000-00) a partir de 12 dígitos. Formata de forma
 * progressiva, então funciona enquanto o usuário digita.
 */
export function formatCpfCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/**
 * Versão para exibição, tolerante a dados legados.
 *
 * Antes da máscara existir o campo era texto livre, então há registros com
 * coisas como "ISENTO" ou "A definir". `formatCpfCnpj` descartaria esses
 * valores e o campo apareceria vazio, parecendo perda de dado. Aqui eles são
 * mostrados como estão; só o que tem dígito passa pela máscara.
 */
export function displayCpfCnpj(value: string | null | undefined): string {
  const raw = value ?? '';
  if (!raw.trim()) return '';
  if (!onlyDigits(raw)) return raw;
  return formatCpfCnpj(raw);
}

/**
 * Compara um documento com um termo de busca ignorando a pontuação, para que
 * "12345678" encontre "12.345.678/0001-90".
 */
export function matchesCpfCnpj(stored: string | null | undefined, query: string): boolean {
  const q = onlyDigits(query);
  if (!q) return false;
  return onlyDigits(stored ?? '').includes(q);
}

/** true quando o documento tem tamanho de CPF (11) ou CNPJ (14). */
export function isCpfCnpjComplete(value: string): boolean {
  const len = onlyDigits(value).length;
  return len === 11 || len === 14;
}
