export const LOJA_IDS: Record<string, string> = {
  'Lucky Store': import.meta.env.VITE_LUCKY_STORE_ID ?? '',
  'BTech': import.meta.env.VITE_BTECH_ID ?? '',
  'AJJ': import.meta.env.VITE_AJJ_ID ?? '',
};

export const VENDEDOR_IDS: Record<string, string> = {
  'Alcides': import.meta.env.VITE_VENDEDOR_ALCIDES_ID ?? '',
  'Lucas': import.meta.env.VITE_VENDEDOR_LUCAS_ID ?? '',
  'Pedro': import.meta.env.VITE_VENDEDOR_PEDRO_ID ?? '',
};

// Fallback enquanto não há lookup de cliente por nome
export const DEFAULT_CLIENTE_ID: string =
  import.meta.env.VITE_DEFAULT_CLIENTE_ID ?? '';

export const FORMA_PAGAMENTO_MAP: Record<string, string> = {
  'Credit Card': 'credito',
  'Debit Card': 'debito',
  'Boleto': 'boleto',
  'Pix': 'pix',
  'TED': 'ted',
  'Cash': 'dinheiro',
};
