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
import { Company, Seller, SELLERS } from '@/store/OrderStore';
import {
  Quote, QuoteItem, QuotePhases, QuotePhaseKey,
  QUOTE_PHASE_COLORS, QUOTE_PHASE_LABELS, emptyPhases,
} from '@/store/QuoteStore';

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
  value: 0, items: [], observations: '', phases: emptyPhases(),
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
      value={editing ? draft : toBRL(value || 0)}
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

  useEffect(() => {
    if (quote) {
      setForm({
        ...quote,
        items: quote.items ? quote.items.map(i => ({ ...i })) : [],
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

  /* ---------- Items ---------- */
  const addItem = () => set('items', [...(form.items || []), {
    id: crypto.randomUUID(), name: '', quantity: 1, quoteValue: 0, closingValue: 0, supplier: '',
  } as QuoteItem]);
  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    set('items', (form.items || []).map(i => i.id === id ? { ...i, [field]: value } : i));
  };
  const removeItem = (id: string) => set('items', (form.items || []).filter(i => i.id !== id));

  /* ---------- Derived totals (auto-calculated) ---------- */
  const items = form.items || [];
  const totalCost = items.reduce((s, i) => s + (i.quoteValue || 0) * (i.quantity || 0), 0);
  const totalRevenue = items.reduce((s, i) => s + (i.closingValue || 0) * (i.quantity || 0), 0);
  const taxLucky = form.taxLucky || 0;
  const taxBTech = form.taxBTech || 0;
  const margin = totalCost > 0 ? ((totalRevenue / totalCost) - 1) * 100 : 0;
  const grossProfit = totalRevenue - totalCost;
  const profitBTech = (totalRevenue * ((100 - taxBTech) / 100)) - totalCost;
  const profitLucky = (totalRevenue * ((100 - taxLucky) / 100)) - totalCost;

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

  const handleSave = () => {
    onSave({ ...form, id: form.id || crypto.randomUUID(), createdAt: form.createdAt || Date.now() });
    onClose();
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card print:max-w-full print:max-h-none print:shadow-none">
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
              <Input className="bg-white border-border" value={form.customer}
                onChange={e => set('customer', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input className="bg-white border-border" value={form.cnpj}
                onChange={e => set('cnpj', e.target.value)} onKeyDown={handleEnterBlur} />
            </div>
            <div>
              <Label>Nº da Requisição</Label>
              <Input className="bg-white border-border" value={form.requestNumber}
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
            {form.directBilling && (
              <div className="md:col-span-2">
                <Label>Fornecedor</Label>
                <Input className="bg-white border-border" value={form.supplier}
                  onChange={e => set('supplier', e.target.value)} onKeyDown={handleEnterBlur} />
              </div>
            )}
          </div>
        </section>

        {/* ============== 2. ITENS DA COTAÇÃO ============== */}
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
                    value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
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
                    value={item.supplier} onChange={e => updateItem(item.id, 'supplier', e.target.value)} onKeyDown={handleEnterBlur} />
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
                  <Label className="text-xs">Valor (R$)</Label>
                  <CurrencyInput
                    value={form.phases.closed.value || 0}
                    onChange={n => setPhase('closed', { value: n })}
                  />
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
            <Button onClick={handleSave} className="bg-secondary hover:bg-secondary/90">
              {isEdit ? 'Salvar Alterações' : 'Criar Cotação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
