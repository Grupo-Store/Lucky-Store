import React, { createContext, useContext, useState } from 'react';

type AuthStage = 'login' | 'verify' | 'authed';

interface AuthContextType {
  stage: AuthStage;
  isLoggedIn: boolean;
  username: string;
  /** Step 1: validate credentials, returns true if accepted (advances to verify). */
  login: (user: string, pass: string) => boolean;
  /** Step 2: verify the 6-digit code (mock — any 6 digits accepted). */
  verifyCode: (code: string) => boolean;
  /** Reset back to login stage (used by "Recuperar Senha" flow & cancel). */
  resetToLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<AuthStage>('login');
  const [username, setUsername] = useState('');

  const login = (user: string, pass: string) => {
    if (user && pass) {
      setUsername(user);
      setStage('verify');
      return true;
    }
    return false;
  };

  const verifyCode = (code: string) => {
    // UI-only mock: accept any 6-digit numeric code
    if (/^\d{6}$/.test(code)) {
      setStage('authed');
      return true;
    }
    return false;
  };

  const resetToLogin = () => { setStage('login'); };
  const logout = () => { setStage('login'); setUsername(''); };

  return (
    <AuthContext.Provider value={{
      stage, isLoggedIn: stage === 'authed', username,
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
