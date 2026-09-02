/**
 * Regressão: o reenvio automático em erro de rede valia para QUALQUER método,
 * inclusive POST.
 *
 * Duas consequências, as duas medidas contra o backend real:
 *
 *  - número de OS desperdiçado: o número vem de nextval, que não volta no
 *    rollback; uma criação recusada e reenviada 3x queimava 4 números;
 *  - pedido duplicado: se a criação deu certo e só a resposta se perdeu, o
 *    reenvio criava um segundo pedido idêntico — e não há chave de
 *    idempotência no projeto para impedir.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

async function carregarClient(falhas: number) {
  vi.resetModules();
  const mod = await import('@/api/client');
  let chamadas = 0;
  // Erro de rede = requisição sem resposta. É o que o axios entrega quando a
  // conexão cai antes do servidor responder.
  mod.apiClient.defaults.adapter = (async (config: any) => {
    chamadas += 1;
    if (chamadas <= falhas) {
      throw Object.assign(new Error('Network Error'), { isAxiosError: true, config, request: {} });
    }
    return { data: 'ok', status: 200, statusText: 'OK', headers: {}, config };
  }) as never;
  return { apiClient: mod.apiClient, envios: () => chamadas };
}

describe('reenvio automático em erro de rede', () => {
  beforeEach(() => { vi.useRealTimers(); localStorage.clear(); });

  it('NÃO reenvia POST — criaria pedido duplicado e queimaria número de OS', async () => {
    const { apiClient, envios } = await carregarClient(3);
    await apiClient.post('/pedidos', { nome_cliente: 'Hospital Português' }).catch(() => {});
    expect(envios()).toBe(1);
  });

  it('não reenvia PUT, PATCH nem DELETE', async () => {
    for (const metodo of ['put', 'patch', 'delete'] as const) {
      const { apiClient, envios } = await carregarClient(3);
      await (apiClient as never as Record<string, (...a: unknown[]) => Promise<unknown>>)[metodo]('/pedidos/1', {}).catch(() => {});
      expect(envios(), `${metodo} não deveria reenviar`).toBe(1);
    }
  });

  it('reenvia GET — é idempotente e mantém a listagem resistente a oscilação', async () => {
    const { apiClient, envios } = await carregarClient(2);
    const r = await apiClient.get('/pedidos');
    expect(r.data).toBe('ok');
    expect(envios()).toBe(3);   // 2 falhas + 1 sucesso
  }, 10000);

  it('GET desiste depois do limite, em vez de tentar para sempre', async () => {
    const { apiClient, envios } = await carregarClient(99);
    await apiClient.get('/pedidos').catch(() => {});
    expect(envios()).toBe(4);   // 1 original + 3 reenvios
  }, 15000);
});
