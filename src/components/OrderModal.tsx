import { useState, useEffect, KeyboardEvent, useCallback } from 'react';
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
import { Order, OrderItem, ItemStatus, OcAfPed, PaymentMethod, Company, OrderStatus, ITEM_STATUS_COLORS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, calcTotal } from '@/store/OrderStore';
import { Checkbox } from '@/components/ui/checkbox';

const emptyOrder = (): Partial<Order> => ({
  os: '', orderDate: format(new Date(), 'yyyy-MM-dd'), customer: '', cnpj: '', company: '', seller: '', invoice: '',
  ocAfPed: '', paymentMethod: 'Card', deliveryDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  status: 'To Buy', isRMA: false, productCost: 0, serviceCost: 0, cardFinanceCost: 0, boletoCost: 0,
  giftCost: 0, shippingCost: 0, purchaseTaxPercent: 0, purchaseTaxValue: 0,
  salesTaxPercent: 0, salesTaxValue: 0, items: [],
});

/** Format number to BRL string R$ X.XXX,XX */
function toBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Parse a BRL-formatted string back to number */
function parseBRL(s: string): number {
  const cleaned = s.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/** Enter key blurs the active input */
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
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

  // Currency field editing state – stores raw typed text while field is focused
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [orderDateOpen, setOrderDateOpen] = useState(false);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);

  useEffect(() => {
    if (order) setForm({ ...order });
    else setForm(emptyOrder());
    setEditingField(null);
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
      cnpj: form.cnpj || '',
      company: (form.company || '') as Company,
      seller: form.seller || '',
      invoice: form.invoice || '',
      ocAfPed: (form.ocAfPed || '') as OcAfPed,
      paymentMethod: (form.paymentMethod || 'Card') as PaymentMethod,
      deliveryDate: form.deliveryDate || '',
      status: form.status || 'To Buy',
      isRMA: !!form.isRMA,
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

  // Currency input helpers
  const currencyFields: [keyof Order, string][] = [
    ['productCost', 'Custo Produto'],
    ['serviceCost', 'Custo Serviço'],
    ['cardFinanceCost', 'Custo Cartão/Financeiro'],
    ['boletoCost', 'Custo Boleto'],
    ['giftCost', 'Custo Brinde'],
    ['shippingCost', 'Custo Frete'],
  ];

  const renderCurrencyInput = (key: keyof Order, label: string) => {
    const isEditing = editingField === key;
    const numVal = (form[key] as number) || 0;
    return (
      <div key={key}>
        <Label>{label}</Label>
        <Input
          className="bg-white border-border"
          value={isEditing ? editingValue : toBRL(numVal)}
          onFocus={() => { setEditingField(key); setEditingValue(numVal ? String(numVal) : ''); }}
          onBlur={() => { set(key, parseBRL(editingValue) || parseFloat(editingValue) || 0); setEditingField(null); }}
          onChange={e => setEditingValue(e.target.value)}
          onKeyDown={handleEnterBlur}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl">{isEdit ? 'Editar Pedido' : 'Novo Pedido'}</DialogTitle>
        </DialogHeader>

        {/* Block 1: Informações Gerais */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>OS *</Label>
              <Input className="bg-white border-border" value={form.os || ''} onChange={e => set('os', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Data do Pedido *</Label>
              <Popover open={orderDateOpen} onOpenChange={setOrderDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.orderDate ? format(new Date(form.orderDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.orderDate ? new Date(form.orderDate + 'T12:00:00') : undefined} onSelect={d => { if (d) { set('orderDate', format(d, 'yyyy-MM-dd')); } setOrderDateOpen(false); }} locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Cliente *</Label>
              <Input className="bg-white border-border" value={form.customer || ''} onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input className="bg-white border-border" value={form.cnpj || ''} onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Vendedor</Label>
              <Input className="bg-white border-border" value={form.seller || ''} onChange={e => set('seller', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Nota Fiscal *</Label>
              <Input className="bg-white border-border" value={form.invoice || ''} onChange={e => set('invoice', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>OC/AF/PED *</Label>
              <Select value={form.ocAfPed || ''} onValueChange={v => set('ocAfPed', v)}>
                <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Purchase Order">Ordem de Compra</SelectItem>
                  <SelectItem value="AF">AF</SelectItem>
                  <SelectItem value="Pedido">Pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa *</Label>
              <Select value={form.company || ''} onValueChange={v => set('company', v)}>
                <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lucky Store">Lucky Store</SelectItem>
                  <SelectItem value="BTech">BTech</SelectItem>
                  <SelectItem value="AJJ">AJJ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pagamento *</Label>
              <Select value={form.paymentMethod || 'Card'} onValueChange={v => set('paymentMethod', v)}>
                <SelectTrigger className="bg-white border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Card">Cartão</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Entrega *</Label>
              <Popover open={deliveryDateOpen} onOpenChange={setDeliveryDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.deliveryDate ? format(new Date(form.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.deliveryDate ? new Date(form.deliveryDate + 'T12:00:00') : undefined} onSelect={d => { if (d) { set('deliveryDate', format(d, 'yyyy-MM-dd')); } setDeliveryDateOpen(false); }} locale={ptBR} className="p-3 pointer-events-auto" /></PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Status *</Label>
              <Select value={form.status || 'To Buy'} onValueChange={v => set('status', v as OrderStatus)}>
                <SelectTrigger className={cn('border', form.status && ORDER_STATUS_COLORS[form.status as OrderStatus])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(s => (
                    <SelectItem key={s} value={s}>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{ORDER_STATUS_LABELS[s]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <Checkbox checked={!!form.isRMA} onCheckedChange={v => set('isRMA', !!v)} />
                <span className="text-sm font-medium">RMA (Devolução / Garantia)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Block 2: Financeiro */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Financeiro</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currencyFields.map(([key, label]) => renderCurrencyInput(key, label))}
          </div>

          {/* Tax fields */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Imposto Compra (%)</Label>
              <div className="flex gap-2">
                <Input
                  className="bg-white border-border"
                  type="number" step="0.1" placeholder="%"
                  value={form.purchaseTaxPercent || ''}
                  onChange={e => set('purchaseTaxPercent', parseFloat(e.target.value) || 0)}
                  onBlur={() => handleTaxBlur('purchaseTax')}
                  onKeyDown={handleEnterBlur}
                />
                <Input readOnly value={toBRL(form.purchaseTaxValue || 0)} className="bg-muted border-border" />
              </div>
            </div>
            <div>
              <Label>Imposto Venda (%)</Label>
              <div className="flex gap-2">
                <Input
                  className="bg-white border-border"
                  type="number" step="0.1" placeholder="%"
                  value={form.salesTaxPercent || ''}
                  onChange={e => set('salesTaxPercent', parseFloat(e.target.value) || 0)}
                  onBlur={() => handleTaxBlur('salesTax')}
                  onKeyDown={handleEnterBlur}
                />
                <Input readOnly value={toBRL(form.salesTaxValue || 0)} className="bg-muted border-border" />
              </div>
            </div>
          </div>
        </div>

        {/* Block 3: Itens do Pedido */}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Itens do Pedido</h3>
            <Button size="sm" onClick={addItem} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </div>
          <div className="space-y-2">
            {(form.items || []).map(item => (
              <div key={item.id} className="flex gap-2 items-center border rounded-md p-2 bg-muted/20">
                <Input
                  placeholder="Nome do Item"
                  className="flex-[3] bg-white border-border"
                  value={item.name}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  onKeyDown={handleEnterBlur}
                />
                <Input
                  type="number" min="1" placeholder="Qtd"
                  className="flex-[0.5] bg-white border-border"
                  value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  onKeyDown={handleEnterBlur}
                />
                <Select value={item.status} onValueChange={v => updateItem(item.id, 'status', v)}>
                  <SelectTrigger className={cn('flex-[1] border', ITEM_STATUS_COLORS[item.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-1 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>{s === 'To Buy' ? 'A Comprar' : s === 'Bought' ? 'Comprado' : 'Em Estoque'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(form.items || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado</p>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="p-4 bg-secondary/10 rounded-lg flex justify-between items-center">
          <span className="text-lg font-bold text-secondary">Valor Total do Pedido</span>
          <span className="text-2xl font-bold text-secondary">{toBRL(total)}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
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
