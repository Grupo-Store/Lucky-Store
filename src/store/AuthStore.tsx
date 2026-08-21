import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { authApi } from '@/api/auth';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

type AuthStage = 'login' | 'verify' | 'authed';

interface AuthContextType {
  stage: AuthStage;
  isLoggedIn: boolean;
  email: string;
  isPending: boolean;
  isResending: boolean;
  /** Step 1: call POST /auth/login. Returns error message or null on success. */
  login: (email: string, pass: string) => Promise<string | null>;
  /** Step 2: call POST /auth/verify-2fa. Returns error message or null on success. */
  verifyCode: (code: string) => Promise<string | null>;
  /** Resend 2FA code: call POST /auth/resend-2fa. Returns error message or null on success. */
  resendCode: () => Promise<string | null>;
  resetToLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<AuthStage>(() =>
    localStorage.getItem('access_token') ? 'authed' : 'login'
  );
  const [email, setEmail] = useState(() => localStorage.getItem('user_email') ?? '');
  const [isPending, setIsPending] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // On mount: validate the stored token and rehydrate the user's email from the server.
  // If the access token is expired, client.ts interceptor automatically refreshes it.
  // If both tokens are expired, client.ts clears localStorage and reloads the page.
  useEffect(() => {
    if (stage !== 'authed') return;
    authApi.me()
      .then((user) => {
        setEmail(user.email);
        localStorage.setItem('user_email', user.email);
      })
      .catch((err) => {
        // Só derruba a sessão quando o servidor DIZ que a credencial não vale.
        //
        // Antes, o catch era genérico: qualquer falha — backend fora do ar,
        // 502/503 do Railway, wi-fi caindo por um segundo — limpava os tokens e
        // jogava o usuário na tela de login, sem mensagem nenhuma. O trabalho em
        // aberto ia junto.
        //
        // Expiração de verdade já é tratada em client.ts, que tenta o refresh e,
        // se ele falhar, limpa o localStorage e recarrega a página. Aqui só
        // resta o caso de o servidor recusar explicitamente a credencial.
        const status = err?.response?.status;
        const credencialRecusada = status === 401 || status === 403;
        if (!credencialRecusada) return; // rede/servidor instável: mantém a sessão

        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_email');
        setStage('login');
        setEmail('');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (emailInput: string, pass: string): Promise<string | null> => {
    setIsPending(true);
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, { email: emailInput, password: pass });
      if (response.status === 202 && response.data?.detail?.requires_2fa) {
        setEmail(emailInput);
        setStage('verify');
        return null;
      }
      return 'Resposta inesperada do servidor.';
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) return 'Email ou senha incorretos.';
      if (status === 422) return 'Formato de email inválido.';
      return 'Erro ao conectar ao servidor. Tente novamente.';
    } finally {
      setIsPending(false);
    }
  };

  const verifyCode = async (code: string): Promise<string | null> => {
    setIsPending(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/verify-2fa`, { email, code });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_email', email);
      window.history.replaceState({}, '', '/');
      setStage('authed');
      return null;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) return 'Código inválido ou expirado.';
      return 'Erro ao verificar código. Tente novamente.';
    } finally {
      setIsPending(false);
    }
  };

  const resendCode = async (): Promise<string | null> => {
    if (!email) return 'Nenhum e-mail para reenviar.';
    setIsResending(true);
    try {
      await axios.post(`${BASE_URL}/auth/resend-2fa`, { email });
      return null;
    } catch {
      return 'Erro ao reenviar código. Tente novamente.';
    } finally {
      setIsResending(false);
    }
  };

  const resetToLogin = () => {
    setStage('login');
    setEmail('');
  };

  const logout = () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.post(`${BASE_URL}/auth/logout`, null, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_email');
    setStage('login');
    setEmail('');
  };

  return (
    <AuthContext.Provider value={{
      stage, isLoggedIn: stage === 'authed', email, isPending, isResending,
      login, verifyCode, resendCode, resetToLogin, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
