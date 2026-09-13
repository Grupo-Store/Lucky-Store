import axios from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client';
import { clearAuthSession, saveAuthTokens, SESSION_ENDED_EVENT } from '@/lib/auth-session';

const originalAdapter = apiClient.defaults.adapter;
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  saveAuthTokens({ access_token: 'access-0', refresh_token: 'refresh-0' });
});
afterEach(() => { vi.restoreAllMocks(); apiClient.defaults.adapter = originalAdapter; sessionStorage.clear(); });

function requireToken(getToken: () => string) {
  apiClient.defaults.adapter = async config => {
    if (config.headers.Authorization !== `Bearer ${getToken()}`) {
      throw Object.assign(new Error('Expired'), { config, response: { status: 401 } });
    }
    return { data: 'ok', status: 200, statusText: 'OK', headers: {}, config };
  };
}

it('salva o par renovado e consegue renovar a sessao varias vezes', async () => {
  let generation = 1;
  requireToken(() => `access-${generation}`);
  const refresh = vi.spyOn(axios, 'post').mockImplementation(async (_url, body) => {
    expect((body as { refresh_token: string }).refresh_token).toBe(`refresh-${generation - 1}`);
    return { data: { access_token: `access-${generation}`, refresh_token: `refresh-${generation}` } };
  });
  await expect(apiClient.get('/pedidos')).resolves.toMatchObject({ data: 'ok' });
  generation++;
  await expect(apiClient.get('/pedidos')).resolves.toMatchObject({ data: 'ok' });
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem('refresh_token')).toBe('refresh-2');
  expect(localStorage.getItem('access_token')).toBeNull();
});

it('compartilha a renovacao entre requisicoes simultaneas', async () => {
  requireToken(() => 'access-1');
  const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  const results = await Promise.all([apiClient.get('/pedidos'), apiClient.get('/fretes/summary'), apiClient.get('/auth/me')]);
  expect(results.every(result => result.data === 'ok')).toBe(true);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it.each([undefined, 503])('mantem a sessao se a renovacao falhar por rede/servidor (%s)', async status => {
  requireToken(() => 'access-1');
  const error = Object.assign(new Error('Unavailable'), { response: status ? { status } : undefined });
  vi.spyOn(axios, 'post').mockRejectedValue(error);
  await expect(apiClient.get('/pedidos')).rejects.toBe(error);
  expect(sessionStorage.getItem('refresh_token')).toBe('refresh-0');
  expect(sessionStorage.getItem('access_token')).toBe('access-0');
});

it('encerra somente a autenticacao quando o refresh e recusado', async () => {
  requireToken(() => 'access-1');
  sessionStorage.setItem('preferencia', 'manter');
  localStorage.setItem('preferencia', 'manter');
  const ended = vi.fn();
  window.addEventListener(SESSION_ENDED_EVENT, ended);
  vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } });
  await expect(apiClient.get('/pedidos')).rejects.toMatchObject({ response: { status: 401 } });
  expect(sessionStorage.getItem('access_token')).toBeNull();
  expect(sessionStorage.getItem('preferencia')).toBe('manter');
  expect(localStorage.getItem('preferencia')).toBe('manter');
  expect(ended).toHaveBeenCalledTimes(1);
  window.removeEventListener(SESSION_ENDED_EVENT, ended);
});

it('uma resposta de renovacao atrasada nao restaura o login depois de sair', async () => {
  requireToken(() => 'access-1');
  let complete!: (response: unknown) => void;
  vi.spyOn(axios, 'post').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const request = apiClient.get('/pedidos');
  const assertion = expect(request).rejects.toThrow('Sessão alterada.');
  await vi.waitFor(() => expect(complete).toBeDefined());
  clearAuthSession();
  complete({ data: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  await assertion;
  expect(sessionStorage.getItem('access_token')).toBeNull();
});

it('encerra a sessao se o servidor rejeitar tambem o novo token, sem loop de refresh', async () => {
  requireToken(() => 'never-valid');
  const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  await expect(apiClient.get('/auth/me')).rejects.toMatchObject({ response: { status: 401 } });
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('access_token')).toBeNull();
});
