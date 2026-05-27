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
import { toast } from 'sonner';
import {
  Order, OrderItem, ItemStatus, PaymentMethod, Company, Seller, OrderStatus, FreightCard,
  PaymentInstallment,
  ITEM_STATUS_COLORS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS,
  PAYMENT_METHODS, PAYMENT_METHOD_LABELS, SELLERS,
  calcFinalCost, calcProfit, calcFreightTotal,
} from '@/store/OrderStore';
import type { OrderPrefill } from '@/components/AddOrderChooser';
import { useCreateOrder, useUpdateOrder, useUpdateOrderStatus, orderKeys } from '@/api/hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, getApiError } from '@/api/client';
import type { CreatePedidoPayload, UpdatePedidoPayload, PedidoStatus } from '@/types/api';
import { LOJA_IDS, VENDEDOR_IDS, FORMA_PAGAMENTO_MAP } from '@/api/storeConfig';

const emptyOrder = (os: string): Partial<Order> => ({
  os, createdAt: Date.now(),
  orderDate: format(new Date(), 'yyyy-MM-dd'), customer: '', cnpj: '', company: '', seller: '',
  ocAfPed: '', directBilling: false, supplier: '', invoice: '',
  paymentMethods: [], installments: 1,
  deliveryDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  status: 'To Buy', isRMA: false, cancelled: false, observations: '',
  initialProductCost: 0, finalProductCost: 0, boletoCost: 0, giftCost: 0,
  creditCostPercent: 0, creditCostValue: 0, debitCostPercent: 0, debitCostValue: 0,
  purchaseTaxPercent: 0, purchaseTaxValue: 0, salesTaxPercent: 0, salesTaxValue: 0,
  salesValue: 0, items: [], freight: [],
  paymentDate: '', penaltyValue: 0, interestValue: 0, paymentMethod: '',
  paymentInstallments: 1, paymentInstallmentPlan: [],
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
  nextOS?: () => string;
  /** Optional pre-fill data when creating from a quote */
  prefill?: OrderPrefill | null;
}

export function OrderModal({ open, onClose, order, onSave, nextOS, prefill }: Props) {
  const [form, setForm] = useState<Partial<Order>>(() => emptyOrder(nextOS?.() || ''));
  const isEdit = !!order;

  const qc = useQueryClient();
  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutate: updateOrder, isPending: isUpdating } = useUpdateOrder(order?.id ?? '');
  const { mutate: updateOrderStatus, isPending: isUpdatingStatus } = useUpdateOrderStatus(order?.id ?? '');
  const isPending = isCreating || isUpdating || isUpdatingStatus;

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [orderDateOpen, setOrderDateOpen] = useState(false);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);

  useEffect(() => {
    if (order) {
      setForm({ ...order, freight: order.freight || [] });
    } else if (prefill) {
      setForm({
        ...emptyOrder(nextOS?.() || ''),
        customer: prefill.customer,
        cnpj: prefill.cnpj,
        company: prefill.company,
        seller: prefill.seller,
        salesValue: prefill.salesValue,
        items: prefill.items.map(i => ({
          id: i.id, name: i.name, quantity: i.quantity, status: 'To Buy' as ItemStatus,
          projectedValue: i.projectedValue, purchaseValue: 0,
        })),
      });
    } else {
      setForm(emptyOrder(nextOS?.() || ''));
    }
    setEditingField(null);
  }, [order, open, nextOS, prefill]);

  const set = (k: keyof Order, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  /* ---------------- Derived calculations ---------------- */
  const derivedFinalProductCost = useMemo(
    () => (form.items || []).reduce((s, i) => s + (i.purchaseValue || 0), 0),
    [form.items]
  );
  const derivedFreightTotal = useMemo(() => calcFreightTotal(form.freight), [form.freight]);

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

  const finalCost = calcFinalCost({
    ...form, finalProductCost: derivedFinalProductCost, freight: form.freight, ...computed,
  });
  const profit = calcProfit({
    ...form, finalProductCost: derivedFinalProductCost, freight: form.freight, ...computed,
  });

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

  /* ---------------- Freight ---------------- */
  const addFreight = () => set('freight', [...(form.freight || []), {
    id: crypto.randomUUID(), deliveryPerson: '', value: 0, deliveryDate: undefined,
  } as FreightCard]);
  const updateFreight = (id: string, field: keyof FreightCard, value: any) => {
    set('freight', (form.freight || []).map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  const removeFreight = (id: string) => set('freight', (form.freight || []).filter(f => f.id !== id));

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

  /* ---------------- Save (with validation) ---------------- */
  const handleSave = () => {
    // Mandatory fields: orderDate, deliveryDate, customer, ocAfPed
    const missing: string[] = [];
    if (!form.orderDate) missing.push('Data do Pedido');
    if (!form.deliveryDate) missing.push('Data de Entrega');
    if (!(form.customer || '').trim()) missing.push('Cliente');
    if (!(form.ocAfPed || '').trim()) missing.push('OC/AF/PED');
    if (missing.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${missing.join(', ')}`);
      return;
    }

    const o: Order = {
      id: order?.id || crypto.randomUUID(),
      os: form.os || '',
      createdAt: form.createdAt || Date.now(),
      orderDate: form.orderDate || '',
      customer: form.customer || '',
      cnpj: form.cnpj || '',
      company: (form.company || '') as Company,
      seller: (form.seller || '') as Seller,
      ocAfPed: form.ocAfPed || '',
      directBilling: !!form.directBilling,
      supplier: form.supplier || '',
      invoice: form.invoice || '',
      invoiceSupplier: form.invoiceSupplier || '',
      paymentMethods: form.paymentMethods || [],
      installments: form.installments || 1,
      deliveryDate: form.deliveryDate || '',
      status: form.cancelled ? 'Cancelled' : (form.status || 'To Buy'),
      isRMA: !!form.isRMA,
      cancelled: !!form.cancelled,
      observations: form.observations || '',
      initialProductCost: form.initialProductCost || 0,
      finalProductCost: derivedFinalProductCost,
      boletoCost: form.boletoCost || 0,
      giftCost: form.giftCost || 0,
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
      freight: form.freight || [],
      paymentDate: form.paymentDate || '',
      penaltyValue: form.penaltyValue || 0,
      interestValue: form.interestValue || 0,
      paymentMethod: (form.paymentMethod || '') as PaymentMethod | '',
      paymentInstallments: form.paymentInstallments || 1,
      paymentInstallmentPlan: form.paymentInstallmentPlan || [],
    };

    const onApiError = (err: unknown) => toast.error(getApiError(err));

    if (isEdit) {
      const payload: UpdatePedidoPayload = {
        data_pedido: o.orderDate,
        data_entrega: o.deliveryDate,
        valor_venda: String(o.salesValue),
        observacao: o.observations || undefined,
        numero_nf: o.invoice || undefined,
        nota_fiscal_fornecedor: o.invoiceSupplier || undefined,
        numero_oc: o.ocAfPed || undefined,
        is_direct_billing: o.directBilling,
        fornecedor_principal: o.supplier || undefined,
      };
      const statusChanged = order && o.status !== order.status;
      const sellerId = VENDEDOR_IDS[(o.seller as string) ?? ''] ?? '';

      // ── Item diff ───────────────────────────────────────────────────────────
      const origItems = order?.items ?? [];
      const toAdd = o.items.filter(i => !origItems.some(orig => orig.id === i.id));
      const toDelete = origItems.filter(orig => !o.items.some(i => i.id === orig.id));
      const toUpdateStatus = o.items.filter(i => {
        const orig = origItems.find(orig => orig.id === i.id);
        return orig && orig.status !== i.status;
      });

      // ── Frete diff ──────────────────────────────────────────────────────────
      const origFretes = order?.freight ?? [];
      const fretesToAdd = o.freight.filter(f => !origFretes.some(orig => orig.id === f.id));
      const fretesToDelete = origFretes.filter(orig => !o.freight.some(f => f.id === orig.id));
      const fretesToUpdate = o.freight.filter(f => {
        const orig = origFretes.find(orig => orig.id === f.id);
        return orig && (orig.value !== f.value || orig.deliveryPerson !== f.deliveryPerson || orig.deliveryDate !== f.deliveryDate);
      });

      const freteBody = (f: FreightCard) => ({
        entregador: f.deliveryPerson || null,
        valor: f.value || 0,
        data_frete: f.deliveryDate || o.deliveryDate,
      });

      const syncItems = async (pedidoId: string) => {
        await Promise.all([
          ...toAdd.map(item => apiClient.post(`/pedidos/${pedidoId}/items`, {
            id_vendedor: sellerId,
            descricao: item.name || 'Item',
            quantidade: item.quantity || 1,
            valor_projetado: Math.max(0.01, item.projectedValue),
            valor_compra: item.purchaseValue > 0 ? item.purchaseValue : undefined,
            status: item.status,
          })),
          ...toDelete.map(item => apiClient.delete(`/pedidos/${pedidoId}/items/${item.id}`)),
          ...toUpdateStatus.map(item =>
            apiClient.patch(`/pedidos/${pedidoId}/items/${item.id}/status`, { new_status: item.status })
          ),
          ...fretesToAdd.map(f => apiClient.post(`/pedidos/${pedidoId}/fretes`, freteBody(f))),
          ...fretesToDelete.map(f => apiClient.delete(`/pedidos/${pedidoId}/fretes/${f.id}`)),
          ...fretesToUpdate.map(f => apiClient.put(`/pedidos/${pedidoId}/fretes/${f.id}`, freteBody(f))),
        ]);
      };
      const finish = async () => {
        const hasChanges = toAdd.length || toDelete.length || toUpdateStatus.length
          || fretesToAdd.length || fretesToDelete.length || fretesToUpdate.length;
        if (hasChanges) {
          try { await syncItems(o.id); } catch (err) { toast.error(getApiError(err)); }
        }
        qc.invalidateQueries({ queryKey: orderKeys.lists() });
        toast.success('Pedido atualizado com sucesso');
        onSave(o);
        onClose();
      };
      updateOrder(payload, {
        onSuccess: () => {
          if (statusChanged) {
            updateOrderStatus({ new_status: o.status as PedidoStatus }, { onSuccess: () => { finish(); }, onError: onApiError });
          } else {
            finish();
          }
        },
        onError: onApiError,
      });
    } else {
      const payload: CreatePedidoPayload = {
        id_loja: LOJA_IDS[o.company] ?? '',
        id_vendedor: VENDEDOR_IDS[o.seller] ?? '',
        nome_cliente: o.customer,
        cpf_cnpj: o.cnpj || undefined,
        data_pedido: o.orderDate,
        data_entrega: o.deliveryDate,
        status: o.status as PedidoStatus,
        valor_venda: String(o.salesValue),
        observacao: o.observations || undefined,
        numero_nf: o.invoice || undefined,
        nota_fiscal_fornecedor: o.invoiceSupplier || undefined,
        numero_oc: o.ocAfPed || undefined,
        is_direct_billing: o.directBilling,
        fornecedor_principal: o.supplier || undefined,
        formas_pagamento: o.paymentMethods.map(m => ({ forma: FORMA_PAGAMENTO_MAP[m] ?? m })),
      };
      createOrder(payload, {
        onSuccess: async (data) => {
          const newId = data.id;
          const vendedorId = String(data.id_vendedor);
          let savedItems = o.items;
          if (o.items.length > 0) {
            try {
              const results = await Promise.all(
                o.items.map(item =>
                  apiClient.post(`/pedidos/${newId}/items`, {
                    id_vendedor: vendedorId,
                    descricao: item.name || 'Item',
                    quantidade: item.quantity || 1,
                    valor_projetado: Math.max(0.01, item.projectedValue),
                    valor_compra: item.purchaseValue > 0 ? item.purchaseValue : undefined,
                    status: item.status,
                  }).then(r => r.data)
                )
              );
              savedItems = results.map((r, i) => ({ ...o.items[i], id: r.id }));
            } catch (err) {
              toast.error(getApiError(err));
            }
          }
          if (o.freight.length > 0) {
            try {
              await Promise.all(
                o.freight.map(f => apiClient.post(`/pedidos/${newId}/fretes`, {
                  entregador: f.deliveryPerson || null,
                  valor: f.value || 0,
                  data_frete: f.deliveryDate || o.deliveryDate,
                }))
              );
            } catch (err) {
              toast.error(getApiError(err));
            }
          }
          qc.invalidateQueries({ queryKey: orderKeys.lists() });
          toast.success('Pedido criado com sucesso');
          onSave({ ...o, id: newId, items: savedItems });
          onClose();
        },
        onError: onApiError,
      });
    }
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
              <Label>Data do Pedido <span className="text-destructive">*</span></Label>
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
              <Label>Data de Entrega <span className="text-destructive">*</span></Label>
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
              <Label>Status</Label>
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
              <Label>Cliente <span className="text-destructive">*</span></Label>
              <Input className="bg-white border-border" value={form.customer || ''} onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input className="bg-white border-border" value={form.cnpj || ''} onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>OC/AF/PED <span className="text-destructive">*</span></Label>
              <Input className="bg-white border-border" value={form.ocAfPed || ''} onChange={e => set('ocAfPed', e.target.value)} onKeyDown={handleEnterBlur} placeholder="Ex: OC-1234" />
            </div>
            <div>
              <Label>Empresa</Label>
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
              <Label>Vendedor</Label>
              <Select value={form.seller || ''} onValueChange={v => set('seller', v)}>
                <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {SELLERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Sales Value (moved from summary) */}
            {renderCurrencyInput('salesValue', 'Valor de Venda')}

            <div>
              <Label>Nota Fiscal</Label>
              <Input className="bg-white border-border" value={form.invoice || ''} onChange={e => set('invoice', e.target.value)} onKeyDown={handleEnterBlur} placeholder="Número da NF" />
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
                  <Label>NF Fornecedor</Label>
                  <Input className="bg-white border-border" value={form.invoiceSupplier || ''} onChange={e => set('invoiceSupplier', e.target.value)} onKeyDown={handleEnterBlur} placeholder="Número da NF do fornecedor" />
                </div>
              </>
            )}
          </div>

          {/* Payment methods */}
          <div className="mt-4">
            <Label className="mb-2 block">Forma de Pagamento</Label>
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
            <div>
              <Label>Custo Final Produto <span className="text-xs text-muted-foreground">(soma das compras)</span></Label>
              <Input readOnly value={toBRL(derivedFinalProductCost)} className="bg-muted border-border font-semibold" />
            </div>
            {renderCurrencyInput('boletoCost', 'Custo Boleto')}
            <div>
              <Label>Frete <span className="text-xs text-muted-foreground">(soma da seção Frete)</span></Label>
              <Input readOnly value={toBRL(derivedFreightTotal)} className="bg-muted border-border font-semibold" />
            </div>
            {renderCurrencyInput('giftCost', 'Brinde')}
          </div>

          {/* Bidirectional %↔R$ rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <BiPctRow
              label="Custo Crédito — sobre Valor de Venda"
              base={form.salesValue || 0}
              percent={form.creditCostPercent || 0}
              value={computed.creditCostValue}
              onPercentChange={p => set('creditCostPercent', p)}
              onValueChange={v => {
                const base = form.salesValue || 0;
                set('creditCostPercent', base > 0 ? (v / base) * 100 : 0);
              }}
            />
            <BiPctRow
              label="Custo Débito — sobre Valor de Venda"
              base={form.salesValue || 0}
              percent={form.debitCostPercent || 0}
              value={computed.debitCostValue}
              onPercentChange={p => set('debitCostPercent', p)}
              onValueChange={v => {
                const base = form.salesValue || 0;
                set('debitCostPercent', base > 0 ? (v / base) * 100 : 0);
              }}
            />
            <BiPctRow
              label="Imposto Compra — sobre Custo Final Produto"
              base={derivedFinalProductCost}
              percent={form.purchaseTaxPercent || 0}
              value={computed.purchaseTaxValue}
              onPercentChange={p => set('purchaseTaxPercent', p)}
              onValueChange={v => {
                const base = derivedFinalProductCost;
                set('purchaseTaxPercent', base > 0 ? (v / base) * 100 : 0);
              }}
            />
            <BiPctRow
              label="Imposto Venda — sobre Valor de Venda"
              base={form.salesValue || 0}
              percent={form.salesTaxPercent || 0}
              value={computed.salesTaxValue}
              onPercentChange={p => set('salesTaxPercent', p)}
              onValueChange={v => {
                const base = form.salesValue || 0;
                set('salesTaxPercent', base > 0 ? (v / base) * 100 : 0);
              }}
            />
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
          </div>
        </section>

        {/* ============== 3b. FRETE ============== */}
        <section className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Frete</h3>
            <Button size="sm" onClick={addFreight} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Frete
            </Button>
          </div>
          <div className="space-y-2">
            {(form.freight || []).map((f, idx) => (
              <FreightRow key={f.id} idx={idx} card={f}
                onChange={(k, v) => updateFreight(f.id, k, v)}
                onRemove={() => removeFreight(f.id)} />
            ))}
            {(form.freight || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Nenhum frete adicionado</p>
            )}
          </div>
          <div className="mt-3 text-right text-sm font-semibold text-secondary">
            Total: {toBRL(derivedFreightTotal)}
          </div>
        </section>

        {/* ============== 3c. PAGAMENTO ============== */}
        <PagamentoSection form={form} set={set} />

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
            <div>
              <Label>Valor de Venda</Label>
              <Input readOnly value={toBRL(form.salesValue || 0)} className="bg-muted border-border font-semibold" />
            </div>
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
          <Button onClick={handleSave} disabled={isPending} className="bg-secondary hover:bg-secondary/90">
            {isPending ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Criar Pedido')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bidirectional %↔R$ row ---------- */
function BiPctRow({ label, base, percent, value, onPercentChange, onValueChange }: {
  label: string;
  base: number;
  percent: number;
  value: number;
  onPercentChange: (p: number) => void;
  onValueChange: (v: number) => void;
}) {
  const [pctEditing, setPctEditing] = useState(false);
  const [pctDraft, setPctDraft] = useState('');
  const [valEditing, setValEditing] = useState(false);
  const [valDraft, setValDraft] = useState('');
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder="%"
          className="bg-white border-border"
          value={pctEditing ? pctDraft : (percent ? `${percent.toFixed(2).replace('.', ',')}%` : '')}
          onFocus={() => { setPctEditing(true); setPctDraft(percent ? String(percent) : ''); }}
          onBlur={() => { onPercentChange(parseFloat(pctDraft.replace(',', '.')) || 0); setPctEditing(false); }}
          onChange={e => setPctDraft(e.target.value)}
          onKeyDown={handleEnterBlur}
        />
        <Input
          placeholder="R$"
          className="bg-white border-border"
          value={valEditing ? valDraft : toBRL(value)}
          onFocus={() => { setValEditing(true); setValDraft(value ? String(value) : ''); }}
          onBlur={() => { onValueChange(parseBRL(valDraft) || parseFloat(valDraft) || 0); setValEditing(false); }}
          onChange={e => setValDraft(e.target.value)}
          onKeyDown={handleEnterBlur}
        />
      </div>
      {base > 0 ? null : <p className="text-xs text-muted-foreground mt-1">Defina o valor base para editar em R$.</p>}
    </div>
  );
}

/* ---------- Freight row component ---------- */
function FreightRow({ idx, card, onChange, onRemove }: {
  idx: number; card: FreightCard;
  onChange: (k: keyof FreightCard, v: any) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <div className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 bg-muted/20">
      <span className="col-span-1 text-xs font-bold text-secondary">#{idx + 1}</span>
      <Input placeholder="Entregador" className="col-span-4 bg-white border-border"
        value={card.deliveryPerson} onChange={e => onChange('deliveryPerson', e.target.value)} onKeyDown={handleEnterBlur} />
      <div className="col-span-3">
        <Input placeholder="R$ 0,00" className="bg-white border-border"
          value={editing ? draft : toBRL(card.value || 0)}
          onFocus={() => { setEditing(true); setDraft(card.value ? String(card.value) : ''); }}
          onBlur={() => { onChange('value', parseBRL(draft) || parseFloat(draft) || 0); setEditing(false); }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleEnterBlur} />
      </div>
      <div className="col-span-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {card.deliveryDate ? format(new Date(card.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single"
              selected={card.deliveryDate ? new Date(card.deliveryDate + 'T12:00:00') : undefined}
              onSelect={d => { onChange('deliveryDate', d ? format(d, 'yyyy-MM-dd') : undefined); setOpen(false); }}
              locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <Button variant="ghost" size="icon" className="col-span-1" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ---------- Pagamento section ---------- */
function PagamentoSection({ form, set }: { form: Partial<Order>; set: (k: keyof Order, v: any) => void }) {
  const [payDateOpen, setPayDateOpen] = useState(false);
  const isCredit = form.paymentMethod === 'Credit Card';
  const n = form.paymentInstallments || 0;
  const plan = form.paymentInstallmentPlan || [];
  const baseValue = form.salesValue || 0;

  useEffect(() => {
    if (!isCredit) return;
    if (plan.length === n) return;
    const valuePer = n > 0 ? +(baseValue / n).toFixed(2) : 0;
    const next: PaymentInstallment[] = Array.from({ length: n }, (_, i) =>
      plan[i] || { date: '', value: valuePer }
    );
    set('paymentInstallmentPlan', next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, isCredit]);

  const setInst = (i: number, patch: Partial<PaymentInstallment>) => {
    const next = plan.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    set('paymentInstallmentPlan', next);
  };

  return (
    <section className="border rounded-lg p-4">
      <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Pagamento</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label>Data Pagamento</Label>
          <Popover open={payDateOpen} onOpenChange={setPayDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.paymentDate ? format(new Date(form.paymentDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single"
                selected={form.paymentDate ? new Date(form.paymentDate + 'T12:00:00') : undefined}
                onSelect={d => { if (d) set('paymentDate', format(d, 'yyyy-MM-dd')); setPayDateOpen(false); }}
                locale={ptBR} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label>Multa (R$)</Label>
          <Input type="number" step="0.01" className="bg-white border-border"
            value={form.penaltyValue || ''} onChange={e => set('penaltyValue', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
        </div>
        <div>
          <Label>Juros (R$)</Label>
          <Input type="number" step="0.01" className="bg-white border-border"
            value={form.interestValue || ''} onChange={e => set('interestValue', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
        </div>
        <div>
          <Label>Forma de Pagamento</Label>
          <Select value={form.paymentMethod || ''} onValueChange={v => set('paymentMethod', v)}>
            <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isCredit && (
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min={1} className="bg-white border-border"
              value={form.paymentInstallments || ''} onChange={e => set('paymentInstallments', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
          </div>
        )}
      </div>

      {isCredit && plan.length > 0 && (
        <div className="mt-4 space-y-2">
          <Label>Datas e valores das parcelas</Label>
          {plan.map((p, i) => (
            <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 items-center">
              <span className="text-sm font-medium">{i + 1}ª</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {p.date ? format(new Date(p.date + 'T12:00:00'), 'dd/MM/yyyy') : 'Data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single"
                    selected={p.date ? new Date(p.date + 'T12:00:00') : undefined}
                    onSelect={d => setInst(i, { date: d ? format(d, 'yyyy-MM-dd') : '' })}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Input type="number" step="0.01" placeholder="Valor da parcela"
                value={p.value || ''} onChange={e => setInst(i, { value: parseFloat(e.target.value) || 0 })} onKeyDown={handleEnterBlur} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

