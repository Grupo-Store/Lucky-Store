import { useState, useEffect, KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ClipboardList, Wrench, Truck, Printer, Plus, Trash2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { apiClient, getApiError } from '@/api/client';
import { RmaStatusTimeline } from '@/components/StatusTimeline';
import { rmaKeys } from '@/api/hooks/useRma';
import type { RmaResponse, ItemRmaStatus } from '@/types/api';

const ITEM_STATUS_OPTIONS: { value: ItemRmaStatus; label: string; color: string }[] = [
  { value: 'Not Received',          label: 'Não Recebido',          color: 'bg-slate-50 text-slate-600 border-slate-300' },
  { value: 'Received',              label: 'Recebido',              color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'Sent for Repair',       label: 'Enviado para Reparo',   color: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { value: 'In Repair',             label: 'Em Reparo',             color: 'bg-orange-50 text-orange-700 border-orange-300' },
  { value: 'Repaired Not Received', label: 'Reparado Não Recebido', color: 'bg-purple-50 text-purple-700 border-purple-300' },
  { value: 'Repaired Received',     label: 'Reparado Recebido',     color: 'bg-teal-50 text-teal-700 border-teal-300' },
  { value: 'To Pack',               label: 'A Embalar',             color: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { value: 'Ready for Delivery',    label: 'Pronto p/ Entrega',     color: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  { value: 'Out for Delivery',      label: 'Em Entrega',            color: 'bg-amber-50 text-amber-700 border-amber-300' },
  { value: 'Delivered',             label: 'Entregue',              color: 'bg-green-100 text-green-800 border-green-400' },
  { value: 'Estorno',               label: 'Estorno',               color: 'bg-red-50 text-red-700 border-red-300' },
];

const itemStatusColor = (s: string) =>
  ITEM_STATUS_OPTIONS.find(o => o.value === s)?.color ?? 'bg-muted text-muted-foreground border-border';

/* ---------- Header status badge colors (presentation only) ---------- */
const STATUS_HEX: Record<string, [string, string, string]> = {
  'Not Received':          ['#64748b', '#f8fafc', '#cbd5e1'],
  'Received':              ['#2563eb', '#eff6ff', '#bfdbfe'],
  'Sent for Repair':       ['#a16207', '#fefce8', '#fde68a'],
  'In Repair':             ['#d68a16', '#fff6e8', '#f4dcb0'],
  'Repaired Not Received': ['#7c5cd6', '#f1ecfb', '#ddd2f4'],
  'Repaired Received':     ['#16807c', '#e6f3f1', '#cfe8e3'],
  'To Pack':               ['#0e7490', '#ecfeff', '#a5f3fc'],
  'Ready for Delivery':    ['#4f46e5', '#eef2ff', '#c7d2fe'],
  'Out for Delivery':      ['#d68a16', '#fff6e8', '#f4dcb0'],
  'Delivered':             ['#137a42', '#e8f6ee', '#c7e8d3'],
  'Estorno':               ['#b91c1c', '#fef2f2', '#fecaca'],
};
const statusLabel = (s: string) => ITEM_STATUS_OPTIONS.find(o => o.value === s)?.label ?? s;

const RMA_MODAL_CSS = `
  .rm-root{font-family:'Sora','Inter',system-ui,sans-serif}
  .rm-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px;padding-right:8px}
  .rm-head h1{font-size:22px;font-weight:700;display:flex;align-items:center;gap:12px;color:#16273f;font-family:'Space Grotesk',sans-serif;margin:0}
  .rm-oschip{font-size:12px;font-weight:700;color:#15807c;background:#e6f3f1;border:1px solid #cfe8e3;padding:5px 11px;border-radius:8px;letter-spacing:.02em}
  .rm-badge{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:999px;border:1px solid}
  .rm-badge .rm-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
  .rm-meta{display:flex;gap:18px;color:#6b7787;font-size:13px;flex-wrap:wrap}
  .rm-meta b{color:#16273f;font-weight:600}

  .rm-editor{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
  .rm-formcol{display:flex;flex-direction:column;gap:20px;min-width:0}

  .rm-card{background:#fff;border:1px solid #e7ebf0;border-radius:18px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 10px 28px -14px rgba(20,35,55,.18);overflow:hidden;scroll-margin-top:14px}
  .rm-card>h2{font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#15807c;padding:18px 22px;border-bottom:1px solid #e7ebf0;display:flex;align-items:center;gap:11px;background:#fcfdfe;margin:0}
  .rm-card>h2 .rm-count{color:#6b7787;font-weight:600;letter-spacing:0;text-transform:none}
  .rm-card>h2 .rm-h2-action{margin-left:auto}
  .rm-card .rm-body{padding:22px}

  .rm-ditem{border:1px solid #e7ebf0;border-radius:14px;padding:18px;background:#fcfdfe}
  .rm-ditem+.rm-ditem{margin-top:14px}
  .rm-itemhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .rm-itemhead .t{font-size:12px;font-weight:700;letter-spacing:.06em;color:#15807c;text-transform:uppercase}
  .rm-empty{text-align:center;color:#6b7787;padding:22px;font-size:13.5px;background:#f7f9fb;border-radius:12px;border:1px dashed #e7ebf0}
  .rm-fretetotal{text-align:right;font-weight:700;color:#15807c;margin-top:14px;font-size:14px;font-variant-numeric:tabular-nums}

  .rm-root input:focus-visible,
  .rm-root textarea:focus-visible,
  .rm-root [role="combobox"]:focus-visible{
    border-color:#16807c !important;
    box-shadow:0 0 0 3px rgba(22,128,124,.14) !important;
    outline:none !important;
  }

  .rm-aside{position:sticky;top:0;display:flex;flex-direction:column;gap:14px}
  .rm-sum{background:#fff;border:1px solid #e7ebf0;border-radius:18px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 10px 28px -14px rgba(20,35,55,.18);overflow:hidden}
  .rm-sum>h3{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7787;padding:16px 20px 4px;margin:0}
  .rm-sumbody{padding:8px 20px 18px}
  .rm-line{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;font-size:13.5px;border-bottom:1px dashed #e7ebf0}
  .rm-line:last-child{border-bottom:0}
  .rm-line .k{color:#6b7787}
  .rm-line .v{font-weight:600;color:#16273f;text-align:right;font-variant-numeric:tabular-nums}
  .rm-jump{background:#fff;border:1px solid #e7ebf0;border-radius:18px;box-shadow:0 1px 2px rgba(20,35,55,.05),0 10px 28px -14px rgba(20,35,55,.18);padding:8px}
  .rm-jump a{display:block;padding:9px 12px;border-radius:9px;font-size:13px;font-weight:600;color:#6b7787;text-decoration:none;transition:.15s}
  .rm-jump a:hover{background:#f7f9fb;color:#16273f}

  @media (max-width:920px){
    .rm-editor{grid-template-columns:1fr}
    .rm-aside{position:static;order:-1}
    .rm-jump{display:none}
  }

  @media print{
    .rm-actions,.rm-jump,.rm-del,.rm-h2-action{display:none !important}
    .rm-editor{grid-template-columns:1fr !important;gap:14px}
    .rm-aside{position:static !important;order:2}
    .rm-card,.rm-sum,.rm-ditem{box-shadow:none !important;break-inside:avoid}
  }
`;

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

interface LocalItem {
  id: string;
  descricao: string;
  quantidade: number;
  status: ItemRmaStatus;
  consertado_por: string;
  fornecedor: string;
  valor_estornado: number;
  data_estorno: string;
  motivo_estorno: string;
}

interface LocalFrete {
  id: string;
  responsavel: string;
  valor: number;
  data: string;
}

function parseBRL(s: string): number {
  return parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}
function toBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  open: boolean;
  onClose: () => void;
  rma: RmaResponse | null;
}

export function RmaEditModal({ open, onClose, rma }: Props) {
  const qc = useQueryClient();
  const [localPrazo, setLocalPrazo] = useState<string>('');
  const [prazoOpen, setPrazoOpen] = useState(false);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [fretes, setFretes] = useState<LocalFrete[]>([]);
  const [fretePopover, setFretePopover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rma && open) {
      setLocalPrazo(rma.prazo_entrega ?? '');
      setLocalItems(rma.itens.map(i => ({
        id: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        status: i.status,
        consertado_por: i.consertado_por ?? '',
        fornecedor: i.fornecedor ?? '',
        valor_estornado: parseFloat(i.valor_estornado ?? '0') || 0,
        data_estorno: i.data_estorno ?? '',
        motivo_estorno: i.motivo_estorno ?? '',
      })));
      // Fretes de RMA ainda não têm persistência no backend (sem endpoint/campo em RmaResponse).
      // Mantemos somente em estado local até o modelo de dados suportá-los.
      setFretes([]);
    }
  }, [rma, open]);

  if (!rma) return null;

  const updateItem = (id: string, field: keyof LocalItem, value: string) =>
    setLocalItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  /* ---------- Fretes (local only — sem persistência ainda) ---------- */
  const addFrete = () => setFretes(prev => [...prev, {
    id: crypto.randomUUID(), responsavel: '', valor: 0, data: format(new Date(), 'yyyy-MM-dd'),
  }]);
  const updateFrete = (id: string, field: keyof LocalFrete, value: string | number) =>
    setFretes(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  const removeFrete = (id: string) => setFretes(prev => prev.filter(f => f.id !== id));
  const freteTotal = fretes.reduce((s, f) => s + (f.valor || 0), 0);

  /* ---------- Primary status (presentation only) ---------- */
  const statusPriority = ITEM_STATUS_OPTIONS.map(o => o.value);
  const primaryStatus: string | null = localItems.length
    ? localItems.reduce((min, it) =>
        statusPriority.indexOf(it.status) < statusPriority.indexOf(min) ? it.status : min,
      localItems[0].status)
    : null;
  const [stColor, stBg, stBorder] = (primaryStatus && STATUS_HEX[primaryStatus]) || ['#6b7787', '#f1f4f7', '#e1e7ec'];

  const handleSave = async () => {
    setSaving(true);
    try {
      if (localPrazo !== (rma.prazo_entrega ?? '')) {
        await apiClient.patch(`/rma/${rma.id}`, { prazo_entrega: localPrazo || undefined });
      }

      for (const item of localItems) {
        const orig = rma.itens.find(i => i.id === item.id);
        const origEstornado = parseFloat(orig?.valor_estornado ?? '0') || 0;
        const changed = orig && (
          item.status !== orig.status ||
          item.consertado_por !== (orig.consertado_por ?? '') ||
          item.fornecedor !== (orig.fornecedor ?? '') ||
          item.valor_estornado !== origEstornado ||
          item.data_estorno !== (orig.data_estorno ?? '') ||
          item.motivo_estorno !== (orig.motivo_estorno ?? '')
        );
        if (changed) {
          await apiClient.patch(`/rma/${rma.id}/items/${item.id}/status`, {
            new_status: item.status,
            consertado_por: item.consertado_por || undefined,
            fornecedor: item.fornecedor || null,
            valor_estornado: item.valor_estornado || null,
            data_estorno: item.data_estorno || null,
            motivo_estorno: item.motivo_estorno || null,
          });
        }
      }

      qc.invalidateQueries({ queryKey: rmaKeys.lists() });
      qc.invalidateQueries({ queryKey: rmaKeys.history(rma.id) });
      toast.success('RMA atualizado com sucesso!');
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto bg-[#eef1f5] rm-root print:max-w-full print:max-h-none print:shadow-none">
        <style>{RMA_MODAL_CSS}</style>
        <DialogHeader className="sr-only">
          <DialogTitle>RMA: {rma.numero_rma}</DialogTitle>
        </DialogHeader>

        {/* ============== PAGE HEADER ============== */}
        <div className="rm-head">
          <h1><span className="rm-oschip">{rma.numero_rma}</span> Editar RMA</h1>
          {primaryStatus && (
            <span className="rm-badge" style={{ color: stColor, background: stBg, borderColor: stBorder }}>
              <span className="rm-dot" />{statusLabel(primaryStatus)}
            </span>
          )}
          <div className="rm-meta">
            <span>Pedido origem <b>{rma.numero_os_origem ?? rma.id_pedido_origem}</b></span>
            <span>Prazo <b>{localPrazo ? fmtDate(localPrazo) : '—'}</b></span>
          </div>
          <Button
            variant="outline" size="icon"
            onClick={() => window.print()}
            className="rm-h2-action ml-auto"
            style={{ borderColor: '#e7ebf0', borderRadius: 11, width: 40, height: 40, color: '#6b7787' }}
            title="Imprimir"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>

        {/* ============== 2-COLUMN EDITOR ============== */}
        <div className="rm-editor">
          <div className="rm-formcol">

            {/* ===== Informações Gerais ===== */}
            <section className="rm-card" id="sec-geral">
              <h2><ClipboardList className="h-4 w-4" /> Informações Gerais</h2>
              <div className="rm-body">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Nº RMA</Label>
                    <Input readOnly value={rma.numero_rma} className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" />
                  </div>
                  <div>
                    <Label>Pedido Origem</Label>
                    <Input readOnly value={rma.numero_os_origem ?? rma.id_pedido_origem} className="bg-[#F4F7FB] border-[#E2E8F1]" />
                  </div>
                  <div>
                    <Label>Data de Registro</Label>
                    <Input readOnly value={fmtDate(rma.data_registro)} className="bg-[#F4F7FB] border-[#E2E8F1]" />
                  </div>
                  <div>
                    <Label>Prazo de Entrega</Label>
                    <Popover open={prazoOpen} onOpenChange={setPrazoOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {localPrazo ? fmtDate(localPrazo) : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={localPrazo ? new Date(localPrazo + 'T12:00:00') : undefined}
                          onSelect={d => { setLocalPrazo(d ? format(d, 'yyyy-MM-dd') : ''); setPrazoOpen(false); }}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </section>

            {/* ===== Itens ===== */}
            <section className="rm-card" id="sec-itens">
              <h2><Wrench className="h-4 w-4" /> Itens do RMA <span className="rm-count">({localItems.length})</span></h2>
              <div className="rm-body">
                {localItems.length === 0 && (
                  <div className="rm-empty">Nenhum item neste RMA</div>
                )}
                {localItems.map((item, idx) => (
                  <div key={item.id} className="rm-ditem">
                    <div className="rm-itemhead">
                      <span className="t">Item #{idx + 1}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="md:col-span-2">
                        <Label>Produto</Label>
                        <Input readOnly value={item.descricao} className="bg-[#F4F7FB] border-[#E2E8F1]" />
                      </div>
                      <div>
                        <Label>Quantidade</Label>
                        <Input readOnly value={item.quantidade} className="bg-[#F4F7FB] border-[#E2E8F1]" />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={item.status} onValueChange={v => updateItem(item.id, 'status', v)}>
                          <SelectTrigger className={cn('border', itemStatusColor(item.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', opt.color)}>{opt.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Reparado por</Label>
                        <Input
                          className="bg-[#FBFCFE] border-[#E2E8F1]"
                          value={item.consertado_por}
                          onChange={e => updateItem(item.id, 'consertado_por', e.target.value)}
                          onKeyDown={handleEnterBlur}
                          placeholder="Fornecedor / técnico"
                        />
                      </div>
                      <div>
                        <Label>Fornecedor</Label>
                        <Input
                          className="bg-[#FBFCFE] border-[#E2E8F1]"
                          value={item.fornecedor}
                          onChange={e => updateItem(item.id, 'fornecedor', e.target.value)}
                          onKeyDown={handleEnterBlur}
                          placeholder="Fornecedor de origem"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ===== Devoluções / Estorno ===== */}
            <section className="rm-card" id="sec-devolucao">
              <h2><RotateCcw className="h-4 w-4" /> Devoluções / Estorno</h2>
              <div className="rm-body">
                {localItems.filter(i => i.valor_estornado > 0 || i.motivo_estorno).length === 0 && localItems.length > 0 && (
                  <div className="rm-empty">Nenhum estorno registrado. Preencha o valor estornado nos itens abaixo.</div>
                )}
                {localItems.map((item, idx) => (
                  <div key={item.id} className="rm-ditem">
                    <div className="rm-itemhead">
                      <span className="t">{item.descricao} (Qtd: {item.quantidade})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div>
                        <Label>Fornecedor</Label>
                        <Input readOnly value={item.fornecedor || '—'} className="bg-[#F4F7FB] border-[#E2E8F1]" />
                      </div>
                      <div>
                        <Label>Valor Estornado (R$)</Label>
                        <Input
                          type="number" step="0.01" min={0}
                          className="bg-[#FBFCFE] border-[#E2E8F1]"
                          placeholder="0,00"
                          value={item.valor_estornado || ''}
                          onChange={e => setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, valor_estornado: parseFloat(e.target.value) || 0 } : i))}
                          onKeyDown={handleEnterBlur}
                        />
                      </div>
                      <div>
                        <Label>Data do Estorno</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {item.data_estorno ? fmtDate(item.data_estorno) : 'Selecionar'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={item.data_estorno ? new Date(item.data_estorno + 'T12:00:00') : undefined}
                              onSelect={d => setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, data_estorno: d ? format(d, 'yyyy-MM-dd') : '' } : i))}
                              locale={ptBR}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label>Motivo</Label>
                        <Input
                          className="bg-[#FBFCFE] border-[#E2E8F1]"
                          placeholder="Motivo do estorno"
                          value={item.motivo_estorno}
                          onChange={e => setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, motivo_estorno: e.target.value } : i))}
                          onKeyDown={handleEnterBlur}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {localItems.some(i => i.valor_estornado > 0) && (
                  <div className="rm-fretetotal" style={{ color: '#d24545' }}>
                    Total Estornado: {toBRL(localItems.reduce((s, i) => s + (i.valor_estornado || 0), 0))}
                  </div>
                )}
              </div>
            </section>

            {/* ===== Fretes (UI pronta — sem persistência ainda) ===== */}
            <section className="rm-card" id="sec-fretes">
              <h2>
                <Truck className="h-4 w-4" /> Fretes <span className="rm-count">({fretes.length})</span>
                <Button size="sm" onClick={addFrete} className="rm-h2-action bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Frete
                </Button>
              </h2>
              <div className="rm-body">
                {fretes.length === 0 && (
                  <div className="rm-empty">Nenhum frete adicionado</div>
                )}
                <div className="space-y-2">
                  {fretes.map((f, idx) => (
                    <div key={f.id} className="grid grid-cols-12 gap-2 items-center rm-ditem" style={{ padding: 12 }}>
                      <span className="col-span-1 text-xs font-bold text-[#15807c]">#{idx + 1}</span>
                      <Input placeholder="Responsável / transportadora" className="col-span-4 bg-[#FBFCFE] border-[#E2E8F1]"
                        value={f.responsavel} onChange={e => updateFrete(f.id, 'responsavel', e.target.value)} onKeyDown={handleEnterBlur} />
                      <div className="col-span-3">
                        <FreteValor value={f.valor} onChange={n => updateFrete(f.id, 'valor', n)} />
                      </div>
                      <div className="col-span-3">
                        <Popover open={fretePopover === f.id} onOpenChange={o => setFretePopover(o ? f.id : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {f.data ? fmtDate(f.data) : 'Data'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single"
                              selected={f.data ? new Date(f.data + 'T12:00:00') : undefined}
                              onSelect={d => { updateFrete(f.id, 'data', d ? format(d, 'yyyy-MM-dd') : ''); setFretePopover(null); }}
                              locale={ptBR} className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Button variant="ghost" size="icon" className="col-span-1 rm-del" onClick={() => removeFrete(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                {fretes.length > 0 && (
                  <div className="rm-fretetotal">Total: {toBRL(freteTotal)}</div>
                )}
              </div>
            </section>

            <RmaStatusTimeline rmaId={rma.id} />

          </div>{/* /rm-formcol */}

          {/* ============== STICKY SUMMARY ASIDE ============== */}
          <aside className="rm-aside">
            <div className="rm-sum">
              <h3>Resumo do RMA</h3>
              <div className="rm-sumbody">
                <div className="rm-line"><span className="k">Nº RMA</span><span className="v">{rma.numero_rma}</span></div>
                <div className="rm-line"><span className="k">Pedido origem</span><span className="v">{rma.numero_os_origem ?? rma.id_pedido_origem}</span></div>
                <div className="rm-line"><span className="k">Registro</span><span className="v">{fmtDate(rma.data_registro)}</span></div>
                <div className="rm-line"><span className="k">Prazo</span><span className="v">{localPrazo ? fmtDate(localPrazo) : '—'}</span></div>
                <div className="rm-line"><span className="k">Itens</span><span className="v">{localItems.length}</span></div>
                <div className="rm-line">
                  <span className="k">Status</span>
                  <span className="v" style={{ color: stColor, fontWeight: 700 }}>{primaryStatus ? statusLabel(primaryStatus) : '—'}</span>
                </div>
                {localItems.some(i => i.valor_estornado > 0) && (
                  <div className="rm-line">
                    <span className="k">Valor Estornado</span>
                    <span className="v" style={{ color: '#d24545' }}>{toBRL(localItems.reduce((s, i) => s + (i.valor_estornado || 0), 0))}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rm-actions flex flex-col gap-2.5 print:hidden">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-12 text-[15px] font-bold text-white border-0"
                style={{ background: 'linear-gradient(135deg,#1f7a6f,#0f5d5b)', boxShadow: '0 12px 26px -12px rgba(15,93,91,.8)', borderRadius: 13 }}
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              <Button variant="outline" onClick={() => window.print()}
                className="w-full h-11" style={{ border: '1.5px solid #15807c', color: '#15807c', borderRadius: 13 }}>
                <Printer className="h-4 w-4 mr-1.5" /> Imprimir
              </Button>
              <Button variant="outline" onClick={onClose} className="w-full h-11" style={{ borderColor: '#e7ebf0', borderRadius: 13 }}>
                Cancelar
              </Button>
            </div>

            <nav className="rm-jump">
              <a href="#sec-geral">Informações Gerais</a>
              <a href="#sec-itens">Itens do RMA</a>
              <a href="#sec-devolucao">Devoluções / Estorno</a>
              <a href="#sec-fretes">Fretes</a>
            </nav>
          </aside>

        </div>{/* /rm-editor */}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Freight value (currency) input ---------- */
function FreteValor({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <Input
      placeholder="R$ 0,00"
      className="bg-[#FBFCFE] border-[#E2E8F1]"
      value={editing ? draft : toBRL(value || 0)}
      onFocus={() => { setEditing(true); setDraft(value ? String(value) : ''); }}
      onBlur={() => { onChange(parseBRL(draft) || parseFloat(draft) || 0); setEditing(false); }}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={handleEnterBlur}
    />
  );
}
