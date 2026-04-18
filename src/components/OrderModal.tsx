import { useState, useEffect, KeyboardEvent, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Plus, Trash2, Printer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Order, OrderItem, ItemStatus, PaymentMethod, Company, Seller, OrderStatus,
  ITEM_STATUS_COLORS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SELLERS,
  calcFinalCost, calcProfit,
} from '@/store/OrderStore';

const emptyOrder = (os: string): Partial<Order> => ({
  os, orderDate: format(new Date(), 'yyyy-MM-dd'), customer: '', cnpj: '', company: '', seller: '',
  ocAfPed: '', directBilling: false, supplier: '', invoice: '',
  paymentMethods: [], installments: 1,
  deliveryDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  status: 'To Buy', isRMA: false, cancelled: false, observations: '',
  initialProductCost: 0, finalProductCost: 0,
  creditCostPercent: 0, creditCostValue: 0, debitCostPercent: 0, debitCostValue: 0,
  purchaseTaxPercent: 0, purchaseTaxValue: 0, salesTaxPercent: 0, salesTaxValue: 0,
  salesValue: 0, items: [],
});

function toBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function parseBRL(s: string): number {
  const cleaned = s.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

interface Props {
  open: boolean;
  onClose: () => void;
  order?: Order | null;
  onSave: (order: Order) => void;
  onDelete?: (id: string) => void;
  /** Callback to compute next OS for new orders */
  nextOS?: () => string;
}

export function OrderModal({ open, onClose, order, onSave, nextOS }: Props) {
  const [form, setForm] = useState<Partial<Order>>(() => emptyOrder(nextOS?.() || ''));
  const isEdit = !!order;

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [orderDateOpen, setOrderDateOpen] = useState(false);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);

  useEffect(() => {
    if (order) setForm({ ...order });
    else setForm(emptyOrder(nextOS?.() || ''));
    setEditingField(null);
  }, [order, open, nextOS]);

  const set = (k: keyof Order, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  /* ---------------- Derived calculations ---------------- */
  // Final product cost = sum of all items' purchase values (driven by ProductModal sub-purchases)
  const derivedFinalProductCost = useMemo(
    () => (form.items || []).reduce((s, i) => s + (i.purchaseValue || 0), 0),
    [form.items]
  );

  // Recompute monetary values whenever percentages or base amounts change
  const computed = useMemo(() => {
    const sales = form.salesValue || 0;
    const finalProd = derivedFinalProductCost;
    return {
      creditCostValue: ((form.creditCostPercent || 0) * sales) / 100,
      debitCostValue: ((form.debitCostPercent || 0) * sales) / 100,
      purchaseTaxValue: ((form.purchaseTaxPercent || 0) * finalProd) / 100,
      salesTaxValue: ((form.salesTaxPercent || 0) * sales) / 100,
    };
  }, [form.salesValue, derivedFinalProductCost, form.creditCostPercent, form.debitCostPercent, form.purchaseTaxPercent, form.salesTaxPercent]);

  // Final cost & profit derived from latest computed values
  const finalCost = calcFinalCost({ ...form, finalProductCost: derivedFinalProductCost, ...computed });
  const profit = calcProfit({ ...form, finalProductCost: derivedFinalProductCost, ...computed });

  /* ---------------- Items ---------------- */
  const addItem = () => {
    const items = [...(form.items || []), {
      id: crypto.randomUUID(), name: '', quantity: 1, status: 'To Buy' as ItemStatus,
      projectedValue: 0, purchaseValue: 0,
    }];
    set('items', items);
  };

  const updateItem = (id: string, field: keyof OrderItem, value: any) => {
    set('items', (form.items || []).map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    set('items', (form.items || []).filter(i => i.id !== id));
  };

  /* ---------------- Payment methods ---------------- */
  const togglePayment = (m: PaymentMethod) => {
    const cur = form.paymentMethods || [];
    set('paymentMethods', cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m]);
  };
  const hasCredit = (form.paymentMethods || []).includes('Credit Card');

  /* ---------------- Cancellation ---------------- */
  const handleCancelToggle = (v: boolean) => {
    setForm(prev => ({
      ...prev,
      cancelled: v,
      status: v ? 'Cancelled' : (prev.status === 'Cancelled' ? 'To Buy' : prev.status),
    }));
  };

  /* ---------------- Save ---------------- */
  const handleSave = () => {
    const o: Order = {
      id: order?.id || crypto.randomUUID(),
      os: form.os || '',
      orderDate: form.orderDate || '',
      customer: form.customer || '',
      cnpj: form.cnpj || '',
      company: (form.company || '') as Company,
      seller: (form.seller || '') as Seller,
      ocAfPed: form.ocAfPed || '',
      directBilling: !!form.directBilling,
      supplier: form.supplier || '',
      invoice: form.invoice || '',
      paymentMethods: form.paymentMethods || [],
      installments: form.installments || 1,
      deliveryDate: form.deliveryDate || '',
      status: form.cancelled ? 'Cancelled' : (form.status || 'To Buy'),
      isRMA: !!form.isRMA,
      cancelled: !!form.cancelled,
      observations: form.observations || '',
      initialProductCost: form.initialProductCost || 0,
      finalProductCost: derivedFinalProductCost,
      creditCostPercent: form.creditCostPercent || 0,
      creditCostValue: computed.creditCostValue,
      debitCostPercent: form.debitCostPercent || 0,
      debitCostValue: computed.debitCostValue,
      purchaseTaxPercent: form.purchaseTaxPercent || 0,
      purchaseTaxValue: computed.purchaseTaxValue,
      salesTaxPercent: form.salesTaxPercent || 0,
      salesTaxValue: computed.salesTaxValue,
      salesValue: form.salesValue || 0,
      items: form.items || [],
    };
    onSave(o);
    onClose();
  };

  /* ---------------- Currency input renderer ---------------- */
  const renderCurrencyInput = (
    key: keyof Order,
    label: string,
    opts: { readOnly?: boolean; muted?: boolean } = {},
  ) => {
    const isEditing = editingField === key;
    const numVal = (form[key] as number) || 0;
    return (
      <div key={key}>
        <Label>{label}</Label>
        <Input
          readOnly={opts.readOnly}
          className={cn('bg-white border-border', opts.muted && 'bg-muted')}
          value={isEditing ? editingValue : toBRL(numVal)}
          onFocus={() => { if (opts.readOnly) return; setEditingField(key); setEditingValue(numVal ? String(numVal) : ''); }}
          onBlur={() => { if (opts.readOnly) return; set(key, parseBRL(editingValue) || parseFloat(editingValue) || 0); setEditingField(null); }}
          onChange={e => setEditingValue(e.target.value)}
          onKeyDown={handleEnterBlur}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card print:max-w-full print:max-h-none print:shadow-none">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl">{isEdit ? `Editar Pedido #${form.os}` : `Novo Pedido #${form.os}`}</DialogTitle>
        </DialogHeader>

        {/* ============== 1. INFORMAÇÕES GERAIS ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>OS (auto)</Label>
              <Input readOnly className="bg-muted border-border font-semibold" value={form.os || ''} />
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
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={form.orderDate ? new Date(form.orderDate + 'T12:00:00') : undefined}
                    onSelect={d => { if (d) set('orderDate', format(d, 'yyyy-MM-dd')); setOrderDateOpen(false); }}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
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
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={form.deliveryDate ? new Date(form.deliveryDate + 'T12:00:00') : undefined}
                    onSelect={d => { if (d) set('deliveryDate', format(d, 'yyyy-MM-dd')); setDeliveryDateOpen(false); }}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
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

            <div>
              <Label>Cliente *</Label>
              <Input className="bg-white border-border" value={form.customer || ''} onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input className="bg-white border-border" value={form.cnpj || ''} onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>OC/AF/PED</Label>
              <Input className="bg-white border-border" value={form.ocAfPed || ''} onChange={e => set('ocAfPed', e.target.value)} onKeyDown={handleEnterBlur} placeholder="Ex: OC-1234" />
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
              <Label>Vendedor *</Label>
              <Select value={form.seller || ''} onValueChange={v => set('seller', v)}>
                <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {SELLERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Direct billing toggle */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <Switch checked={!!form.directBilling} onCheckedChange={v => set('directBilling', v)} />
                <span className="text-sm font-medium">Faturamento Direto?</span>
              </label>
            </div>
            {form.directBilling && (
              <>
                <div>
                  <Label>Fornecedor</Label>
                  <Input className="bg-white border-border" value={form.supplier || ''} onChange={e => set('supplier', e.target.value)} onKeyDown={handleEnterBlur} />
                </div>
                <div>
                  <Label>Nota Fiscal (NF)</Label>
                  <Input className="bg-white border-border" value={form.invoice || ''} onChange={e => set('invoice', e.target.value)} onKeyDown={handleEnterBlur} />
                </div>
              </>
            )}

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <Checkbox checked={!!form.isRMA} onCheckedChange={v => set('isRMA', !!v)} />
                <span className="text-sm font-medium">RMA (Garantia)</span>
              </label>
            </div>
          </div>

          {/* Payment methods */}
          <div className="mt-4">
            <Label className="mb-2 block">Forma de Pagamento *</Label>
            <div className="flex flex-wrap gap-3">
              {PAYMENT_METHODS.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-white cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={(form.paymentMethods || []).includes(m)}
                    onCheckedChange={() => togglePayment(m)}
                  />
                  <span className="text-sm">{PAYMENT_METHOD_LABELS[m]}</span>
                </label>
              ))}
              {hasCredit && (
                <div className="flex items-center gap-2 px-3 py-1 border rounded-md bg-secondary/5">
                  <Label className="text-sm whitespace-nowrap">Parcelas:</Label>
                  <Input
                    type="number" min={1} max={24}
                    className="w-20 bg-white border-border"
                    value={form.installments || 1}
                    onChange={e => set('installments', parseInt(e.target.value) || 1)}
                    onKeyDown={handleEnterBlur}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============== 2. FINANCEIRO ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Financeiro</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {renderCurrencyInput('initialProductCost', 'Custo Inicial Produto')}
            {renderCurrencyInput('finalProductCost', 'Custo Final Produto', { readOnly: true, muted: true })}
          </div>

          {/* Percentage → R$ rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Custo Crédito (%) — sobre Valor de Venda</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" placeholder="%" className="bg-white border-border"
                  value={form.creditCostPercent || ''}
                  onChange={e => set('creditCostPercent', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterBlur} />
                <Input readOnly value={toBRL(computed.creditCostValue)} className="bg-muted border-border" />
              </div>
            </div>
            <div>
              <Label>Custo Débito (%) — sobre Valor de Venda</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" placeholder="%" className="bg-white border-border"
                  value={form.debitCostPercent || ''}
                  onChange={e => set('debitCostPercent', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterBlur} />
                <Input readOnly value={toBRL(computed.debitCostValue)} className="bg-muted border-border" />
              </div>
            </div>
            <div>
              <Label>Imposto Compra (%) — sobre Custo Final Produto</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" placeholder="%" className="bg-white border-border"
                  value={form.purchaseTaxPercent || ''}
                  onChange={e => set('purchaseTaxPercent', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterBlur} />
                <Input readOnly value={toBRL(computed.purchaseTaxValue)} className="bg-muted border-border" />
              </div>
            </div>
            <div>
              <Label>Imposto Venda (%) — sobre Valor de Venda</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" placeholder="%" className="bg-white border-border"
                  value={form.salesTaxPercent || ''}
                  onChange={e => set('salesTaxPercent', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterBlur} />
                <Input readOnly value={toBRL(computed.salesTaxValue)} className="bg-muted border-border" />
              </div>
            </div>
          </div>
        </section>

        {/* ============== 3. ITENS ============== */}
        <section className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Itens do Pedido</h3>
            <Button size="sm" onClick={addItem} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </div>
          <div className="space-y-2">
            {(form.items || []).map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 bg-muted/20">
                <Input placeholder="Nome do Item" className="col-span-4 bg-white border-border"
                  value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                <Input type="number" min="1" placeholder="Qtd" className="col-span-1 bg-white border-border"
                  value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                <Select value={item.status} onValueChange={v => updateItem(item.id, 'status', v)}>
                  <SelectTrigger className={cn('col-span-2 border', ITEM_STATUS_COLORS[item.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-1 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>
                          {s === 'To Buy' ? 'A Comprar' : s === 'Bought' ? 'Comprado' : 'Em Estoque'}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="col-span-2">
                  <Input type="number" step="0.01" placeholder="Valor Projetado R$" className="bg-white border-border"
                    value={item.projectedValue || ''} onChange={e => updateItem(item.id, 'projectedValue', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
                </div>
                <div className="col-span-2">
                  {item.subPurchases && item.subPurchases.length > 0 ? (
                    <Input readOnly placeholder="Valor de Compra R$" className="bg-muted border-border"
                      title="Sincronizado a partir do Modal de Produto"
                      value={(item.purchaseValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  ) : (
                    <Input type="number" step="0.01" placeholder="Valor de Compra R$" className="bg-white border-border"
                      value={item.purchaseValue || ''} onChange={e => updateItem(item.id, 'purchaseValue', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
                  )}
                </div>
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(item.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(form.items || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado</p>
            )}
            {(form.items || []).length > 0 && (
              <div className="grid grid-cols-12 gap-2 px-2 text-xs text-muted-foreground font-medium pt-1">
                <div className="col-span-4">Nome</div>
                <div className="col-span-1">Qtd</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Valor Projetado</div>
                <div className="col-span-2">Valor de Compra</div>
              </div>
            )}
          </div>
        </section>

        {/* ============== 4. CANCELAMENTO ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Cancelamento</h3>
          <div className="flex items-center gap-3 mb-3">
            <Switch checked={!!form.cancelled} onCheckedChange={handleCancelToggle} />
            <span className="text-sm font-medium">Pedido Cancelado?</span>
            {form.cancelled && (
              <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', ORDER_STATUS_COLORS['Cancelled'])}>Cancelado</span>
            )}
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              className="bg-white border-border min-h-24"
              value={form.observations || ''}
              onChange={e => set('observations', e.target.value)}
              placeholder="Anotações sobre o pedido..."
            />
          </div>
        </section>

        {/* ============== 5. RESUMO DE VALORES ============== */}
        <section className="border rounded-lg p-4 bg-secondary/5">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Resumo de Valores</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderCurrencyInput('salesValue', 'Valor de Venda')}
            <div>
              <Label>Custo Final</Label>
              <Input readOnly value={toBRL(finalCost)} className="bg-muted border-border font-semibold" />
            </div>
            <div>
              <Label>Lucro</Label>
              <Input readOnly value={toBRL(profit)}
                className={cn('font-bold border', profit >= 0 ? 'bg-[hsl(var(--st-delivered)/0.15)] text-[hsl(var(--st-delivered))]' : 'bg-[hsl(var(--st-cancelled)/0.15)] text-[hsl(var(--st-cancelled))]')} />
            </div>
          </div>
        </section>

        {/* ============== FOOTER ============== */}
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-secondary hover:bg-secondary/90">
            {isEdit ? 'Salvar Alterações' : 'Criar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
