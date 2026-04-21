import { useState } from 'react';
import { useAuth } from '@/store/AuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import logoLuckyStore from '@/assets/logo-lucky-store.png';
import logoBTech from '@/assets/logo-btech.png';
import logoAJJ from '@/assets/logo-ajj.png';

/* -------------------- BRAND HEADER -------------------- */
const NAVY = '#001F5B';
const BrandHeader = () => (
  <div className="text-center mb-8">
    <h1 className="text-3xl md:text-4xl font-bold text-secondary tracking-tight">
      Bem vindo ao Grupo Lucky
    </h1>
    <div
      className="mt-6 flex items-center justify-center gap-4 flex-wrap bg-card/95 rounded-xl px-5 py-4 shadow-sm border border-secondary/10 text-lg md:text-xl font-bold tracking-wide"
      style={{ color: NAVY }}
    >
      <span>Lucky Store</span>
      <span style={{ color: NAVY, opacity: 0.4 }}>|</span>
      <span>BTech</span>
      <span style={{ color: NAVY, opacity: 0.4 }}>|</span>
      <span>AJJ</span>
    </div>
  </div>
);

/* -------------------- LOGIN STAGE -------------------- */
function LoginStage() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(user, pass)) {
      setError('Por favor, informe usuário e senha.');
    } else {
      setError('');
      toast.success('Código enviado para o e-mail cadastrado.');
    }
  };

  const handleForgot = () => {
    toast.info('Um link de recuperação foi enviado para o seu e-mail (simulação).');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs uppercase tracking-wider text-secondary font-bold">Usuário</Label>
        <Input
          placeholder="Digite seu usuário"
          value={user}
          onChange={e => setUser(e.target.value)}
          className="bg-white border-secondary/20 mt-1"
          autoFocus
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-secondary font-bold">Senha</Label>
        <Input
          type="password"
          placeholder="Digite sua senha"
          value={pass}
          onChange={e => setPass(e.target.value)}
          className="bg-white border-secondary/20 mt-1"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-11 text-base font-semibold">
        Entrar
      </Button>
      <button
        type="button"
        onClick={handleForgot}
        className="w-full text-center text-sm text-secondary hover:text-secondary/80 hover:underline pt-1"
      >
        Recuperar Senha
      </button>
    </form>
  );
}

/* -------------------- VERIFY STAGE -------------------- */
function VerifyStage() {
  const { username, verifyCode, resetToLogin } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleVerify = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!verifyCode(code)) {
      setError('Código inválido. Digite os 6 dígitos enviados ao e-mail.');
    }
  };

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-secondary" />
        </div>
        <h2 className="text-xl font-bold text-secondary">Verificação em 2 Etapas</h2>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
          <Mail className="h-4 w-4" />
          Enviamos um código de 6 dígitos para o e-mail cadastrado de
          <span className="font-semibold text-foreground"> {username}</span>
        </p>
      </div>

      <div className="flex justify-center py-2">
        <InputOTP maxLength={6} value={code} onChange={setCode}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      <Button
        type="submit"
        disabled={code.length !== 6}
        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-11 text-base font-semibold"
      >
        Verificar
      </Button>

      <button
        type="button"
        onClick={resetToLogin}
        className="w-full text-center text-sm text-muted-foreground hover:text-secondary inline-flex items-center justify-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
      </button>

      <p className="text-xs text-center text-muted-foreground">
        Não recebeu? <button type="button" onClick={() => toast.success('Novo código enviado.')} className="underline hover:text-secondary">Reenviar código</button>
      </p>
    </form>
  );
}

/* -------------------- ROOT -------------------- */
export function LoginScreen() {
  const { stage } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary to-secondary/40 p-4">
      <div className="w-full max-w-md">
        <BrandHeader />
        <Card className="shadow-2xl border-secondary/10">
          <CardContent className="pt-8 pb-8 px-6 md:px-8">
            {stage === 'login' && <LoginStage />}
            {stage === 'verify' && <VerifyStage />}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-white/80 mt-6 font-medium tracking-wide">
          © {new Date().getFullYear()} Grupo Lucky · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
