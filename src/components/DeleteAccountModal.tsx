import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/store/AuthStore';
import { usersApi } from '@/api/users';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalStep = 'form' | 'success';

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const { email, login, logout } = useAuth();

  const [step, setStep] = useState<ModalStep>('form');
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userIdError, setUserIdError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setConfirmed(false);
    setPassword('');
    setPasswordError(null);
    setModalError(null);
    setUserId(null);
    setUserIdError(null);

    usersApi.me()
      .then((user) => setUserId(user.id))
      .catch(() => setUserIdError('Não foi possível carregar os dados da conta.'));
  }, [open]);

  const handleSubmit = async () => {
    if (!userId) return;
    setPasswordError(null);
    setModalError(null);
    setIsPending(true);

    try {
      const loginError = await login(email, password);
      if (loginError) {
        setPasswordError(
          loginError.includes('incorretos') ? 'Senha incorreta.' : 'Erro ao verificar senha. Tente novamente.'
        );
        return;
      }

      const result = await usersApi.deleteData(userId);
      if (result.deleted) {
        setStep('success');
        setTimeout(logout, 2000);
      } else {
        setModalError('Erro ao deletar conta. Tente novamente.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) setModalError('Sem permissão para excluir esta conta.');
      else if (status === 404) setModalError('Conta não encontrada.');
      else setModalError('Erro ao deletar conta. Tente novamente.');
    } finally {
      setIsPending(false);
    }
  };

  const canSubmit = confirmed && password.length > 0 && !isPending && !!userId && !userIdError;

  const handleOpenChange = (value: boolean) => {
    if (step === 'success') return;
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <p className="text-base font-semibold">Sua conta foi deletada com sucesso.</p>
              <p className="text-sm text-muted-foreground mt-1">Você será desconectado em instantes.</p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Deletar conta
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta ação é <strong>permanente e irreversível</strong>. Seus dados serão apagados e
                  sua conta será desativada.
                </AlertDescription>
              </Alert>

              {userIdError && (
                <p className="text-sm text-destructive">{userIdError}</p>
              )}

              {modalError && (
                <p className="text-sm text-destructive">{modalError}</p>
              )}

              <div className="flex items-start gap-3">
                <Checkbox
                  id="confirm-check"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(!!v)}
                  disabled={isPending}
                />
                <Label htmlFor="confirm-check" className="text-sm leading-snug cursor-pointer">
                  Entendo que esta ação é permanente e irreversível
                </Label>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-password">Confirme sua senha para continuar</Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder="Sua senha atual"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  disabled={isPending}
                />
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aguarde…
                  </>
                ) : (
                  'Deletar minha conta'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
