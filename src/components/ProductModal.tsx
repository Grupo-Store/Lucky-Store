import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Order, OrderItem, SubPurchase, ItemStatus, PaymentMethod,
  ITEM_STATUS_COLORS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS,
  SELLERS, calcItemFinalValue, calcItemLatestDelivery,
} from '@/store/OrderStore';

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'To Buy': 'A Comprar', 'Bought': 'Comprado', 'In Stock': 'Em Estoque',
};

function toBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso?: string) {
  if (!iso) return 'Selecionar';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

const emptySub = (): SubPurchase => ({
  id: crypto.randomUUID(),
  selectedQuantity: 1,
  supplier: '',
  buyer: '',
  purchaseDate: undefined,
  productDeliveryDate: undefined,
  receiptDate: undefined,
  purchaseValue: 0,
  paymentMethod: '',
  status: 'To Buy',
});

interface Props {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  item: OrderItem | null;
  onSave: (updatedOrder: Order) => void;
}

export function ProductModal({ open, onClose, order, item, onSave }: Props) {
  const [subs, setSubs] = useState<SubPurchase[]>([]);

  useEffect(() => {
    if (item) {
      setSubs(item.subPurchases ? [...item.subPurchases] : []);
    }
  }, [item, open]);

  const totalSelected = useMemo(() => subs.reduce((s, sp) => s + (sp.selectedQuantity || 0), 0), [subs]);
  const projected = item?.projectedValue || 0;
  const finalValue = useMemo(() => subs.reduce((s, sp) => s + (sp.purchaseValue || 0), 0), [subs]);
  const savings = projected - finalValue;
  const overQuantity = item ? totalSelected > (item.quantity || 0) : false;

  if (!order || !item) return null;

  const updateSub = (id: string, field: keyof SubPurchase, value: any) => {
    setSubs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  const addSub = () => setSubs(prev => [...prev, emptySub()]);
  const removeSub = (id: string) => setSubs(prev => prev.filter(s => s.id !== id));

  const handleSave = () => {
    const updatedItem: OrderItem = {
      ...item,
      subPurchases: subs,
    };
    // recompute aggregated fields
    updatedItem.purchaseValue = calcItemFinalValue(updatedItem);
    updatedItem.productDeliveryDate = calcItemLatestDelivery(updatedItem);

    const updatedOrder: Order = {
      ...order,
      items: order.items.map(i => i.id === item.id ? updatedItem : i),
    };
    // Recompute order's finalProductCost as the sum of all items' purchase values
    updatedOrder.finalProductCost = updatedOrder.items.reduce((s, i) => s + (i.purchaseValue || 0), 0);
    onSave(updatedOrder);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl">
            Produto: {item.name} <span className="text-sm text-muted-foreground font-normal">(OS #{order.os})</span>
          </DialogTitle>
        </DialogHeader>

        {/* ============== 1. INFORMAÇÕES GERAIS ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><Label>OS Pai</Label><Input readOnly value={order.os} className="bg-muted border-border font-semibold" /></div>
            <div><Label>Quantidade Total</Label><Input readOnly value={item.quantity} className="bg-muted border-border" /></div>
            <div><Label>Valor Projetado</Label><Input readOnly value={toBRL(projected)} className="bg-muted border-border" /></div>
            <div><Label>Cliente</Label><Input readOnly value={order.customer} className="bg-muted border-border" /></div>
            <div><Label>CNPJ</Label><Input readOnly value={order.cnpj || '—'} className="bg-muted border-border" /></div>
            <div><Label>Vendedor</Label><Input readOnly value={order.seller || '—'} className="bg-muted border-border" /></div>
            <div><Label>Empresa</Label><Input readOnly value={order.company || '—'} className="bg-muted border-border" /></div>
            <div><Label>Data do Pedido</Label><Input readOnly value={fmtDate(order.orderDate)} className="bg-muted border-border" /></div>
          </div>
        </section>

        {/* ============== 2. DETALHES — SUB-COMPRAS ============== */}
        <section className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Detalhes das Compras</h3>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-md border font-medium',
                overQuantity
                  ? 'bg-[hsl(var(--st-cancelled)/0.15)] text-[hsl(var(--st-cancelled))] border-[hsl(var(--st-cancelled)/0.5)]'
                  : 'bg-muted text-muted-foreground border-border'
              )}>
                Selecionado: {totalSelected} / {item.quantity}
              </span>
              {overQuantity && (
                <span className="flex items-center gap-1 text-xs text-[hsl(var(--st-cancelled))] font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" /> Excede quantidade do produto
                </span>
              )}
            </div>
            <Button size="sm" onClick={addSub} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Compra
            </Button>
          </div>

          <div className="space-y-3">
            {subs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma sub-compra adicionada</p>
            )}
            {subs.map((sp, idx) => (
              <div key={sp.id} className="border rounded-md p-3 bg-muted/20 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-secondary">Compra #{idx + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeSub(sp.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Qtd. Selecionada</Label>
                    <Input type="number" min={1} max={item.quantity} className="bg-white border-border"
                      value={sp.selectedQuantity}
                      onChange={e => updateSub(sp.id, 'selectedQuantity', parseInt(e.target.value) || 0)}
                      onKeyDown={handleEnterBlur} />
                  </div>
                  <div>
                    <Label>Fornecedor</Label>
                    <Input className="bg-white border-border"
                      value={sp.supplier}
                      onChange={e => updateSub(sp.id, 'supplier', e.target.value)}
                      onKeyDown={handleEnterBlur} />
                  </div>
                  <div>
                    <Label>Comprador</Label>
                    <Input className="bg-white border-border"
                      value={sp.buyer}
                      onChange={e => updateSub(sp.id, 'buyer', e.target.value)}
                      onKeyDown={handleEnterBlur} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={sp.status} onValueChange={v => updateSub(sp.id, 'status', v as ItemStatus)}>
                      <SelectTrigger className={cn('border', ITEM_STATUS_COLORS[sp.status])}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                          <SelectItem key={s} value={s}>
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DateField label="Data da Compra" value={sp.purchaseDate} onChange={d => updateSub(sp.id, 'purchaseDate', d)} />
                  <DateField label="Entrega do Produto" value={sp.productDeliveryDate} onChange={d => updateSub(sp.id, 'productDeliveryDate', d)} />
                  <DateField label="Data de Recebimento" value={sp.receiptDate} onChange={d => updateSub(sp.id, 'receiptDate', d)} />

                  <div>
                    <Label>Valor de Compra (R$)</Label>
                    <Input type="number" step="0.01" className="bg-white border-border"
                      value={sp.purchaseValue || ''}
                      onChange={e => updateSub(sp.id, 'purchaseValue', parseFloat(e.target.value) || 0)}
                      onKeyDown={handleEnterBlur} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={sp.paymentMethod || ''} onValueChange={v => updateSub(sp.id, 'paymentMethod', v as PaymentMethod)}>
                      <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => (
                          <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============== 3. RESUMO ============== */}
        <section className="border rounded-lg p-4 bg-secondary/5">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Resumo de Valores</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Valor Projetado</Label>
              <Input readOnly value={toBRL(projected)} className="bg-muted border-border font-semibold" />
            </div>
            <div>
              <Label>Valor Final (sub-compras)</Label>
              <Input readOnly value={toBRL(finalValue)} className="bg-muted border-border font-semibold" />
            </div>
            <div>
              <Label>Economia</Label>
              <Input readOnly value={toBRL(savings)}
                className={cn('font-bold border', savings >= 0
                  ? 'bg-[hsl(var(--st-delivered)/0.15)] text-[hsl(var(--st-delivered))]'
                  : 'bg-[hsl(var(--st-cancelled)/0.15)] text-[hsl(var(--st-cancelled))]')} />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={overQuantity} className="bg-secondary hover:bg-secondary/90">
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Date sub-component ---------- */
function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (iso: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value ? new Date(value + 'T12:00:00') : undefined}
            onSelect={d => { onChange(d ? format(d, 'yyyy-MM-dd') : undefined); setOpen(false); }}
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
