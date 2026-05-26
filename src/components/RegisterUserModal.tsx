import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { apiClient, getApiError } from '@/api/client'
import { useCreateVendedor } from '@/hooks/useVendedores'
import { LOJA_IDS } from '@/api/storeConfig'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const empty = () => ({ name: '', email: '', password: '', confirm: '' })

export function RegisterUserModal({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(empty)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { mutateAsync: createVendedor } = useCreateVendedor()

  const set = (key: keyof ReturnType<typeof empty>, v: string) =>
    setForm(prev => ({ ...prev, [key]: v }))

  const reset = () => setForm(empty())

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return }
    if (!form.email.trim()) { toast.error('E-mail é obrigatório'); return }
    if (!form.password) { toast.error('Senha é obrigatória'); return }
    if (form.password.length < 8) { toast.error('Senha deve ter ao menos 8 caracteres'); return }
    if (form.password !== form.confirm) { toast.error('As senhas não coincidem'); return }

    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      const lojaId = LOJA_IDS['Lucky Store']
      if (lojaId) {
        await createVendedor({
          nome: form.name.trim(),
          email: form.email.trim(),
          id_loja: lojaId,
        })
      }

      toast.success(`Usuário "${form.name.trim()}" cadastrado com sucesso`)
      handleClose()
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Usuário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reg-name">Nome</Label>
            <Input
              id="reg-name"
              placeholder="Nome completo"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">E-mail</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="email@exemplo.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Senha</Label>
            <Input
              id="reg-password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm">Confirmar senha</Label>
            <Input
              id="reg-confirm"
              type="password"
              placeholder="Repita a senha"
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              disabled={isSubmitting}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cadastrando...</>
              : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
