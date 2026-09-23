/** Nome de apresentação nos documentos, sem alterar a identidade do cadastro. */
export function sellerPrintName(name?: string | null): string {
  const value = name?.trim() || '';
  const names: Record<string, string> = {
    alcides: 'Alcides Campos',
    lucas: 'J. Lucas Campos',
    pedro: 'J. Pedro Campos',
  };
  return names[value.toLocaleLowerCase('pt-BR')] ?? (value || '—');
}
