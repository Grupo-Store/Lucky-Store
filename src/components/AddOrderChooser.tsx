import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, ChevronRight, FilePlus, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Quote, QuoteItem, getHighestPhase, getDisplayValue, QUOTE_PHASE_LABELS, QUOTE_PHASE_COLORS,
} from '@/store/QuoteStore';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function toBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Pre-fill data passed to the Order modal when creating from a quote. */
export interface OrderPrefill {
  customer: string;
  cnpj: string;
  company: Quote['company'];
  seller: Quote['seller'];
  salesValue: number;
  items: { id: string; name: string; quantity: number; projectedValue: number }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  quotes: Quote[];
  /** Choice 1 — start an empty order */
  onChooseNew: () => void;
  /** Choice 2 — order built from a quote */
  onChooseFromQuote: (prefill: OrderPrefill) => void;
}

type Step = 'choose' | 'pick-quote' | 'pick-items';

export function AddOrderChooser({ open, onClose, quotes, onChooseNew, onChooseFromQuote }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Quote | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Reset on open
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      setTimeout(() => { setStep('choose'); setPicked(null); setSelectedItemIds(new Set()); setSearch(''); }, 200);
    }
  };

  /** Quotes whose highest active phase is "closed" or "dropped" */
  const eligibleQuotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return quotes
      .filter(qt => {
        const h = getHighestPhase(qt);
        return h === 'closed' || h === 'dropped';
      })
      .filter(qt => !q || (
        qt.index.toLowerCase().includes(q) ||
        qt.customer.toLowerCase().includes(q) ||
        (qt.cnpj || '').toLowerCase().includes(q) ||
        (qt.company || '').toLowerCase().includes(q)
      ))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [quotes, search]);

  const startFromQuote = () => { setStep('pick-quote'); };

  const pickQuote = (qt: Quote) => {
    setPicked(qt);
    // Default: all items selected
    setSelectedItemIds(new Set((qt.items || []).map(i => i.id)));
    setStep('pick-items');
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirmFromQuote = () => {
    if (!picked) return;
    const chosen = (picked.items || []).filter(i => selectedItemIds.has(i.id));
    const prefill: OrderPrefill = {
      customer: picked.customer,
      cnpj: picked.cnpj,
      company: picked.company,
      seller: picked.seller,
      salesValue: getDisplayValue(picked),
      items: chosen.map(i => ({
        id: crypto.randomUUID(),
        name: i.name,
        quantity: i.quantity,
        projectedValue: i.closingValue || i.quoteValue || 0,
      })),
    };
    onChooseFromQuote(prefill);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-secondary text-xl flex items-center gap-2">
            {step !== 'choose' && (
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setStep(step === 'pick-items' ? 'pick-quote' : 'choose')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'choose' && 'Adicionar Pedido'}
            {step === 'pick-quote' && 'Selecionar Cotação'}
            {step === 'pick-items' && `Selecionar Itens — ${picked?.index}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4">
            <button onClick={startFromQuote}
              className="border-2 border-secondary/30 hover:border-secondary hover:bg-secondary/5 rounded-xl p-6 text-left transition-all group">
              <FileText className="h-8 w-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-secondary uppercase text-sm tracking-wide">Cadastrar a partir de cotação</h3>
              <p className="text-sm text-muted-foreground mt-2">Pré-preencha o pedido com dados de uma cotação fechada ou caída.</p>
            </button>
            <button onClick={() => { onChooseNew(); handleOpenChange(false); }}
              className="border-2 border-secondary/30 hover:border-secondary hover:bg-secondary/5 rounded-xl p-6 text-left transition-all group">
              <FilePlus className="h-8 w-8 text-secondary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-secondary uppercase text-sm tracking-wide">Cadastrar novo pedido</h3>
              <p className="text-sm text-muted-foreground mt-2">Abrir um pedido em branco e preencher manualmente.</p>
            </button>
          </div>
        )}

        {step === 'pick-quote' && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar índice, cliente, CPF/CNPJ, empresa..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="pl-9 bg-white" autoFocus />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead>Índice</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleQuotes.map(qt => {
                    const h = getHighestPhase(qt);
                    return (
                      <TableRow key={qt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => pickQuote(qt)}>
                        <TableCell className="font-medium">{qt.index}</TableCell>
                        <TableCell>{qt.customer}</TableCell>
                        <TableCell>{qt.company || '—'}</TableCell>
                        <TableCell>
                          {h && (
                            <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', QUOTE_PHASE_COLORS[h])}>
                              {QUOTE_PHASE_LABELS[h]}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{toBRL(getDisplayValue(qt))}</TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    );
                  })}
                  {eligibleQuotes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma cotação fechada ou caída disponível.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {step === 'pick-items' && picked && (
          <>
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{picked.customer}</span>
              {' · '}CPF/CNPJ: <span className="font-medium text-foreground">{picked.cnpj || '—'}</span>
              {' · '}Empresa: <span className="font-medium text-foreground">{picked.company || '—'}</span>
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead className="text-right">Valor Cotação</TableHead>
                    <TableHead className="text-right">Valor Fechamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(picked.items || []).map((it: QuoteItem) => (
                    <TableRow key={it.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleItem(it.id)}>
                      <TableCell><Checkbox checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} /></TableCell>
                      <TableCell>{it.name}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell className="text-right">{toBRL(it.quoteValue || 0)}</TableCell>
                      <TableCell className="text-right">{toBRL(it.closingValue || 0)}</TableCell>
                    </TableRow>
                  ))}
                  {(picked.items || []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Esta cotação não possui itens. Você pode prosseguir mesmo assim.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmFromQuote} className="bg-secondary hover:bg-secondary/90">
                Criar Pedido ({selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'itens'})
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
