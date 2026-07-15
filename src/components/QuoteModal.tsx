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
import { CalendarIcon, Plus, Trash2, Printer, ClipboardList, Factory, Package, FileText, Activity, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Company, Seller } from '@/store/OrderStore';
import {
  Quote, QuoteItem, DirectSupplyQuoteItem, QuotePhases, QuotePhaseKey,
  QUOTE_PHASE_COLORS, QUOTE_PHASE_LABELS, emptyPhases,
} from '@/store/QuoteStore';
import { useCreateQuote, useUpdateQuote, useUpdateQuotePhase } from '@/api/hooks/useQuotes';
import { QuoteStatusTimeline } from '@/components/StatusTimeline';
import { apiClient, getApiError } from '@/api/client';
import type { CreateCotacaoPayload, UpdateCotacaoPayload, UpdateCotacaoFasePayload } from '@/types/api';
import { LOJA_IDS, VENDEDOR_IDS } from '@/api/storeConfig';
import { useVendedores } from '@/hooks/useVendedores';

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

/* ---------- Phase badge colors (presentation only) ---------- */
const PHASE_HEX: Record<QuotePhaseKey, [string, string]> = {
  sent:       ['#3f5bd9', '#eef0fc'],
  forClosing: ['#d68a16', '#fff6e8'],
  closed:     ['#137a42', '#e8f6ee'],
  dropped:    ['#d24545', '#fceeee'],
};

const QUOTE_MODAL_CSS = `
  .qm-root{font-family:'Sora','Inter',system-ui,sans-serif}
  .qm-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px;padding-right:8px}
  .qm-head h1{font-size:21px;font-weight:700;display:flex;align-items:center;gap:12px;color:#16273f;font-family:'Space Grotesk',sans-serif;margin:0}
  .qm-oschip{font-size:12px;font-weight:700;color:#15807c;background:#e6f3f1;border:1px solid #cfe8e3;padding:5px 11px;border-radius:8px;letter-spacing:.02em}
  .qm-badges{display:flex;gap:7px;flex-wrap:wrap}
  .qm-badge{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid}
  .qm-badge .qm-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
  .qm-meta{display:flex;gap:18px;color:#6b7787;font-size:13px;flex-wrap:wrap}
  .qm-meta b{color:#16273f;font-weight:600}

  .qm-editor{display:grid;grid-template-columns:1fr 350px;gap:18px;align-items:start}
  .qm-formcol{display:flex;flex-direction:column;gap:16px;min-width:0}

  .qm-card{background:#fff;border:1px solid #e7ebf0;border-radius:16px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 8px 24px -12px rgba(20,35,55,.16);overflow:hidden;scroll-margin-top:14px}
  .qm-card>h2{font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#15807c;padding:14px 18px;border-bottom:1px solid #e7ebf0;display:flex;align-items:center;gap:10px;background:#fcfdfe;margin:0}
  .qm-card>h2 .qm-h2-action{margin-left:auto}
  .qm-card .qm-body{padding:18px}
  .qm-card.qm-amber{border-color:#f0d9a8}
  .qm-card.qm-amber>h2{color:#b9791a;background:#fffaf0;border-bottom-color:#f0d9a8}

  .qm-root input:focus-visible,
  .qm-root textarea:focus-visible,
  .qm-root [role="combobox"]:focus-visible{
    border-color:#16807c !important;
    box-shadow:0 0 0 3px rgba(22,128,124,.14) !important;
    outline:none !important;
  }
  .qm-noarrows::-webkit-outer-spin-button,
  .qm-noarrows::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
  .qm-noarrows{ -moz-appearance:textfield; appearance:textfield; }

  .qm-aside{position:sticky;top:0;display:flex;flex-direction:column;gap:14px}
  .qm-sum{background:#fff;border:1px solid #e7ebf0;border-radius:16px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 8px 24px -12px rgba(20,35,55,.16);overflow:hidden}
  .qm-sum>h3{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7787;padding:15px 18px 0;margin:0}
  .qm-sumbody{padding:14px 18px 18px}
  .qm-line{display:flex;justify-content:space-between;align-items:center;padding:9px 0;font-size:14px;border-bottom:1px dashed #e7ebf0}
  .qm-line .k{color:#6b7787}
  .qm-line .v{font-weight:600;color:#16273f;font-variant-numeric:tabular-nums}
  .qm-result{margin-top:8px;background:linear-gradient(155deg,#11716d,#0c4f4d);border-radius:14px;padding:18px;color:#eafaf6;position:relative;overflow:hidden}
  .qm-result::after{content:"";position:absolute;right:-30px;bottom:-50px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(31,157,87,.4),transparent 70%)}
  .qm-result .lk{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a9ded5;position:relative}
  .qm-result .lv{font-size:31px;font-weight:800;line-height:1;margin-top:6px;position:relative;font-family:'Space Grotesk',sans-serif;font-variant-numeric:tabular-nums}
  .qm-marg{margin-top:14px;position:relative}
  .qm-marg .top{display:flex;justify-content:space-between;font-size:12px;color:#bfe8df;margin-bottom:6px}
  .qm-marg .top b{color:#fff;font-weight:700}
  .qm-mtrack{height:9px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}
  .qm-mtrack i{display:block;height:100%;border-radius:99px;transition:width .4s}
  .qm-stores{margin-top:8px}
  .qm-store{display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:14px;border-bottom:1px dashed #e7ebf0}
  .qm-store:last-child{border-bottom:0}
  .qm-store .k{display:flex;align-items:center;gap:8px;color:#6b7787}
  .qm-store .sdot{width:8px;height:8px;border-radius:3px}
  .qm-store .v{font-weight:700;color:#137a42;font-variant-numeric:tabular-nums}
  .qm-store .tax{font-size:11px;color:#6b7787;font-weight:500;margin-left:4px}
  .qm-jump{background:#fff;border:1px solid #e7ebf0;border-radius:16px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 8px 24px -12px rgba(20,35,55,.16);padding:8px}
  .qm-jump a{display:block;padding:9px 12px;border-radius:9px;font-size:13px;font-weight:600;color:#6b7787;text-decoration:none;transition:.15s}
  .qm-jump a:hover{background:#f7f9fb;color:#16273f}

  @media (max-width:980px){
    .qm-editor{grid-template-columns:1fr}
    .qm-aside{position:static;order:-1}
    .qm-jump{display:none}
  }
`;

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
      className={cn('bg-[#FBFCFE] border-[#E2E8F1]', className)}
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

  const { data: vendedoresData } = useVendedores();
  const vendedores = vendedoresData?.items ?? [];
  const vendorIdByName = (nome: string) =>
    vendedores.find(v => v.nome === nome)?.id ?? VENDEDOR_IDS[nome] ?? '';

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
    const custoFornecedor = lineDiff * (i.supplierPct || 0) / 100 + (i.supplierFreight || 0);
    return s + (lineDiff - custoFornecedor);
  }, 0);
  const grossProfit = regularGrossProfit + dsInternalProfit;
  const profitBTech = grossProfit * (1 - taxBTech / 100);
  const profitLucky = grossProfit * (1 - taxLucky / 100);

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
        id_vendedor: vendorIdByName(q.seller ?? ''),
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

  /* ---------------- Presentation-only derived values ---------------- */
  const activePhases = (Object.keys(form.phases) as QuotePhaseKey[]).filter(k => form.phases[k].active);
  const marginBarW = Math.max(0, Math.min(margin, 100));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto bg-[#eef1f5] qm-root print:max-w-full print:max-h-none print:shadow-none">
        <style>{QUOTE_MODAL_CSS}</style>
        <DialogHeader className="sr-only">
          <DialogTitle>{isEdit ? `Editar Cotação ${form.index}` : `Nova Cotação ${form.index}`}</DialogTitle>
        </DialogHeader>

        {/* ============== PAGE HEADER ============== */}
        <div className="qm-head">
          <h1><span className="qm-oschip">{form.index || '—'}</span> {isEdit ? 'Editar Cotação' : 'Nova Cotação'}</h1>
          <div className="qm-badges">
            {activePhases.length === 0 ? (
              <span className="qm-badge" style={{ color: '#6b7787', background: '#f1f4f7', borderColor: '#e1e7ec' }}>
                <span className="qm-dot" style={{ background: '#a4afba' }} />Sem fase
              </span>
            ) : activePhases.map(k => {
              const [c, bg] = PHASE_HEX[k];
              return (
                <span key={k} className="qm-badge" style={{ color: c, background: bg, borderColor: `${c}33` }}>
                  <span className="qm-dot" />{QUOTE_PHASE_LABELS[k]}
                </span>
              );
            })}
          </div>
          <div className="qm-meta">
            <span>Cliente <b>{form.customer || '—'}</b></span>
            <span>Empresa <b>{form.company || form.b2bCompany || '—'}</b></span>
            <span>Vendedor <b>{form.seller || '—'}</b></span>
          </div>
        </div>

        {/* ============== 2-COLUMN EDITOR ============== */}
        <div className="qm-editor">
          <div className="qm-formcol">

        {/* ============== 1. INFORMAÇÕES GERAIS ============== */}
        <section className="qm-card" id="sec-geral">
          <h2><ClipboardList className="h-[15px] w-[15px]" /> Informações Gerais</h2>
          <div className="qm-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Índice (auto)</Label>
              <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={form.index} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input className="bg-[#FBFCFE] border-[#E2E8F1]" value={form.b2bCompany || ''}
                onChange={e => set('b2bCompany', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Cliente</Label>
              <Input className="bg-[#FBFCFE] border-[#E2E8F1]" value={form.customer || ''}
                onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input className="bg-[#FBFCFE] border-[#E2E8F1]" value={form.cnpj || ''}
                onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Nº da Requisição</Label>
              <Input className="bg-[#FBFCFE] border-[#E2E8F1]" value={form.requestNumber || ''}
                onChange={e => set('requestNumber', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Data da Requisição *</Label>
              <DateField phaseKey="reqDate" value={form.requestDate} onChange={d => set('requestDate', d || '')} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Select value={form.company || ''} onValueChange={v => set('company', v as Company)}>
                <SelectTrigger className="bg-[#FBFCFE] border-[#E2E8F1]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                <SelectTrigger className="bg-[#FBFCFE] border-[#E2E8F1]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {vendedores.map(v => <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>)}
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
          </div>{/* /qm-body sec-geral */}
        </section>

        {/* ============== 2. ITENS DE FORNECIMENTO DIRETO ============== */}
        {form.directBilling && (
          <section className="qm-card qm-amber" id="sec-forn">
            <h2>
              <Factory className="h-[15px] w-[15px]" /> Itens de Fornecimento Direto
              <Button size="sm" onClick={addDsItem} className="qm-h2-action bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white">
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </h2>
            <div className="qm-body">
            <div className="space-y-2 overflow-x-auto">
              {(form.directSupplyItems || []).map(item => {
                const lineCost = (item.quoteValue || 0) * (item.quantity || 0);
                const lineFinal = (item.closingValue || 0) * (item.quantity || 0);
                const lineDiff = lineFinal - lineCost;
                const custoFornecedor = lineDiff * (item.supplierPct || 0) / 100 + (item.supplierFreight || 0);
                const internalProfit = lineDiff - custoFornecedor;
                return (
                  <div key={item.id} className="border rounded-md p-2 bg-white space-y-2">
                    <div className="grid gap-2 items-start" style={{ gridTemplateColumns: 'repeat(19, minmax(0, 1fr))' }}>
                      <div style={{ gridColumn: 'span 4' }}>
                        <Input placeholder="Nome do Item" className="bg-[#FBFCFE] border-[#E2E8F1]"
                          value={item.name || ''} onChange={e => updateDsItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Nome</span>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <Input type="number" min={1} placeholder="Qtd" className="bg-[#FBFCFE] border-[#E2E8F1] qm-noarrows"
                          value={item.quantity} onChange={e => updateDsItem(item.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Qtd</span>
                      </div>
                      <div style={{ gridColumn: 'span 3' }}>
                        <CurrencyInput value={item.quoteValue || 0} onChange={n => updateDsItem(item.id, 'quoteValue', n)} />
                        <span className="text-[10px] text-muted-foreground">Custo do produto</span>
                      </div>
                      <div style={{ gridColumn: 'span 3' }}>
                        <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(lineCost)} />
                        <span className="text-[10px] text-muted-foreground">Valor</span>
                      </div>
                      <div style={{ gridColumn: 'span 3' }}>
                        <CurrencyInput value={item.closingValue || 0} onChange={n => updateDsItem(item.id, 'closingValue', n)} />
                        <span className="text-[10px] text-muted-foreground">Valor enviado na cotação</span>
                      </div>
                      <div style={{ gridColumn: 'span 3' }}>
                        <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(lineFinal)} />
                        <span className="text-[10px] text-muted-foreground">Valor Final</span>
                      </div>
                      <Button variant="ghost" size="icon" style={{ gridColumn: 'span 1' }} onClick={() => removeDsItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <Input placeholder="Fornecedor" className="bg-[#FBFCFE] border-[#E2E8F1]"
                          value={item.supplier || ''} onChange={e => updateDsItem(item.id, 'supplier', e.target.value)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">Fornecedor</span>
                      </div>
                      <div>
                        <Input type="number" step="0.01" min={0} max={100} className="bg-[#FBFCFE] border-[#E2E8F1]"
                          value={item.supplierPct || ''} onChange={e => updateDsItem(item.id, 'supplierPct', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterBlur} />
                        <span className="text-[10px] text-muted-foreground">% Fornecedor</span>
                      </div>
                      <div>
                        <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(custoFornecedor)} />
                        <span className="text-[10px] text-muted-foreground">Custo Fornecedor</span>
                      </div>
                      <div>
                        <CurrencyInput value={item.supplierFreight || 0} onChange={n => updateDsItem(item.id, 'supplierFreight', n)} />
                        <span className="text-[10px] text-muted-foreground">Frete Fornecedor</span>
                      </div>
                      <div>
                        <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(internalProfit)} />
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
            </div>{/* /qm-body sec-forn */}
          </section>
        )}

        {/* ============== 3. ITENS DA COTAÇÃO ============== */}
        <section className="qm-card" id="sec-itens">
          <h2>
            <Package className="h-[15px] w-[15px]" /> Itens da Cotação
            <Button size="sm" onClick={addItem} className="qm-h2-action bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white">
              <Plus className="h-4 w-4 mr-1" /> Adicionar Item
            </Button>
          </h2>
          <div className="qm-body">
          <div className="space-y-2">
            {(form.items || []).map(item => {
              const lineCost = (item.quoteValue || 0) * (item.quantity || 0);
              const lineFinal = (item.closingValue || 0) * (item.quantity || 0);
              return (
                <div key={item.id} className="grid gap-2 items-center border border-[#E2E8F1] rounded-lg p-2 bg-[#F8FAFD]" style={{ gridTemplateColumns: 'repeat(17, minmax(0, 1fr))' }}>
                  <Input placeholder="Nome do Item" className="bg-[#FBFCFE] border-[#E2E8F1]" style={{ gridColumn: 'span 3' }}
                    value={item.name || ''} onChange={e => updateItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                  <Input type="number" min={1} placeholder="Qtd" className="bg-[#FBFCFE] border-[#E2E8F1] qm-noarrows" style={{ gridColumn: 'span 2' }}
                    value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <CurrencyInput value={item.quoteValue || 0} onChange={n => updateItem(item.id, 'quoteValue', n)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(lineCost)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <CurrencyInput value={item.closingValue || 0} onChange={n => updateItem(item.id, 'closingValue', n)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(lineFinal)} />
                  </div>
                  <Input placeholder="Fornecedor" className="bg-[#FBFCFE] border-[#E2E8F1]" style={{ gridColumn: 'span 3' }}
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
              <div className="grid gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold" style={{ gridTemplateColumns: 'repeat(17, minmax(0, 1fr))' }}>
                <span style={{ gridColumn: 'span 3' }}>Nome</span>
                <span style={{ gridColumn: 'span 2' }}>Qtd</span>
                <span style={{ gridColumn: 'span 2' }}>Custo do produto</span>
                <span style={{ gridColumn: 'span 2' }}>Valor</span>
                <span style={{ gridColumn: 'span 2' }}>Valor enviado na cotação</span>
                <span style={{ gridColumn: 'span 2' }}>Valor Final</span>
                <span style={{ gridColumn: 'span 3' }}>Fornecedor</span>
              </div>
            )}
          </div>
          </div>{/* /qm-body sec-itens */}
        </section>

        {/* ============== 3. OBSERVAÇÕES ============== */}
        <section className="qm-card" id="sec-obs">
          <h2><FileText className="h-[15px] w-[15px]" /> Observações</h2>
          <div className="qm-body">
          <Textarea
            className="bg-[#FBFCFE] border-[#E2E8F1] min-h-24"
            value={form.observations || ''}
            onChange={e => set('observations', e.target.value)}
            placeholder="Anotações sobre a cotação..."
          />
          </div>
        </section>

        {/* ============== 4. FASES (PARALELAS) ============== */}
        <section className="qm-card" id="sec-status">
          <h2>
            <Activity className="h-[15px] w-[15px]" /> Status
            <span className="normal-case tracking-normal font-medium text-[#6b7787] ml-1.5">(fases paralelas)</span>
          </h2>
          <div className="qm-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={toBRL(totalRevenue)} />
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
          </div>{/* /qm-body sec-status */}
        </section>

        {/* ============== 5. IMPOSTOS ============== */}
        <section className="qm-card" id="sec-impostos">
          <h2><Calculator className="h-[15px] w-[15px]" /> Impostos</h2>
          <div className="qm-body">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Imposto Lucky Store (%)</Label>
              <Input type="number" step="0.01" min={0} className="bg-[#FBFCFE] border-[#E2E8F1]"
                value={form.taxLucky ?? 0}
                onChange={e => set('taxLucky', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Imposto BTech (%)</Label>
              <Input type="number" step="0.01" min={0} className="bg-[#FBFCFE] border-[#E2E8F1]"
                value={form.taxBTech ?? 0}
                onChange={e => set('taxBTech', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterBlur} />
            </div>
          </div>
          </div>{/* /qm-body sec-impostos */}
        </section>

        {/* ============== HISTÓRICO DE STATUS ============== */}
        {isEdit && form.id && (
          <QuoteStatusTimeline quoteId={form.id} />
        )}

          </div>{/* /qm-formcol */}

          {/* ============== STICKY SUMMARY ASIDE ============== */}
          <aside className="qm-aside">
            <div className="qm-sum">
              <h3>Resumo de Lucratividade</h3>
              <div className="qm-sumbody">
                <div className="qm-line"><span className="k">Valor Final</span><span className="v">{toBRL(allRevenue)}</span></div>
                <div className="qm-line"><span className="k">Valor cotado</span><span className="v">{toBRL(allCost)}</span></div>
                <div className="qm-result">
                  <div className="lk">Lucro Bruto</div>
                  <div className="lv" style={{ color: grossProfit >= 0 ? '#eafaf6' : '#ffd2d2' }}>{toBRL(grossProfit)}</div>
                  <div className="qm-marg">
                    <div className="top"><span>Margem</span><b>{`${margin.toFixed(2).replace('.', ',')}%`}</b></div>
                    <div className="qm-mtrack">
                      <i style={{ width: `${marginBarW}%`, background: grossProfit >= 0 ? 'linear-gradient(90deg,#7be3a8,#1fd07a)' : 'linear-gradient(90deg,#f1a3a3,#e05a5a)' }} />
                    </div>
                  </div>
                </div>
                <div className="qm-stores">
                  <div className="qm-store">
                    <span className="k"><span className="sdot" style={{ background: '#3f5bd9' }} />Lucro BTech<span className="tax">(−{taxBTech}%)</span></span>
                    <span className="v">{toBRL(profitBTech)}</span>
                  </div>
                  <div className="qm-store">
                    <span className="k"><span className="sdot" style={{ background: '#1f9d57' }} />Lucro Lucky<span className="tax">(−{taxLucky}%)</span></span>
                    <span className="v">{toBRL(profitLucky)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="qm-actions flex flex-col gap-2.5 print:hidden">
              <Button
                onClick={handleSave}
                disabled={isPending}
                className="w-full h-12 text-[15px] font-bold text-white border-0"
                style={{ background: 'linear-gradient(135deg,#3f8fd6,#3565c9)', boxShadow: '0 12px 26px -12px rgba(53,101,201,.8)', borderRadius: 13 }}
              >
                {isPending ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Criar Cotação')}
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full h-11" style={{ borderColor: '#e7ebf0', borderRadius: 13 }}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="w-full h-11" style={{ borderColor: '#e7ebf0', borderRadius: 13 }}>
                <Printer className="h-4 w-4 mr-1.5" /> Imprimir
              </Button>
              {isEdit && onDelete && (
                <Button variant="ghost" className="w-full h-11 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm('Excluir esta cotação?')) { onDelete(form.id); onClose(); } }}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                </Button>
              )}
            </div>

            <nav className="qm-jump">
              <a href="#sec-geral">Informações Gerais</a>
              {form.directBilling && <a href="#sec-forn">Fornecimento Direto</a>}
              <a href="#sec-itens">Itens da Cotação</a>
              <a href="#sec-obs">Observações</a>
              <a href="#sec-status">Status</a>
              <a href="#sec-impostos">Impostos</a>
            </nav>
          </aside>

        </div>{/* /qm-editor */}
      </DialogContent>
    </Dialog>
  );
}
