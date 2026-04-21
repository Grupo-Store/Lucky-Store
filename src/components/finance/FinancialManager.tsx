import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFinance, expandGain, expandExpense, CalendarEntry, Gain, Expense } from '@/store/FinanceStore';
import { useOrders, calcTotal, Order } from '@/store/OrderStore';
import { GainModal } from './GainModal';
import { ExpenseModal } from './ExpenseModal';
import { OrderModal } from '@/components/OrderModal';

type ViewMode = 'gains' | 'expenses' | 'all';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TYPE_STYLES: Record<CalendarEntry['type'], string> = {
  MULTA: 'bg-blue-500 text-white',
  JUROS: 'bg-green-600 text-white',
  PREVISAO: 'bg-orange-500 text-white',
  PAGO: 'bg-red-500 text-white',
  ORDER: 'bg-secondary text-secondary-foreground',
};

const TYPE_LABELS: Record<CalendarEntry['type'], string> = {
  MULTA: 'Multa',
  JUROS: 'Juros',
  PREVISAO: 'Previsão',
  PAGO: 'Pago',
  ORDER: 'Pedido',
};

export function FinancialManager() {
  const { gains, expenses, addGain, updateGain, deleteGain, addExpense, updateExpense, deleteExpense } = useFinance();
  const { orders, updateOrder, deleteOrder, nextOS } = useOrders();
  const [view, setView] = useState<ViewMode>('all');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [gainModal, setGainModal] = useState<{ open: boolean; gain: Gain | null }>({ open: false, gain: null });
  const [expModal, setExpModal] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [orderModal, setOrderModal] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });

  // Build calendar entries
  const entries = useMemo<CalendarEntry[]>(() => {
    const out: CalendarEntry[] = [];
    if (view === 'gains' || view === 'all') gains.forEach(g => out.push(...expandGain(g)));
    if (view === 'expenses' || view === 'all') expenses.forEach(e => out.push(...expandExpense(e)));
    if (view === 'all') {
      orders.filter(o => !o.isRMA && !o.cancelled && o.deliveryDate).forEach(o => {
        out.push({
          id: `o-${o.id}`,
          date: o.deliveryDate,
          value: calcTotal(o),
          type: 'ORDER',
          title: `OS ${o.os} ${o.customer}`.trim(),
          refId: o.id,
          refKind: 'order',
        });
      });
    }
    return out;
  }, [gains, expenses, orders, view]);

  // Group by date
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    entries.forEach(e => {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    });
    return m;
  }, [entries]);

  // Calendar grid
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Monthly summary
  const monthSummary = useMemo(() => {
    let receitas = 0, despesas = 0;
    entries.forEach(e => {
      const d = new Date(e.date + 'T12:00:00');
      if (!isSameMonth(d, cursor)) return;
      if (e.type === 'MULTA' || e.type === 'JUROS' || e.type === 'ORDER') receitas += e.value;
      else if (e.type === 'PAGO' || e.type === 'PREVISAO') despesas += e.value;
    });
    return { receitas, despesas, lucro: receitas - despesas };
  }, [entries, cursor]);

  const dailySummary = (iso: string) => {
    const list = byDate.get(iso) || [];
    let r = 0, d = 0;
    list.forEach(e => {
      if (e.type === 'MULTA' || e.type === 'JUROS' || e.type === 'ORDER') r += e.value;
      else d += e.value;
    });
    return { receitas: r, despesas: d, lucro: r - d };
  };

  const handleEntryClick = (e: CalendarEntry) => {
    if (e.refKind === 'gain') {
      const g = gains.find(x => x.id === e.refId);
      if (g) setGainModal({ open: true, gain: g });
    } else if (e.refKind === 'expense') {
      const ex = expenses.find(x => x.id === e.refId);
      if (ex) setExpModal({ open: true, expense: ex });
    } else if (e.refKind === 'order') {
      const o = orders.find(x => x.id === e.refId);
      if (o) setOrderModal({ open: true, order: o });
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-bold capitalize text-secondary min-w-[200px] text-center">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setCursor(new Date())}>Hoje</Button>
        </div>

        <div className="flex items-center gap-2">
          {(view === 'gains' || view === 'all') && (
            <Button onClick={() => setGainModal({ open: true, gain: null })} className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar Ganho
            </Button>
          )}
          {(view === 'expenses' || view === 'all') && (
            <Button onClick={() => setExpModal({ open: true, expense: null })} variant="secondary" className="gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar Despesa
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="gap-1.5 print:hidden">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Select value={view} onValueChange={v => setView(v as ViewMode)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gains">Ganhos Financeiros</SelectItem>
              <SelectItem value="expenses">Gastos Fixos</SelectItem>
              <SelectItem value="all">Visão Geral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receitas</p><p className="text-xl font-bold text-green-700">{BRL(monthSummary.receitas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Despesas</p><p className="text-xl font-bold text-red-600">{BRL(monthSummary.despesas)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Lucro</p><p className={cn('text-xl font-bold', monthSummary.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>{BRL(monthSummary.lucro)}</p></CardContent></Card>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="text-muted-foreground">Legenda:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Multa</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> Juros</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Previsão</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Pago</span>
        {view === 'all' && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary" /> Pedido</span>}
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-xs font-semibold text-center text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const iso = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursor);
              const isToday = isSameDay(day, new Date());
              const cellEntries = byDate.get(iso) || [];
              const sum = dailySummary(iso);

              return (
                <div
                  key={iso}
                  className={cn(
                    'min-h-[120px] border rounded p-1 flex flex-col',
                    inMonth ? 'bg-card' : 'bg-muted/40 opacity-60',
                    isToday && 'ring-2 ring-primary'
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className={cn(isToday && 'text-primary font-bold')}>{format(day, 'd')}</span>
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {cellEntries.slice(0, 3).map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleEntryClick(e)}
                        className={cn(
                          'w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate',
                          TYPE_STYLES[e.type]
                        )}
                        title={`${TYPE_LABELS[e.type]}: ${e.title} — ${BRL(e.value)}`}
                      >
                        {e.title} · {BRL(e.value)}
                      </button>
                    ))}
                    {cellEntries.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{cellEntries.length - 3} mais</div>
                    )}
                  </div>
                  {(sum.receitas > 0 || sum.despesas > 0) && (
                    <div className="mt-1 pt-1 border-t text-[9px] space-y-0.5">
                      {sum.receitas > 0 && <div className="text-green-700">R: {BRL(sum.receitas)}</div>}
                      {sum.despesas > 0 && <div className="text-red-600">D: {BRL(sum.despesas)}</div>}
                      <div className={cn('font-semibold', sum.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>L: {BRL(sum.lucro)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <GainModal
        open={gainModal.open}
        gain={gainModal.gain}
        onClose={() => setGainModal({ open: false, gain: null })}
        onSave={g => gainModal.gain ? updateGain(g) : addGain(g)}
        onDelete={deleteGain}
      />
      <ExpenseModal
        open={expModal.open}
        expense={expModal.expense}
        onClose={() => setExpModal({ open: false, expense: null })}
        onSave={e => expModal.expense ? updateExpense(e) : addExpense(e)}
        onDelete={deleteExpense}
      />
      <OrderModal
        open={orderModal.open}
        order={orderModal.order}
        onClose={() => setOrderModal({ open: false, order: null })}
        onSave={updateOrder}
        onDelete={deleteOrder}
        nextOS={nextOS}
      />
    </div>
  );
}
