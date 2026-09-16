import { useState } from 'react';
import { toast } from 'sonner';
import { useUpdateQuotePhase } from '@/api/hooks/useQuotes';
import { getApiError } from '@/api/client';
import type { CotacaoResponse, UpdateCotacaoFasePayload } from '@/types/api';
import { QUOTE_PHASE_COLORS, QUOTE_PHASE_LABELS, QuotePhaseKey } from '@/store/QuoteStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const phases = [
  { key: 'sent', flag: 'status_enviada', date: 'data_envio', label: 'Data de envio' },
  { key: 'forClosing', flag: 'status_em_fechamento', date: 'data_prevista_fechamento', label: 'Previsão de fechamento' },
  { key: 'closed', flag: 'status_fechada', date: 'data_fechamento', label: 'Data de fechamento' },
  { key: 'dropped', flag: 'status_caida', date: 'data_queda', label: 'Data da queda' },
] as const;

export function QuotePhaseEditor({ quote, phase }: { quote: CotacaoResponse; phase: QuotePhaseKey | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UpdateCotacaoFasePayload>({});
  const mutation = useUpdateQuotePhase(quote.id);
  function changeOpen(next: boolean) {
    if (mutation.isPending) return;
    if (next) setDraft({
      status_enviada: quote.status_enviada,
      status_em_fechamento: quote.status_em_fechamento,
      status_fechada: quote.status_fechada,
      status_caida: quote.status_caida,
      data_envio: quote.data_envio || undefined,
      data_prevista_fechamento: quote.data_prevista_fechamento || undefined,
      data_fechamento: quote.data_fechamento || undefined,
      data_queda: quote.data_queda || undefined,
      valor_fechamento: quote.valor_fechamento ?? undefined,
    });
    setOpen(next);
  }
  async function save() {
    try {
      await mutation.mutateAsync(draft);
      toast.success('Status da cotação atualizado');
      setOpen(false);
    } catch (error) { toast.error(getApiError(error)); }
  }
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`Editar status da cotação ${quote.numero ?? ''}`} className={cn('inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold', phase ? QUOTE_PHASE_COLORS[phase] : 'text-muted-foreground')}>
        {phase ? QUOTE_PHASE_LABELS[phase] : 'Sem fase'}
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-h-[80vh] overflow-y-auto whitespace-normal" onClick={event => event.stopPropagation()}>
      <h3 className="font-semibold">Status da cotação {quote.numero}</h3>
      <p className="mb-3 text-xs text-muted-foreground">As fases podem ficar ativas ao mesmo tempo.</p>
      <fieldset disabled={mutation.isPending} className="space-y-3">
        {phases.map(p => <div key={p.key} className="space-y-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft[p.flag]} onChange={event => setDraft(current => ({ ...current, [p.flag]: event.target.checked }))} />{QUOTE_PHASE_LABELS[p.key]}</label>
          {draft[p.flag] && <label className="block text-xs text-muted-foreground">{p.label}<Input type="date" value={draft[p.date] || ''} onChange={event => setDraft(current => ({ ...current, [p.date]: event.target.value || undefined }))} /></label>}
        </div>)}
        {draft.status_fechada && <label className="block text-xs text-muted-foreground">Valor de fechamento (R$)<Input type="number" min="0" step="0.01" value={draft.valor_fechamento ?? ''} onChange={event => setDraft(current => ({ ...current, valor_fechamento: event.target.value || undefined }))} /></label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => changeOpen(false)}>Cancelar</Button><Button type="button" onClick={save}>{mutation.isPending ? 'Salvando…' : 'Salvar'}</Button></div>
      </fieldset>
    </PopoverContent>
  </Popover>;
}
