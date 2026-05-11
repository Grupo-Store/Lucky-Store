import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

type AuthStage = 'login' | 'verify' | 'authed';

interface AuthContextType {
  stage: AuthStage;
  isLoggedIn: boolean;
  email: string;
  isPending: boolean;
  /** Step 1: call POST /auth/login. Returns error message or null on success. */
  login: (email: string, pass: string) => Promise<string | null>;
  /** Step 2: call POST /auth/verify-2fa. Returns error message or null on success. */
  verifyCode: (code: string) => Promise<string | null>;
  resetToLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<AuthStage>('login');
  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);

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
    setStage('login');
    setEmail('');
  };

  return (
    <AuthContext.Provider value={{
      stage, isLoggedIn: stage === 'authed', email, isPending,
      login, verifyCode, resetToLogin, logout,
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
