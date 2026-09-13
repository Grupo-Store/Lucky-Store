import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import { AuthProvider, useAuth } from '@/store/AuthStore';
import { authApi } from '@/api/auth';

vi.mock('@/api/auth', () => ({ authApi: { me: vi.fn() } }));
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  vi.mocked(authApi.me).mockReset().mockResolvedValue({ email: 'user@example.com' } as never);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.clear(); localStorage.clear(); });

it('salva o login somente na aba e preserva ao remontar/atualizar a pagina', async () => {
  const post = vi.spyOn(axios, 'post').mockResolvedValueOnce({ status: 202, data: { detail: { requires_2fa: true } } })
    .mockResolvedValueOnce({ data: { access_token: 'access', refresh_token: 'refresh' } });
  const first = renderHook(useAuth, { wrapper: AuthProvider });
  await act(async () => { await first.result.current.login('user@example.com', 'password'); });
  await act(async () => { await first.result.current.verifyCode('123456'); });
  expect(first.result.current.isLoggedIn).toBe(true);
  expect(sessionStorage.getItem('access_token')).toBe('access');
  expect(localStorage.getItem('access_token')).toBeNull();
  first.unmount();
  const reloaded = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(reloaded.result.current.email).toBe('user@example.com'));
  expect(reloaded.result.current.isLoggedIn).toBe(true);
  expect(post).toHaveBeenCalledTimes(2);
  reloaded.unmount();
  // A new tab session has an empty sessionStorage; persistent old tokens are ignored.
  sessionStorage.clear();
  localStorage.setItem('access_token', 'old-persistent-token');
  const newTab = renderHook(useAuth, { wrapper: AuthProvider });
  expect(newTab.result.current.isLoggedIn).toBe(false);
});

it('verifica a sessao periodicamente e para ao sair, enviando o refresh para revogacao', async () => {
  vi.useFakeTimers();
  sessionStorage.setItem('access_token', 'access');
  sessionStorage.setItem('refresh_token', 'refresh');
  const post = vi.spyOn(axios, 'post').mockResolvedValue({});
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await act(async () => {});
  expect(authApi.me).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
  expect(authApi.me).toHaveBeenCalledTimes(2);
  await act(async () => { result.current.logout(); });
  expect(result.current.isLoggedIn).toBe(false);
  expect(post).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), { refresh_token: 'refresh' }, expect.anything());
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
  expect(authApi.me).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem('refresh_token')).toBeNull();
});

it('uma falha temporaria na verificacao nao encerra a sessao', async () => {
  sessionStorage.setItem('access_token', 'access');
  vi.mocked(authApi.me).mockRejectedValue({ response: { status: 503 } });
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await act(async () => {});
  expect(result.current.isLoggedIn).toBe(true);
  expect(sessionStorage.getItem('access_token')).toBe('access');
});
