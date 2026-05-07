// IDs de loja — configurar via variáveis de ambiente
// Exemplo no .env: VITE_LUCKY_STORE_ID=<uuid-real>
export const LOJA_IDS: Record<string, string> = {
  'Lucky Store': import.meta.env.VITE_LUCKY_STORE_ID ?? '',
  'BTech': import.meta.env.VITE_BTECH_ID ?? '',
  'AJJ': import.meta.env.VITE_AJJ_ID ?? '',
};

// ID do vendedor logado — substituir pelo ID real do usuário quando auth real estiver integrada
// Configurar via VITE_DEFAULT_VENDEDOR_ID até a integração de auth estar completa
export const DEFAULT_VENDEDOR_ID: string =
  import.meta.env.VITE_DEFAULT_VENDEDOR_ID ?? '';
