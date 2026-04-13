import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Order, OrderItem, ItemStatus, OcAfPed, PaymentMethod, ITEM_STATUS_COLORS, calcTotal } from '@/store/OrderStore';

const emptyOrder = (): Partial<Order> => ({
  os: '', orderDate: format(new Date(), 'yyyy-MM-dd'), customer: '', invoice: '',
  ocAfPed: '', paymentMethod: 'Card', deliveryDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  status: 'To Buy', productCost: 0, serviceCost: 0, cardFinanceCost: 0, boletoCost: 0,
  giftCost: 0, shippingCost: 0, purchaseTaxPercent: 0, purchaseTaxValue: 0,
  salesTaxPercent: 0, salesTaxValue: 0, items: [],
});

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  open: boolean;
  onClose: () => void;
  order?: Order | null;
  onSave: (order: Order) => void;
  onDelete?: (id: string) => void;
}

export function OrderModal({ open, onClose, order, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Order>>(emptyOrder());
  const isEdit = !!order;

  useEffect(() => {
    if (order) setForm({ ...order });
    else setForm(emptyOrder());
  }, [order, open]);

  const set = (k: keyof Order, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleTaxBlur = (field: 'purchaseTax' | 'salesTax') => {
    const pct = field === 'purchaseTax' ? form.purchaseTaxPercent || 0 : form.salesTaxPercent || 0;
    const val = ((form.productCost || 0) * pct) / 100;
    if (field === 'purchaseTax') set('purchaseTaxValue', val);
    else set('salesTaxValue', val);
  };

  const addItem = () => {
    const items = [...(form.items || []), { id: crypto.randomUUID(), name: '', quantity: 1, status: 'To Buy' as ItemStatus }];
    set('items', items);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    set('items', (form.items || []).map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    set('items', (form.items || []).filter(i => i.id !== id));
  };

  const handleSave = () => {
    const o: Order = {
      id: order?.id || crypto.randomUUID(),
      os: form.os || '',
      orderDate: form.orderDate || '',
      customer: form.customer || '',
      invoice: form.invoice || '',
      ocAfPed: (form.ocAfPed || '') as OcAfPed,
      paymentMethod: (form.paymentMethod || 'Card') as PaymentMethod,
      deliveryDate: form.deliveryDate || '',
      status: form.status || 'To Buy',
      productCost: form.productCost || 0,
      serviceCost: form.serviceCost || 0,
      cardFinanceCost: form.cardFinanceCost || 0,
      boletoCost: form.boletoCost || 0,
      giftCost: form.giftCost || 0,
      shippingCost: form.shippingCost || 0,
      purchaseTaxPercent: form.purchaseTaxPercent || 0,
      purchaseTaxValue: form.purchaseTaxValue || 0,
      salesTaxPercent: form.salesTaxPercent || 0,
      salesTaxValue: form.salesTaxValue || 0,
      items: form.items || [],
    };
    onSave(o);
    onClose();
  };

  const total = calcTotal(form);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary">{isEdit ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>OS *</Label>
            <Input value={form.os || ''} onChange={e => set('os', e.target.value)} />
          </div>
          <div>
            <Label>Data do Pedido *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.orderDate ? format(new Date(form.orderDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.orderDate ? new Date(form.orderDate + 'T12:00:00') : undefined} onSelect={d => d && set('orderDate', format(d, 'yyyy-MM-dd'))} locale={ptBR} /></PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Cliente *</Label>
            <Input value={form.customer || ''} onChange={e => set('customer', e.target.value)} />
          </div>
          <div>
            <Label>Nota Fiscal *</Label>
            <Input value={form.invoice || ''} onChange={e => set('invoice', e.target.value)} />
          </div>
          <div>
            <Label>OC/AF/PED *</Label>
            <Select value={form.ocAfPed || ''} onValueChange={v => set('ocAfPed', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Purchase Order">Ordem de Compra</SelectItem>
                <SelectItem value="AF">AF</SelectItem>
                <SelectItem value="Pedido">Pedido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pagamento *</Label>
            <Select value={form.paymentMethod || 'Card'} onValueChange={v => set('paymentMethod', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Card">Cartão</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Data de Entrega *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.deliveryDate ? format(new Date(form.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.deliveryDate ? new Date(form.deliveryDate + 'T12:00:00') : undefined} onSelect={d => d && set('deliveryDate', format(d, 'yyyy-MM-dd'))} locale={ptBR} /></PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Cost fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {([
            ['productCost', 'Custo Produto'],
            ['serviceCost', 'Custo Serviço'],
            ['cardFinanceCost', 'Custo Cartão/Financeiro'],
            ['boletoCost', 'Custo Boleto'],
            ['giftCost', 'Custo Brinde'],
            ['shippingCost', 'Custo Frete'],
          ] as [keyof Order, string][]).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="number" step="0.01" min="0"
                  className="pl-10"
                  value={form[key] as number || ''}
                  onChange={e => set(key, parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Tax fields */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Label>Imposto Compra (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number" step="0.1" placeholder="%"
                value={form.purchaseTaxPercent || ''}
                onChange={e => set('purchaseTaxPercent', parseFloat(e.target.value) || 0)}
                onBlur={() => handleTaxBlur('purchaseTax')}
              />
              <Input readOnly value={formatBRL(form.purchaseTaxValue || 0)} className="bg-muted" />
            </div>
          </div>
          <div>
            <Label>Imposto Venda (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number" step="0.1" placeholder="%"
                value={form.salesTaxPercent || ''}
                onChange={e => set('salesTaxPercent', parseFloat(e.target.value) || 0)}
                onBlur={() => handleTaxBlur('salesTax')}
              />
              <Input readOnly value={formatBRL(form.salesTaxValue || 0)} className="bg-muted" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <Label className="text-base font-semibold">Itens do Pedido</Label>
            <Button size="sm" onClick={addItem} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </div>
          <div className="space-y-2">
            {(form.items || []).map(item => (
              <div key={item.id} className="flex gap-2 items-center border rounded-md p-2 bg-muted/30">
                <Input
                  placeholder="Nome do Item"
                  className="flex-[3] bg-card"
                  value={item.name}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                />
                <Input
                  type="number" min="1" placeholder="Qtd"
                  className="flex-[0.5] bg-card"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                />
                <Select value={item.status} onValueChange={v => updateItem(item.id, 'status', v)}>
                  <SelectTrigger className={cn('flex-[1]', ITEM_STATUS_COLORS[item.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-1 rounded', ITEM_STATUS_COLORS[s])}>{s === 'To Buy' ? 'A Comprar' : s === 'Bought' ? 'Comprado' : 'Em Estoque'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="mt-6 p-4 bg-secondary/10 rounded-lg flex justify-between items-center">
          <span className="text-lg font-bold text-secondary">Valor Total do Pedido</span>
          <span className="text-2xl font-bold text-secondary">{formatBRL(total)}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          {isEdit && onDelete && (
            <Button variant="destructive" onClick={() => { onDelete(order!.id); onClose(); }}>
              Excluir Pedido
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-secondary hover:bg-secondary/90">
            {isEdit ? 'Salvar Alterações' : 'Criar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
