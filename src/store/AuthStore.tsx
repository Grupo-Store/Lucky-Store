import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { authApi } from '@/api/auth';
import { clearAuthSession, saveAuthTokens, SESSION_ENDED_EVENT } from '@/lib/auth-session';

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
    sessionStorage.getItem('access_token') ? 'authed' : 'login'
  );
  const [email, setEmail] = useState(() => sessionStorage.getItem('user_email') ?? '');
  const [isPending, setIsPending] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const ended = () => { setStage('login'); setEmail(''); };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
  }, []);

  // Validate on login/reload and keep renewing while the tab remains open.
  // Browsers may suspend background timers, so also check when the tab returns.
  useEffect(() => {
    if (stage !== 'authed') return;
    let active = true;
    let checking = false;
    const checkSession = () => {
      if (checking || !sessionStorage.getItem('access_token')) return;
      checking = true;
      const token = sessionStorage.getItem('refresh_token');
      authApi.me()
        .then((user) => {
          if (!active || !sessionStorage.getItem('access_token')) return;
          setEmail(user.email);
          sessionStorage.setItem('user_email', user.email);
        })
        .catch((err) => {
          if (!active) return;
          const status = err?.response?.status;
          const credencialRecusada = status === 401 || status === 403;
          if (credencialRecusada && sessionStorage.getItem('refresh_token') === token) clearAuthSession();
        })
        .finally(() => { checking = false; });
    };
    checkSession();
    const interval = window.setInterval(checkSession, 5 * 60_000);
    const visible = () => { if (document.visibilityState === 'visible') checkSession(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', checkSession);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', checkSession);
    };
  }, [stage]);

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
      saveAuthTokens(data);
      sessionStorage.setItem('user_email', email);
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
    const token = sessionStorage.getItem('access_token');
    if (token) {
      axios.post(`${BASE_URL}/auth/logout`, { refresh_token: sessionStorage.getItem('refresh_token') }, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    clearAuthSession();
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
