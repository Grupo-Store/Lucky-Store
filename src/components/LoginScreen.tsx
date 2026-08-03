import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/AuthStore';
import { toast } from 'sonner';

// ── Keyframes + utilities injected once ────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes gl-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes gl-orb-drift {
    from { transform: translate(0, 0) scale(1); }
    to   { transform: translate(-4%, 4%) scale(1.06); }
  }
  @media (prefers-reduced-motion: reduce) {
    .gl-card-enter { animation: none !important; }
    .gl-orb        { animation: none !important; }
    .gl-arrow      { transition: none !important; }
  }
  .gl-card-enter {
    animation: gl-fade-up 0.35s cubic-bezier(.22,.68,0,1.1) both;
  }
  .gl-orb {
    animation: gl-orb-drift 12s ease-in-out infinite alternate;
  }
  .gl-submit:not(:disabled):hover {
    opacity: 0.91;
    box-shadow: 0 10px 28px -4px rgba(47,107,255,.55) !important;
  }
  .gl-submit:not(:disabled):hover .gl-arrow {
    transform: translateX(4px);
  }
  .gl-arrow { transition: transform 0.18s ease; }
  .gl-input:focus {
    border-color: #2F6BFF !important;
    box-shadow: 0 0 0 4px #EAF0FF !important;
  }
  .gl-digit:focus {
    border-color: #2F6BFF !important;
    box-shadow: 0 0 0 4px #EAF0FF !important;
  }
  .gl-back:hover { color: #2F6BFF !important; }
  @media (max-width: 919px) {
    .gl-brand-panel  { display: none !important; }
    .gl-mobile-brand { display: flex !important; }
  }
  @media (min-width: 920px) {
    .gl-mobile-brand { display: none !important; }
  }
`;

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  text:        '#16273F',
  sub:         '#5B6B82',
  border:      '#E2E8F1',
  accent:      '#2F6BFF',
  accentDark:  '#1E4FD8',
  accentSoft:  '#EAF0FF',
  card:        '#FFFFFF',
  bg:          '#F4F7FB',
  inputBg:     '#FBFCFE',
  iconStroke:  '#93A4BC',
  disabled:    '#C6D2E3',
  disabledTxt: '#8FA7C4',
};

const SG = "'Space Grotesk', sans-serif";
const IR = "'Inter', sans-serif";

// ── Brand panel (desktop left column) ─────────────────────────────────────────
function BrandPanel() {
  return (
    <div
      className="gl-brand-panel"
      style={{
        width: '46%', minWidth: 340, flexShrink: 0,
        background: 'linear-gradient(160deg, #0B1626 0%, #0E1C31 100%)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '2.75rem 2.5rem',
      }}
    >
      {/* Corner radial accents */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(ellipse 60% 45% at 0% 0%, rgba(26,58,107,.45) 0%, transparent 70%),' +
          'radial-gradient(ellipse 55% 40% at 100% 100%, rgba(20,48,90,.5) 0%, transparent 70%)',
      }} />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'repeating-linear-gradient(rgba(255,255,255,.045) 0px, rgba(255,255,255,.045) 1px, transparent 1px, transparent 56px),' +
          'repeating-linear-gradient(90deg, rgba(255,255,255,.045) 0px, rgba(255,255,255,.045) 1px, transparent 1px, transparent 56px)',
        WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 100%)',
        maskImage:       'radial-gradient(ellipse 85% 85% at 50% 50%, #000 40%, transparent 100%)',
      }} />

      {/* Orb */}
      <div className="gl-orb" style={{
        position: 'absolute', bottom: '-12%', right: '-12%',
        width: '65%', height: '65%', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(111,160,255,.35) 0%, transparent 68%)',
        filter: 'blur(44px)', pointerEvents: 'none',
      }} />

      {/* Monogram + brand name */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #2F6BFF 0%, #7AA6FF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontFamily: SG, fontWeight: 700, fontSize: 15, letterSpacing: '.02em' }}>GS</span>
        </div>
        <span style={{ color: '#A9BCD9', fontFamily: SG, fontSize: 13.5, fontWeight: 500 }}>
          Grupo Store · Portal
        </span>
      </div>

      {/* Centre copy */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{
          color: '#8FB1E8', fontFamily: SG, fontSize: 10.5,
          fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          Gestão Integrada
        </p>

        <h2 style={{
          fontFamily: SG, fontWeight: 700, lineHeight: 1.22, color: '#E8EFF9',
          fontSize: 'clamp(1.55rem, 2.5vw, 2.05rem)', marginBottom: 16,
        }}>
          Todas as suas lojas,{' '}
          <span style={{
            background: 'linear-gradient(90deg, #7AA6FF 0%, #BFD5FF 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            um único painel.
          </span>
        </h2>

        <p style={{ color: '#A9BCD9', fontSize: 13.5, lineHeight: 1.7, marginBottom: 28 }}>
          Gerencie pedidos, metas e finanças de todas as unidades do grupo em um painel unificado.
        </p>

        {/* Operation chips */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['Lucky Store', 'BTech Store'].map(name => (
            <div key={name} style={{
              border: '1px solid rgba(143,177,232,.28)',
              background: 'rgba(255,255,255,.04)',
              borderRadius: 99, padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#6FA0FF', flexShrink: 0,
                boxShadow: '0 0 7px #6FA0FF',
              }} />
              <span style={{ color: '#C5D8F0', fontSize: 13, fontFamily: SG, fontWeight: 500 }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{ position: 'relative', zIndex: 1, color: '#6F84A3', fontSize: 12 }}>
        © 2026 Grupo Store · Todos os direitos reservados
      </p>
    </div>
  );
}

// ── Mobile-only compact brand header ──────────────────────────────────────────
function MobileBrandHeader() {
  return (
    <div
      className="gl-mobile-brand"
      style={{
        display: 'none', // overridden by media query on mobile
        background: 'linear-gradient(135deg, #0B1626 0%, #0E1C31 100%)',
        padding: '1.25rem 1.5rem',
        alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #2F6BFF 0%, #7AA6FF 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#fff', fontFamily: SG, fontWeight: 700, fontSize: 13 }}>GL</span>
      </div>
      <span style={{ color: '#A9BCD9', fontFamily: SG, fontSize: 13, fontWeight: 500 }}>
        Grupo Store · Portal
      </span>
    </div>
  );
}

// ── Shared input styles ────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', paddingTop: 11, paddingBottom: 11, paddingRight: 14,
  paddingLeft: 40, border: `1px solid ${T.border}`, borderRadius: 12,
  fontSize: 14, background: T.inputBg, color: T.text,
  outline: 'none', transition: 'border-color .15s, box-shadow .15s',
  fontFamily: IR,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: T.sub, marginBottom: 6,
};

// ── Icon: envelope ─────────────────────────────────────────────────────────────
const IconMail = () => (
  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke={T.iconStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

// ── Icon: lock ─────────────────────────────────────────────────────────────────
const IconLock = () => (
  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
    width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke={T.iconStroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ── LOGIN STAGE ────────────────────────────────────────────────────────────────
function LoginStage() {
  // ── all existing logic preserved ──────────────────────────────────────────
  const { login, isPending } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const err = await login(email, pass);
    if (err) {
      setError(err);
    } else {
      toast.success('Código enviado para o e-mail cadastrado.');
    }
  };

  const handleForgot = () => {
    toast.info('Um link de recuperação foi enviado para o seu e-mail (simulação).');
  };
  // ── ui-only state ──────────────────────────────────────────────────────────
  const [showPass, setShowPass] = useState(false);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Heading */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: '1.65rem', color: T.text, lineHeight: 1.2, margin: 0 }}>
          Bem-vindo de volta
        </h1>
        <p style={{ color: T.sub, fontSize: 14, marginTop: 7, lineHeight: 1.55 }}>
          Entre com suas credenciais para acessar o painel do grupo.
        </p>
      </div>

      {/* E-mail */}
      <div>
        <label style={labelStyle}>E-mail</label>
        <div style={{ position: 'relative' }}>
          <IconMail />
          <input
            className="gl-input"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            required
            style={inputStyle}
          />
        </div>
      </div>

      {/* Senha */}
      <div>
        <label style={labelStyle}>Senha</label>
        <div style={{ position: 'relative' }}>
          <IconLock />
          <input
            className="gl-input"
            type={showPass ? 'text' : 'password'}
            placeholder="••••••••"
            value={pass}
            onChange={e => setPass(e.target.value)}
            required
            style={{ ...inputStyle, paddingRight: 44 }}
          />
          {/* Show / hide toggle — UI only */}
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            tabIndex={-1}
            aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
            style={{
              position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              color: T.iconStroke, lineHeight: 0,
            }}
          >
            {showPass ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Recuperar senha */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
        <button
          type="button"
          onClick={handleForgot}
          style={{ fontSize: 13, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Recuperar senha
        </button>
      </div>

      {error && (
        <p style={{ color: '#DC2626', fontSize: 13, margin: '-6px 0' }}>{error}</p>
      )}

      {/* Entrar */}
      <button
        type="submit"
        disabled={isPending}
        className="gl-submit"
        style={{
          width: '100%',
          background: isPending ? T.disabled : `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
          boxShadow: isPending ? 'none' : '0 6px 22px -4px rgba(47,107,255,.42)',
          color: isPending ? T.disabledTxt : '#fff',
          border: 'none', borderRadius: 12,
          padding: '13px 20px', fontSize: 15, fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: SG, transition: 'opacity .15s, box-shadow .15s',
        }}
      >
        {isPending ? 'Entrando...' : (
          <>
            Entrar
            <svg className="gl-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>

      {/* Card footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <p style={{ fontSize: 12, color: T.sub, textAlign: 'center', lineHeight: 1.55 }}>
          Acesso restrito a colaboradores autorizados do Grupo Store.
        </p>
      </div>
    </form>
  );
}

// ── VERIFY STAGE ───────────────────────────────────────────────────────────────
function VerifyStage() {
  // ── all existing logic preserved ──────────────────────────────────────────
  const { email, verifyCode, resendCode, resetToLogin, isPending, isResending } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const err = await verifyCode(code);
    if (err) setError(err);
  };

  const handleResend = async () => {
    const err = await resendCode();
    if (err) {
      toast.error(err);
    } else {
      toast.success('Novo código enviado para o seu e-mail.');
      // reset timer (UI only)
      setCountdown(45);
      setCanResend(false);
    }
  };

  // ── ui-only state ──────────────────────────────────────────────────────────
  const [digits, setDigits]       = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync digits array → code string
  useEffect(() => {
    setCode(digits.join(''));
  }, [digits]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const updateDigit = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (!d) return;
    const next = [...digits];
    next[i] = d[d.length - 1];
    setDigits(next);
    if (i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next);
      } else if (i > 0) {
        const next = [...digits]; next[i - 1] = ''; setDigits(next);
        inputRefs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft'  && i > 0) { inputRefs.current[i - 1]?.focus(); }
    else if  (e.key === 'ArrowRight' && i < 5) { inputRefs.current[i + 1]?.focus(); }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const fmtTimer = () =>
    `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`;

  const allFilled = code.length === 6;

  return (
    <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Shield icon + heading */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{
          background: T.accentSoft, borderRadius: 16,
          width: 56, height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9,12 11,14 15,10" />
          </svg>
        </div>
        <div>
          <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: '1.45rem', color: T.text, margin: 0 }}>
            Verificação em 2 etapas
          </h1>
          <p style={{ color: T.sub, fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
            Insira o código de 6 dígitos enviado para{' '}
            <span style={{ fontWeight: 600, color: T.text }}>{email}</span>
          </p>
        </div>
      </div>

      {/* Segmented digit inputs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 9, padding: '4px 0' }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            className="gl-digit"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            autoFocus={i === 0}
            onChange={e => updateDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            aria-label={`Dígito ${i + 1}`}
            style={{
              width: 44, height: 51,
              textAlign: 'center',
              fontSize: 22, fontWeight: 600,
              fontFamily: SG,
              border: `1.5px solid ${d ? '#B9CBF5' : T.border}`,
              borderRadius: 12,
              background: d ? '#F6F9FF' : T.inputBg,
              color: T.text,
              outline: 'none',
              transition: 'border-color .15s, box-shadow .15s, background .15s',
              caretColor: 'transparent',
            }}
          />
        ))}
      </div>

      {error && (
        <p style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', margin: '-6px 0' }}>{error}</p>
      )}

      {/* Verificar e entrar */}
      <button
        type="submit"
        disabled={!allFilled || isPending}
        style={{
          width: '100%',
          background: !allFilled || isPending
            ? T.disabled
            : `linear-gradient(135deg, ${T.accent} 0%, ${T.accentDark} 100%)`,
          boxShadow: !allFilled || isPending ? 'none' : '0 6px 22px -4px rgba(47,107,255,.42)',
          color: !allFilled || isPending ? T.disabledTxt : '#fff',
          border: 'none', borderRadius: 12,
          padding: '13px 20px', fontSize: 15, fontWeight: 600,
          cursor: !allFilled || isPending ? 'not-allowed' : 'pointer',
          fontFamily: SG, transition: 'background .15s, box-shadow .15s',
        }}
      >
        {isPending ? 'Verificando...' : 'Verificar e entrar'}
      </button>

      {/* Timer + resend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: T.sub }}>
          {canResend ? 'Código expirado' : `Reenviar em ${fmtTimer()}`}
        </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend || isResending}
          style={{
            fontSize: 13, fontWeight: 500,
            color: canResend && !isResending ? T.accent : '#B0BEC5',
            background: 'none', border: 'none', padding: 0,
            cursor: canResend && !isResending ? 'pointer' : 'not-allowed',
            textDecoration: canResend && !isResending ? 'underline' : 'none',
          }}
        >
          {isResending ? 'Enviando...' : 'Reenviar código'}
        </button>
      </div>

      {/* Back to login */}
      <button
        type="button"
        onClick={resetToLogin}
        className="gl-back"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
          fontSize: 13, color: T.sub,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          transition: 'color .15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Voltar para o login
      </button>
    </form>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const { stage } = useAuth();
  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: IR }}>
        {/* Mobile compact brand */}
        <MobileBrandHeader />

        {/* Main row */}
        <div style={{ flex: 1, display: 'flex' }}>
          {/* Desktop brand panel */}
          <BrandPanel />

          {/* Form area */}
          <div style={{
            flex: 1, background: T.bg,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '2.5rem 1.5rem',
            minHeight: '100%',
          }}>
            <div
              key={stage}
              className="gl-card-enter"
              style={{
                width: '100%', maxWidth: 440,
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 18,
                boxShadow: '0 24px 60px -28px rgba(13,33,66,.18)',
                padding: '2.5rem 2.25rem',
              }}
            >
              {stage === 'login'  && <LoginStage />}
              {stage === 'verify' && <VerifyStage />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
