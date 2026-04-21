import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, Plus, Trash2 } from 'lucide-react';
import { Gain, GainKind, gainNet, InstallmentPlan } from '@/store/FinanceStore';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PaymentMethod } from '@/store/OrderStore';
import { DateField } from './DateField';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

interface Props {
  open: boolean;
  onClose: () => void;
  gain?: Gain | null;
  onSave: (g: Gain) => void;
}

const empty = (kind: GainKind): Gain => ({
  id: uid(), kind, customer: '', cnpj: '', value: 0, os: '',
  registrationDate: today(), paidDate: '', paymentMethod: '',
  creditCost: 0, debitCost: 0, boletoCost: 0,
});

export function GainModal({ open, onClose, gain, onSave }: Props) {
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [g, setG] = useState<Gain>(empty('MULTA'));

  useEffect(() => {
    if (open) {
      if (gain) { setG(gain); setStep('form'); }
      else { setG(empty('MULTA')); setStep('pick'); }
    }
  }, [open, gain]);

  const upd = <K extends keyof Gain>(k: K, v: Gain[K]) => setG(prev => ({ ...prev, [k]: v }));

  const isCredit = g.paymentMethod === 'Credit Card';
  const totalCost = g.creditCost + g.debitCost + g.boletoCost;
  const net = gainNet(g);

  // Sync installment plan length with installments count
  useEffect(() => {
    if (!isCredit) return;
    const n = g.installments || 0;
    const cur = g.installmentPlan || [];
    if (cur.length === n) return;
    const valuePer = n > 0 ? +(g.value / n).toFixed(2) : 0;
    const next: InstallmentPlan[] = Array.from({ length: n }, (_, i) =>
      cur[i] || { date: '', value: valuePer }
    );
    upd('installmentPlan', next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.installments, isCredit]);

  const setInstallment = (i: number, patch: Partial<InstallmentPlan>) => {
    const next = (g.installmentPlan || []).map((p, idx) => idx === i ? { ...p, ...patch } : p);
    upd('installmentPlan', next);
  };

  if (step === 'pick') {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Ganho</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha o tipo de ganho:</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-24 flex-col gap-1 border-blue-500 text-blue-700 hover:bg-blue-50"
              onClick={() => { setG({ ...empty('MULTA') }); setStep('form'); }}
            >
              <span className="text-lg font-bold">MULTA</span>
              <span className="text-xs">Penalidade</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-1 border-green-600 text-green-700 hover:bg-green-50"
              onClick={() => { setG({ ...empty('JUROS') }); setStep('form'); }}
            >
              <span className="text-lg font-bold">JUROS</span>
              <span className="text-xs">Interest</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ganho — <span className={g.kind === 'MULTA' ? 'text-blue-700' : 'text-green-700'}>{g.kind}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Section 1 */}
        <Card><CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold text-secondary">1. Informações Gerais</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cliente</Label><Input value={g.customer} onChange={e => upd('customer', e.target.value)} /></div>
            <div><Label>CPF/CNPJ</Label><Input value={g.cnpj} onChange={e => upd('cnpj', e.target.value)} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" value={g.value || ''} onChange={e => upd('value', +e.target.value || 0)} /></div>
            <div><Label>OS do pedido</Label><Input value={g.os} onChange={e => upd('os', e.target.value)} /></div>
            <div><Label>Data Cadastro</Label><DateField value={g.registrationDate} onChange={v => upd('registrationDate', v)} /></div>
            <div><Label>Data Pago</Label><DateField value={g.paidDate} onChange={v => upd('paidDate', v)} /></div>
          </div>
        </CardContent></Card>

        {/* Section 2 */}
        <Card><CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold text-secondary">2. Financeiro</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={g.paymentMethod || ''} onValueChange={v => upd('paymentMethod', v as PaymentMethod)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isCredit && (
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} value={g.installments || ''} onChange={e => upd('installments', +e.target.value || 1)} />
              </div>
            )}
          </div>

          {isCredit && (g.installmentPlan || []).length > 0 && (
            <div className="space-y-2">
              <Label>Datas e valores das parcelas</Label>
              {(g.installmentPlan || []).map((p, i) => (
                <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
                  <span className="text-sm font-medium">{i + 1}ª</span>
                  <DateField value={p.date} onChange={v => setInstallment(i, { date: v })} />
                  <Input type="number" value={p.value || ''} onChange={e => setInstallment(i, { value: +e.target.value || 0 })} />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Custo Crédito (R$)</Label><Input type="number" value={g.creditCost || ''} onChange={e => upd('creditCost', +e.target.value || 0)} /></div>
            <div><Label>Custo Débito (R$)</Label><Input type="number" value={g.debitCost || ''} onChange={e => upd('debitCost', +e.target.value || 0)} /></div>
            <div><Label>Custo Boleto (R$)</Label><Input type="number" value={g.boletoCost || ''} onChange={e => upd('boletoCost', +e.target.value || 0)} /></div>
          </div>
        </CardContent></Card>

        {/* Section 3 */}
        <Card><CardContent className="pt-4">
          <h3 className="font-semibold text-secondary mb-2">3. Resumo</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-xs text-muted-foreground">Valor</div><div className="text-lg font-bold">{BRL(g.value)}</div></div>
            <div><div className="text-xs text-muted-foreground">Gastos</div><div className="text-lg font-bold text-destructive">{BRL(totalCost)}</div></div>
            <div><div className="text-xs text-muted-foreground">Ganho</div><div className="text-lg font-bold text-green-700">{BRL(net)}</div></div>
          </div>
        </CardContent></Card>

        <div className="flex justify-end gap-2 pt-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSave(g); onClose(); }}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
