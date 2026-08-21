import axios from 'axios';

const MAX_NETWORK_RETRIES = 3;

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) {
        localStorage.clear();
        window.location.replace('/');
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refresh_token: refresh,
        });
        localStorage.setItem('access_token', data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        localStorage.clear();
        window.location.replace('/');
        return Promise.reject(error);
      }
    }

    // Retry on network errors (no response)
    const isNetworkError = !error.response;
    original._retryCount = original._retryCount ?? 0;
    if (isNetworkError && original._retryCount < MAX_NETWORK_RETRIES) {
      original._retryCount += 1;
      const delay = 2 ** original._retryCount * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(original);
    }

    return Promise.reject(error);
  }
);

/** Nomes de campo como o usuário os vê na tela, para as mensagens de validação. */
const ROTULO_CAMPO: Record<string, string> = {
  id_loja: 'Empresa',
  id_vendedor: 'Vendedor',
  nome_cliente: 'Cliente',
  cpf_cnpj: 'CPF/CNPJ',
  numero_oc: 'OC/AF/PED',
  numero_os: 'Nº da OS',
  numero_nf: 'Nº da NF',
  data_pedido: 'Data do Pedido',
  data_entrega: 'Data de Entrega',
  data_cotacao: 'Data da Cotação',
  data_validade: 'Data de Validade',
  valor_venda: 'Valor de Venda',
  valor_total: 'Valor',
  cliente: 'Cliente',
  status: 'Status',
  email: 'E-mail',
  password: 'Senha',
};

/** Uma entrada da lista `detail` de um 422 do FastAPI/Pydantic. */
interface ErroValidacao {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

function descreverCampo(loc: (string | number)[] | undefined): string | null {
  if (!loc?.length) return null;
  // loc vem como ['body', 'id_loja'] — o primeiro item é a origem, não o campo.
  const campo = loc.filter(p => p !== 'body' && p !== 'query' && p !== 'path').pop();
  if (campo == null) return null;
  return ROTULO_CAMPO[String(campo)] ?? String(campo);
}

function traduzirErroValidacao(item: ErroValidacao): string {
  const campo = descreverCampo(item.loc);
  const tipo = item.type ?? '';

  // Campo obrigatório em branco chega como uuid_parsing / int_parsing / etc.
  // quando a tela manda string vazia, e como 'missing' quando nem manda.
  if (tipo === 'missing' || tipo.endsWith('_parsing') || tipo.endsWith('_type')) {
    return campo ? `${campo} é obrigatório.` : 'Há um campo obrigatório em branco.';
  }
  const msg = item.msg?.trim();
  return campo && msg ? `${campo}: ${msg}` : (msg || 'Valor inválido.');
}

export function getApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Erro desconhecido. Tente novamente.';

  // Sem resposta = não chegou ao servidor. client.ts já tentou reenviar.
  if (!error.response) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }

  const { status, data } = error.response;
  const detail = data?.detail;

  if (typeof detail === 'string') return detail;

  // 422 do FastAPI: `detail` é uma LISTA de erros de validação. Antes isto caía
  // num JSON.stringify e o vendedor via 'uuid_parsing', 'loc' e 'ctx' na tela.
  if (Array.isArray(detail)) {
    const mensagens = [...new Set(detail.map(traduzirErroValidacao))];
    if (mensagens.length) return mensagens.join(' ');
  }

  if (status >= 500) {
    return 'O servidor falhou ao processar. Tente novamente em instantes.';
  }
  if (detail && typeof detail === 'object') {
    // Formato inesperado: melhor uma frase honesta do que despejar JSON.
    return 'Não foi possível concluir a operação. Confira os dados e tente de novo.';
  }
  return 'Erro desconhecido. Tente novamente.';
}
