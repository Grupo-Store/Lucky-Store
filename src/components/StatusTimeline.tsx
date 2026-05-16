import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderHistory } from '@/api/hooks/useOrders';
import { ORDER_STATUS_LABELS } from '@/store/OrderStore';
import type { OrderStatus } from '@/store/OrderStore';
import type { StatusHistoryEntry } from '@/types/api';

function formatDateTime(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function resolveStatus(raw: string | null): string {
  if (!raw) return '';
  return ORDER_STATUS_LABELS[raw as OrderStatus] ?? raw;
}

function TimelineEntry({ entry, isLast }: { entry: StatusHistoryEntry; isLast: boolean }) {
  const isCreation = entry.old_status === null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="h-2.5 w-2.5 rounded-full bg-secondary mt-1" />
        {!isLast && <div className="w-px flex-1 bg-border min-h-[1rem] mt-1" />}
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {isCreation ? (
            <span>Pedido criado</span>
          ) : (
            <>
              <span className="text-muted-foreground">{resolveStatus(entry.old_status)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{resolveStatus(entry.new_status)}</span>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatDateTime(entry.changed_at)}
          <span className="mx-1">·</span>
          <span>por {entry.changed_by.slice(0, 8)}</span>
        </div>
        {entry.reason && (
          <p className="text-xs italic text-muted-foreground mt-1">{entry.reason}</p>
        )}
      </div>
    </div>
  );
}

interface StatusTimelineProps {
  pedidoId: string;
}

export function StatusTimeline({ pedidoId }: StatusTimelineProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useOrderHistory(pedidoId, open);

  // Show most recent first
  const entries = data?.status_history ? [...data.status_history].reverse() : [];

  return (
    <section className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-secondary uppercase tracking-wide flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Status
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(v => !v)} className="h-7 px-2 text-xs">
          {open ? (
            <>Fechar <ChevronUp className="h-3.5 w-3.5 ml-1" /></>
          ) : (
            <>Ver histórico <ChevronDown className="h-3.5 w-3.5 ml-1" /></>
          )}
        </Button>
      </div>

      {open && (
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !entries.length ? (
            <p className="text-sm text-muted-foreground">Nenhum histórico encontrado.</p>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <TimelineEntry key={entry.id} entry={entry} isLast={i === entries.length - 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
