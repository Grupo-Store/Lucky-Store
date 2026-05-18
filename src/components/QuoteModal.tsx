import { useState, useEffect, KeyboardEvent } from 'react';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Company, Seller, SELLERS } from '@/store/OrderStore';
import {
  Quote, QuoteItem, DirectSupplyQuoteItem, QuotePhases, QuotePhaseKey,
  QUOTE_PHASE_COLORS, QUOTE_PHASE_LABELS, emptyPhases,
} from '@/store/QuoteStore';
import { useCreateQuote, useUpdateQuote, useUpdateQuotePhase } from '@/api/hooks/useQuotes';
import { QuoteStatusTimeline } from '@/components/StatusTimeline';
import { apiClient, getApiError } from '@/api/client';
import type { CreateCotacaoPayload, UpdateCotacaoPayload, UpdateCotacaoFasePayload } from '@/types/api';
import { LOJA_IDS, VENDEDOR_IDS } from '@/api/storeConfig';

function toBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parseBRL(s: string): number {
  return parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}
function fmtDate(iso?: string) {
  if (!iso) return 'Selecionar';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

const emptyQuote = (index: string): Quote => ({
  id: '', index, createdAt: Date.now(), b2bCompany: '', customer: '', cnpj: '',
  requestNumber: '', requestDate: format(new Date(), 'yyyy-MM-dd'),
  company: '', directBilling: false, supplier: '', seller: '',
  value: 0, items: [], directSupplyItems: [], observations: '', phases: emptyPhases(),
  taxLucky: 0, taxBTech: 0,
});

interface Props {
  open: boolean;
  onClose: () => void;
  quote?: Quote | null;
  onSave: (q: Quote) => void;
  onDelete?: (id: string) => void;
  nextIndex: () => string;
}

/** Currency input that lets the user type freely while focused, then formats on blur. */
function CurrencyInput({ value, onChange, className }: {
  value: number; onChange: (n: number) => void; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <Input
      className={cn('bg-white border-border', className)}
      value={editing ? draft : toBRL(typeof value === 'number' ? value : 0)}
      onFocus={() => { setEditing(true); setDraft(value ? String(value) : ''); }}
      onBlur={() => { onChange(parseBRL(draft) || parseFloat(draft) || 0); setEditing(false); }}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={handleEnterBlur}
    />
  );
}

export function QuoteModal({ open, onClose, quote, onSave, onDelete, nextIndex }: Props) {
  const [form, setForm] = useState<Quote>(() => emptyQuote(nextIndex()));
  const [datePopover, setDatePopover] = useState<string | null>(null);
  const isEdit = !!quote;

  const { mutate: createQuote, isPending: isCreating } = useCreateQuote();
  const { mutate: updateQuote, isPending: isUpdating } = useUpdateQuote(quote?.id ?? '');
  const { mutate: updateQuotePhase, isPending: isUpdatingPhase } = useUpdateQuotePhase(quote?.id ?? '');
  const isPending = isCreating || isUpdating || isUpdatingPhase;

  useEffect(() => {
    if (quote) {
      setForm({
        ...quote,
        items: quote.items ? quote.items.map(i => ({ ...i })) : [],
        directSupplyItems: quote.directSupplyItems ? quote.directSupplyItems.map(i => ({ ...i })) : [],
        observations: quote.observations || '',
        phases: { ...quote.phases },
      });
    } else {
      setForm(emptyQuote(nextIndex()));
    }
    setDatePopover(null);
  }, [quote, open, nextIndex]);

  const set = <K extends keyof Quote>(k: K, v: Quote[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const setPhase = <K extends keyof QuotePhases>(key: K, patch: Partial<QuotePhases[K]>) => {
    setForm(prev => ({ ...prev, phases: { ...prev.phases, [key]: { ...prev.phases[key], ...patch } as QuotePhases[K] } }));
  };

  /* ---------- Regular items ---------- */
  const addItem = () => set('items', [...(form.items || []), {
    id: crypto.randomUUID(), name: '', quantity: 1, quoteValue: 0, closingValue: 0, supplier: '',
  } as QuoteItem]);
  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    set('items', (form.items || []).map(i => i.id === id ? { ...i, [field]: value } : i));
  };
  const removeItem = (id: string) => set('items', (form.items || []).filter(i => i.id !== id));

  /* ---------- Direct supply items ---------- */
  const addDsItem = () => set('directSupplyItems', [...(form.directSupplyItems || []), {
    id: crypto.randomUUID(), name: '', quantity: 1, quoteValue: 0, closingValue: 0,
    supplier: '', supplierPct: 0, supplierFreight: 0,
  } as DirectSupplyQuoteItem]);
  const updateDsItem = (id: string, field: keyof DirectSupplyQuoteItem, value: any) => {
    set('directSupplyItems', (form.directSupplyItems || []).map(i => i.id === id ? { ...i, [field]: value } : i));
  };
  const removeDsItem = (id: string) => set('directSupplyItems', (form.directSupplyItems || []).filter(i => i.id !== id));

  /* ---------- Derived totals (auto-calculated) ---------- */
  const items = form.items || [];
  const dsItems = form.directSupplyItems || [];
  const totalCost = items.reduce((s, i) => s + (i.quoteValue || 0) * (i.quantity || 0), 0);
  const totalRevenue = items.reduce((s, i) => s + (i.closingValue || 0) * (i.quantity || 0), 0);
  const dsTotalCost = dsItems.reduce((s, i) => s + (i.quoteValue || 0) * (i.quantity || 0), 0);
  const dsTotalRevenue = dsItems.reduce((s, i) => s + (i.closingValue || 0) * (i.quantity || 0), 0);
  const taxLucky = form.taxLucky || 0;
  const taxBTech = form.taxBTech || 0;
  const allCost = totalCost + dsTotalCost;
  const allRevenue = totalRevenue + dsTotalRevenue;
  const margin = allCost > 0 ? ((allRevenue / allCost) - 1) * 100 : 0;
  // grossProfit = lucro interno de itens diretos + margem bruta de itens normais
  const regularGrossProfit = totalRevenue - totalCost;
  const dsInternalProfit = dsItems.reduce((s, i) => {
    const lineDiff = ((i.closingValue || 0) - (i.quoteValue || 0)) * (i.quantity || 0);
    const supplierProfit = lineDiff * (i.supplierPct || 0) / 100;
    return s + (lineDiff - supplierProfit);
  }, 0);
  const grossProfit = regularGrossProfit + dsInternalProfit;
  const profitBTech = (allRevenue * ((100 - taxBTech) / 100)) - allCost;
  const profitLucky = (allRevenue * ((100 - taxLucky) / 100)) - allCost;

  // Auto-sync closed phase value to sum of all Valor Final
  useEffect(() => {
    if ((form.phases.closed.value || 0) !== totalRevenue) {
      setForm(prev => ({
        ...prev,
        phases: { ...prev.phases, closed: { ...prev.phases.closed, value: totalRevenue } },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRevenue]);

  const buildPhasePayload = (q: Quote): UpdateCotacaoFasePayload => ({
    status_enviada: q.phases.sent.active,
    data_envio: q.phases.sent.date || undefined,
    status_em_fechamento: q.phases.forClosing.active,
    data_prevista_fechamento: q.phases.forClosing.expectedDate || undefined,
    status_fechada: q.phases.closed.active,
    data_fechamento: q.phases.closed.date || undefined,
    valor_fechamento: q.phases.closed.value != null ? String(q.phases.closed.value) : undefined,
    status_caida: q.phases.dropped.active,
    data_queda: q.phases.dropped.date || undefined,
  });

  const handleSave = () => {
    const q: Quote = { ...form, id: form.id || crypto.randomUUID(), createdAt: form.createdAt || Date.now() };

    const onApiError = (err: unknown) => toast.error(getApiError(err));

    if (isEdit) {
      const payload: UpdateCotacaoPayload = {
        cliente: q.customer,
        data_cotacao: q.requestDate,
        cnpj_cliente: q.cnpj || undefined,
        numero_requisicao: q.requestNumber || undefined,
        b2b_company: q.b2bCompany || undefined,
        is_direct_billing: q.directBilling,
        fornecedor: q.directBilling ? (q.supplier || undefined) : undefined,
        valor_total: String(q.value),
        pct_imposto_lucky: q.taxLucky != null ? String(q.taxLucky) : undefined,
        pct_imposto_btech: q.taxBTech != null ? String(q.taxBTech) : undefined,
        observacao: q.observations || undefined,
      };
      updateQuote(payload, {
        onSuccess: async () => {
          try {
            const quoteId = quote!.id;
            const originalItems = [...(quote!.items || []), ...(quote!.directSupplyItems || [])];
            await Promise.all(originalItems.map(i => apiClient.delete(`/quotes/${quoteId}/items/${i.id}`)));
            const allNewItems = [
              ...(q.items || []).map(i => ({
                descricao: i.name,
                quantidade: i.quantity,
                valor_unitario: String(i.quoteValue ?? 0),
                valor_fechamento: i.closingValue != null ? String(i.closingValue) : undefined,
                fornecedor: i.supplier || undefined,
              })),
              ...(q.directSupplyItems || []).map(i => ({
                descricao: i.name,
                quantidade: i.quantity,
                valor_unitario: String(i.quoteValue ?? 0),
                valor_fechamento: i.closingValue != null ? String(i.closingValue) : undefined,
                fornecedor: i.supplier || undefined,
                is_direct_supply: true,
                porcentagem_fornecedor: i.supplierPct != null ? String(i.supplierPct) : undefined,
                frete_fornecedor: i.supplierFreight != null ? String(i.supplierFreight) : undefined,
              })),
            ];
            await Promise.all(allNewItems.map(item => apiClient.post(`/quotes/${quoteId}/items`, item)));
            updateQuotePhase(buildPhasePayload(q), {
              onSuccess: () => { toast.success('Cotação atualizada com sucesso'); onSave(q); onClose(); },
              onError: onApiError,
            });
          } catch (err) {
            onApiError(err);
          }
        },
        onError: onApiError,
      });
    } else {
      const payload: CreateCotacaoPayload = {
        id_loja: LOJA_IDS[q.company] ?? '',
        id_vendedor: VENDEDOR_IDS[q.seller] ?? '',
        cliente: q.customer,
        data_cotacao: q.requestDate,
        cnpj_cliente: q.cnpj || undefined,
        numero_requisicao: q.requestNumber || undefined,
        b2b_company: q.b2bCompany || undefined,
        is_direct_billing: q.directBilling,
        fornecedor: q.directBilling ? (q.supplier || undefined) : undefined,
        valor_total: String(q.value),
        pct_imposto_lucky: q.taxLucky != null ? String(q.taxLucky) : undefined,
        pct_imposto_btech: q.taxBTech != null ? String(q.taxBTech) : undefined,
        observacao: q.observations || undefined,
        itens: [
          ...(q.items || []).map(i => ({
            descricao: i.name,
            quantidade: i.quantity,
            valor_unitario: String(i.quoteValue ?? 0),
            valor_fechamento: i.closingValue != null ? String(i.closingValue) : undefined,
            fornecedor: i.supplier || undefined,
          })),
          ...(q.directSupplyItems || []).map(i => ({
            descricao: i.name,
            quantidade: i.quantity,
            valor_unitario: String(i.quoteValue ?? 0),
            valor_fechamento: i.closingValue != null ? String(i.closingValue) : undefined,
            fornecedor: i.supplier || undefined,
            is_direct_supply: true,
            porcentagem_fornecedor: i.supplierPct != null ? String(i.supplierPct) : undefined,
            frete_fornecedor: i.supplierFreight != null ? String(i.supplierFreight) : undefined,
          })),
        ],
      };
      createQuote(payload, {
        onSuccess: (data) => {
          const phasePayload = buildPhasePayload(q);
          const hasPhase = q.phases.sent.active || q.phases.forClosing.active ||
            q.phases.closed.active || q.phases.dropped.active;
          const finish = () => { toast.success('Cotação criada com sucesso'); onSave({ ...q, id: data.id }); onClose(); };
          if (hasPhase) {
            apiClient.patch(`/quotes/${data.id}/phase`, phasePayload)
              .then(finish)
              .catch(onApiError);
          } else {
            finish();
          }
        },
        onError: onApiError,
      });
    }
  };

  const DateField = ({ phaseKey, value, onChange }: { phaseKey: string; value?: string; onChange: (iso?: string) => void }) => (
    <Popover open={datePopover === phaseKey} onOpenChange={o => setDatePopover(o ? phaseKey : null)}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
          <CalendarIcon className="mr-2 h-4 w-4" />{fmtDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? new Date(value + 'T12:00:00') : undefined}
          onSelect={d => { onChange(d ? format(d, 'yyyy-MM-dd') : undefined); setDatePopover(null); }}
          locale={ptBR}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );

  const phaseCard = (key: QuotePhaseKey, content: React.ReactNode) => {
    const active = form.phases[key].active;
    return (
      <div className={cn('border rounded-lg p-3 transition-colors', active ? QUOTE_PHASE_COLORS[key] : 'bg-muted/20')}>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <Checkbox
            checked={active}
            onCheckedChange={v => setPhase(key, { active: !!v } as any)}
          />
          <span className="text-sm font-bold">{QUOTE_PHASE_LABELS[key]}</span>
        </label>
        <div className={cn('space-y-2', !active && 'opacity-40 pointer-events-none')}>{content}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] xl:max-w-[1400px] max-h-[90vh] overflow-y-auto bg-card print:max-w-full print:max-h-none print:shadow-none">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl">
            {isEdit ? `Editar Cotação ${form.index}` : `Nova Cotação ${form.index}`}
          </DialogTitle>
        </DialogHeader>

        {/* ============== 1. INFORMAÇÕES GERAIS ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Índice (auto)</Label>
              <Input readOnly className="bg-muted border-border font-semibold" value={form.index} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input className="bg-white border-border" value={form.b2bCompany || ''}
                onChange={e => set('b2bCompany', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input className="bg-white border-border" value={form.customer || ''}
                onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input className="bg-white border-border" value={form.cnpj || ''}
                onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Nº da Requisição</Label>
              <Input className="bg-white border-border" value={form.requestNumber || ''}
                onChange={e => set('requestNumber', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Data da Requisição *</Label>
              <DateField phaseKey="reqDate" value={form.requestDate} onChange={d => set('requestDate', d || '')} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={form.company || ''} onValueChange={v => set('company', v as Company)}>
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
              <Select value={form.seller || ''} onValueChange={v => set('seller', v as Seller)}>
                <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {SELLERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <CurrencyInput value={form.value || 0} onChange={n => set('value', n)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <Switch checked={form.directBilling} onCheckedChange={v => set('directBilling', v)} />
                <span className="text-sm font-medium">Faturamento Direto?</span>
              </label>
            </div>
          </div>
        </section>

        {/* ============== 2. ITENS DE FORNECIMENTO DIRETO ============== */}
        {form.directBilling && (
          <section className="border border-amber-300 rounded-lg p-4 bg-amber-50/30">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Itens de Fornecimento Direto</h3>
              <Button size="sm" onClick={addDsItem} className="bg-secondary hover:bg-secondary/90">
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </div>
            <div className="space-y-2 overflow-x-auto">
              {(form.directSupplyItems || []).map(item => {
                const lineCost = (item.quoteValue || 0) * (item.quantity || 0);
                const lineFinal = (item.closingValue || 0) * (item.quantity || 0);
                const lineDiff = lineFinal - lineCost;
                const supplierProfit = lineDiff * (item.supplierPct || 0) / 100;
                const internalProfit = lineDiff - supplierProfit;
                return (
                  <div key={item.id} className="border rounded-md p-2 bg-white space-y-2">
                    <div className="grid gap-2 items-start" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                      <div style={{ gridColumn: 'span 4' }}>
                        <Input placeholder="Nome do Item" className="bg-white border-border"
                          value={item.name || ''} onChange={e => updateDsItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Nome</span>
                      </div>
                      <div style={{ gridColumn: 'span 1' }}>
                        <Input type="number" min={1} placeholder="Qtd" className="bg-white border-border"
                          value={item.quantity} onChange={e => updateDsItem(item.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Qtd</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <CurrencyInput value={item.quoteValue || 0} onChange={n => updateDsItem(item.id, 'quoteValue', n)} />
                        <span className="text-[10px] text-muted-foreground">Val. Cotação</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(lineCost)} />
                        <span className="text-[10px] text-muted-foreground">Valor</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <CurrencyInput value={item.closingValue || 0} onChange={n => updateDsItem(item.id, 'closingValue', n)} />
                        <span className="text-[10px] text-muted-foreground">Val. Fechamento</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(lineFinal)} />
                        <span className="text-[10px] text-muted-foreground">Valor Final</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <Input placeholder="Fornecedor" className="bg-white border-border"
                          value={item.supplier || ''} onChange={e => updateDsItem(item.id, 'supplier', e.target.value)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Fornecedor</span>
                      </div>
                      <Button variant="ghost" size="icon" style={{ gridColumn: 'span 1' }} onClick={() => removeDsItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Input type="number" step="0.01" min={0} max={100} className="bg-white border-border"
                          value={item.supplierPct || ''} onChange={e => updateDsItem(item.id, 'supplierPct', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">% Fornecedor</span>
                      </div>
                      <div>
                        <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(supplierProfit)} />
                        <span className="text-[10px] text-muted-foreground">Lucro Fornecedor</span>
                      </div>
                      <div>
                        <CurrencyInput value={item.supplierFreight || 0} onChange={n => updateDsItem(item.id, 'supplierFreight', n)} />
                        <span className="text-[10px] text-muted-foreground">Frete Fornecedor</span>
                      </div>
                      <div>
                        <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(internalProfit)} />
                        <span className="text-[10px] text-muted-foreground">Lucro Interno</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(form.directSupplyItems || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item de fornecimento direto adicionado</p>
              )}
            </div>
          </section>
        )}

        {/* ============== 3. ITENS DA COTAÇÃO ============== */}
        <section className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Itens da Cotação</h3>
            <Button size="sm" onClick={addItem} className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </div>
          <div className="space-y-2">
            {(form.items || []).map(item => {
              const lineCost = (item.quoteValue || 0) * (item.quantity || 0);
              const lineFinal = (item.closingValue || 0) * (item.quantity || 0);
              return (
                <div key={item.id} className="grid grid-cols-16 gap-2 items-center border rounded-md p-2 bg-muted/20" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                  <Input placeholder="Nome do Item" className="bg-white border-border" style={{ gridColumn: 'span 3' }}
                    value={item.name || ''} onChange={e => updateItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                  <Input type="number" min={1} placeholder="Qtd" className="bg-white border-border" style={{ gridColumn: 'span 1' }}
                    value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <CurrencyInput value={item.quoteValue || 0} onChange={n => updateItem(item.id, 'quoteValue', n)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(lineCost)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <CurrencyInput value={item.closingValue || 0} onChange={n => updateItem(item.id, 'closingValue', n)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(lineFinal)} />
                  </div>
                  <Input placeholder="Fornecedor" className="bg-white border-border" style={{ gridColumn: 'span 3' }}
                    value={item.supplier || ''} onChange={e => updateItem(item.id, 'supplier', e.target.value)} onKeyDown={handleEnterBlur} />
                  <Button variant="ghost" size="icon" style={{ gridColumn: 'span 1' }} onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            {(form.items || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado</p>
            )}
            {(form.items || []).length > 0 && (
              <div className="grid gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                <span style={{ gridColumn: 'span 3' }}>Nome</span>
                <span style={{ gridColumn: 'span 1' }}>Qtd</span>
                <span style={{ gridColumn: 'span 2' }}>Valor Cotação</span>
                <span style={{ gridColumn: 'span 2' }}>Valor</span>
                <span style={{ gridColumn: 'span 2' }}>Valor Fechamento</span>
                <span style={{ gridColumn: 'span 2' }}>Valor Final</span>
                <span style={{ gridColumn: 'span 3' }}>Fornecedor</span>
              </div>
            )}
          </div>
        </section>

        {/* ============== 3. OBSERVAÇÕES ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Observações</h3>
          <Textarea
            className="bg-white border-border min-h-24"
            value={form.observations || ''}
            onChange={e => set('observations', e.target.value)}
            placeholder="Anotações sobre a cotação..."
          />
        </section>

        {/* ============== 4. FASES (PARALELAS) ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Status (Fases Paralelas)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {phaseCard('sent', (
              <div>
                <Label className="text-xs">Data de Envio</Label>
                <DateField phaseKey="sent" value={form.phases.sent.date}
                  onChange={d => setPhase('sent', { date: d })} />
              </div>
            ))}
            {phaseCard('forClosing', (
              <div>
                <Label className="text-xs">Data Prevista</Label>
                <DateField phaseKey="forClosing" value={form.phases.forClosing.expectedDate}
                  onChange={d => setPhase('forClosing', { expectedDate: d })} />
              </div>
            ))}
            {phaseCard('closed', (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Data de Fechamento</Label>
                  <DateField phaseKey="closed" value={form.phases.closed.date}
                    onChange={d => setPhase('closed', { date: d })} />
                </div>
                <div>
                  <Label className="text-xs">Valor (R$) — auto</Label>
                  <Input readOnly className="bg-muted border-border font-semibold" value={toBRL(totalRevenue)} />
                </div>
              </div>
            ))}
            {phaseCard('dropped', (
              <div>
                <Label className="text-xs">Data da Queda</Label>
                <DateField phaseKey="dropped" value={form.phases.dropped.date}
                  onChange={d => setPhase('dropped', { date: d })} />
              </div>
            ))}
          </div>
        </section>

        {/* ============== 5. IMPOSTOS ============== */}
        <section className="border rounded-lg p-4">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Impostos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Imposto Lucky Store (%)</Label>
              <Input type="number" step="0.01" min={0} className="bg-white border-border"
                value={form.taxLucky ?? 0}
                onChange={e => set('taxLucky', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Imposto BTech (%)</Label>
              <Input type="number" step="0.01" min={0} className="bg-white border-border"
                value={form.taxBTech ?? 0}
                onChange={e => set('taxBTech', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterBlur} />
            </div>
          </div>
        </section>

        {/* ============== 6. RESUMO DE LUCRATIVIDADE ============== */}
        <section className="border-2 border-secondary/40 rounded-lg p-4 bg-secondary/5">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Resumo de Lucratividade</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Margem</Label>
              <Input readOnly className="bg-white border-border font-bold text-secondary"
                value={`${margin.toFixed(2)}%`} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lucro Bruto</Label>
              <Input readOnly className="bg-white border-border font-bold text-secondary"
                value={toBRL(grossProfit)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lucro BTech</Label>
              <Input readOnly className="bg-white border-border font-bold text-secondary"
                value={toBRL(profitBTech)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lucro Lucky</Label>
              <Input readOnly className="bg-white border-border font-bold text-secondary"
                value={toBRL(profitLucky)} />
            </div>
          </div>
        </section>

        {/* ============== 7. HISTÓRICO DE STATUS ============== */}
        {isEdit && form.id && (
          <QuoteStatusTimeline quoteId={form.id} />
        )}

        <div className="flex justify-between items-center print:hidden">
          <div>
            {isEdit && onDelete && (
              <Button variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm('Excluir esta cotação?')) { onDelete(form.id); onClose(); } }}>
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending} className="bg-secondary hover:bg-secondary/90">
              {isPending ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Criar Cotação')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
