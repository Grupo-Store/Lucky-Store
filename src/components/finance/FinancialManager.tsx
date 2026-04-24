import { useMemo, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  startOfWeek, endOfWeek, isSameMonth, isSameDay,
  startOfWeek as sow, endOfWeek as eow,
  isWithinInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Printer, CalendarDays, Table as TableIcon,
  Search, Truck, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useFinance, expandExpense, expandOrderFinancial, CalendarEntry, Expense,
} from '@/store/FinanceStore';
import { useOrders, calcTotal, Order } from '@/store/OrderStore';
import { ExpenseModal } from './ExpenseModal';
import { OrderModal } from '@/components/OrderModal';

type ViewMode = 'gains' | 'expenses' | 'all';
type Layout = 'calendar' | 'table';
type TypeFilter = 'all' | 'MULTA' | 'JUROS' | 'PREVISAO' | 'PAGO';

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

const fmtDate = (iso: string) => format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');

export function FinancialManager() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useFinance();
  const { orders, updateOrder, deleteOrder, nextOS } = useOrders();
  const [view, setView] = useState<ViewMode>('all');
  const [layout, setLayout] = useState<Layout>('calendar');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [expModal, setExpModal] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [orderModal, setOrderModal] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });

  // Macro tabs
  const [macroTab, setMacroTab] = useState<'finances' | 'fretes'>('finances');

  // Finanças table search
  const [tableSearch, setTableSearch] = useState('');
  const [tableRange, setTableRange] = useState<{ from?: Date; to?: Date }>({});
  const [tableRangeOpen, setTableRangeOpen] = useState(false);

  // Fretes filters
  const [freightPeriod, setFreightPeriod] = useState<'week' | 'month' | 'custom'>('month');
  const [freightCursor, setFreightCursor] = useState<Date>(new Date());
  const [freightRange, setFreightRange] = useState<{ from?: Date; to?: Date }>({});
  const [freightRangeOpen, setFreightRangeOpen] = useState(false);
  const [freightSearch, setFreightSearch] = useState('');
  const [freightDetail, setFreightDetail] = useState<{ open: boolean; person: string }>({ open: false, person: '' });

  // Build calendar entries from expenses + auto-derived gains from orders + standard orders (general)
  const allEntries = useMemo<CalendarEntry[]>(() => {
    const out: CalendarEntry[] = [];
    // Auto-gains from orders
    orders.filter(o => !o.isRMA && !o.cancelled).forEach(o => {
      out.push(...expandOrderFinancial(o));
    });
    expenses.forEach(e => out.push(...expandExpense(e)));
    // Visão geral: also display sales orders by deliveryDate
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
    return out;
  }, [expenses, orders]);

  const entries = useMemo(() => {
    return allEntries.filter(e => {
      if (view === 'gains' && !(e.type === 'MULTA' || e.type === 'JUROS')) return false;
      if (view === 'expenses' && !(e.type === 'PREVISAO' || e.type === 'PAGO')) return false;
      // 'all' includes ORDER type
      if (view !== 'all' && e.type === 'ORDER') return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      return true;
    });
  }, [allEntries, view, typeFilter]);

  // Group by date
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    entries.forEach(e => {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    });
    return m;
  }, [entries]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

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
    if (e.refKind === 'expense') {
      const ex = expenses.find(x => x.id === e.refId);
      if (ex) setExpModal({ open: true, expense: ex });
    } else if (e.refKind === 'order' || e.refKind === 'order-penalty' || e.refKind === 'order-interest') {
      const o = orders.find(x => x.id === e.refId);
      if (o) setOrderModal({ open: true, order: o });
    }
  };

  /* ---------- Table view ---------- */
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  // Filtered entries for the Finanças TABLE (search + date range applied)
  const tableEntries = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    return sortedEntries.filter(e => {
      if (e.type === 'ORDER') return false;
      if (tableRange.from) {
        const d = new Date(e.date + 'T12:00:00');
        const from = new Date(tableRange.from); from.setHours(0,0,0,0);
        const to = tableRange.to ? new Date(tableRange.to) : new Date(tableRange.from);
        to.setHours(23,59,59,999);
        if (!isWithinInterval(d, { start: from, end: to })) return false;
      }
      if (!q) return true;
      const exp = e.refKind === 'expense' ? expenses.find(x => x.id === e.refId) : null;
      const tipo = TYPE_LABELS[e.type].toLowerCase();
      const servico = (exp?.service || e.title || '').toLowerCase();
      const destino = (exp?.destination || '').toLowerCase();
      return tipo.includes(q) || servico.includes(q) || destino.includes(q) || e.title.toLowerCase().includes(q);
    });
  }, [sortedEntries, tableSearch, tableRange, expenses]);

  /* ---------- Fretes data ---------- */
  const freightInterval = useMemo(() => {
    if (freightPeriod === 'custom' && freightRange.from) {
      const from = new Date(freightRange.from); from.setHours(0,0,0,0);
      const to = freightRange.to ? new Date(freightRange.to) : new Date(freightRange.from);
      to.setHours(23,59,59,999);
      return { start: from, end: to };
    }
    if (freightPeriod === 'week') {
      return { start: sow(freightCursor, { weekStartsOn: 0 }), end: eow(freightCursor, { weekStartsOn: 0 }) };
    }
    return { start: startOfMonth(freightCursor), end: endOfMonth(freightCursor) };
  }, [freightPeriod, freightCursor, freightRange]);

  // Flatten all freight cards from all orders (non-cancelled) within the freight interval
  type FreightRow = {
    orderId: string; os: string; customer: string; date: string; deliveryPerson: string; value: number;
  };
  const freightRows = useMemo<FreightRow[]>(() => {
    const out: FreightRow[] = [];
    orders.filter(o => !o.cancelled).forEach(o => {
      const cards = [...(o.freight || []), ...(o.rmaFreight || [])];
      cards.forEach(c => {
        if (!c.deliveryPerson) return;
        const dateIso = c.deliveryDate || o.deliveryDate;
        if (!dateIso) return;
        const d = new Date(dateIso + 'T12:00:00');
        if (!isWithinInterval(d, freightInterval)) return;
        out.push({
          orderId: o.id, os: o.os, customer: o.customer,
          date: dateIso, deliveryPerson: c.deliveryPerson, value: c.value || 0,
        });
      });
    });
    return out;
  }, [orders, freightInterval]);

  const freightAggregated = useMemo(() => {
    const q = freightSearch.toLowerCase().trim();
    const map = new Map<string, { person: string; total: number; count: number }>();
    freightRows.forEach(r => {
      if (q && !r.deliveryPerson.toLowerCase().includes(q)) return;
      const cur = map.get(r.deliveryPerson) || { person: r.deliveryPerson, total: 0, count: 0 };
      cur.total += r.value; cur.count += 1;
      map.set(r.deliveryPerson, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [freightRows, freightSearch]);

  const freightDetailRows = useMemo(
    () => freightRows.filter(r => r.deliveryPerson === freightDetail.person).sort((a, b) => b.date.localeCompare(a.date)),
    [freightRows, freightDetail.person]
  );

  return (
    <div className="space-y-4">
      <Tabs value={macroTab} onValueChange={(v) => setMacroTab(v as 'finances' | 'fretes')}>
        <TabsList className="bg-card mb-2">
          <TabsTrigger value="finances" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground gap-1.5">
            <CalendarDays className="h-4 w-4" /> Finanças
          </TabsTrigger>
          <TabsTrigger value="fretes" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground gap-1.5">
            <Truck className="h-4 w-4" /> Fretes
          </TabsTrigger>
        </TabsList>

        {/* ============ FINANÇAS ============ */}
        <TabsContent value="finances" className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {layout === 'calendar' && (
                <>
                  <Button variant="outline" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <h2 className="text-xl font-bold capitalize text-secondary min-w-[200px] text-center">
                    {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
                  </h2>
                  <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="ghost" onClick={() => setCursor(new Date())}>Hoje</Button>
                </>
              )}
              {layout === 'table' && (
                <h2 className="text-xl font-bold text-secondary">Lançamentos Financeiros</h2>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(view === 'expenses' || view === 'all') && (
                <Button onClick={() => setExpModal({ open: true, expense: null })} variant="secondary" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Adicionar Despesa
                </Button>
              )}
              <div className="flex bg-muted rounded-md p-0.5">
                <button
                  onClick={() => setLayout('calendar')}
                  className={cn('px-3 py-1.5 text-sm rounded flex items-center gap-1.5',
                    layout === 'calendar' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}
                >
                  <CalendarDays className="h-4 w-4" /> Calendário
                </button>
                <button
                  onClick={() => setLayout('table')}
                  className={cn('px-3 py-1.5 text-sm rounded flex items-center gap-1.5',
                    layout === 'table' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}
                >
                  <TableIcon className="h-4 w-4" /> Tabela
                </button>
              </div>
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
          {layout === 'calendar' && (
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Receitas</p><p className="text-xl font-bold text-green-700">{BRL(monthSummary.receitas)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Despesas</p><p className="text-xl font-bold text-red-600">{BRL(monthSummary.despesas)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Lucro</p><p className={cn('text-xl font-bold', monthSummary.lucro >= 0 ? 'text-green-700' : 'text-red-600')}>{BRL(monthSummary.lucro)}</p></CardContent></Card>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-muted-foreground">Legenda:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Multa</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> Juros</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> Previsão</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Pago</span>
            {view === 'all' && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary" /> Pedido</span>}
          </div>

          {/* CALENDAR */}
          {layout === 'calendar' && (
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
          )}

          {/* TABLE */}
          {layout === 'table' && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* Search bar: Tipo, Serviço, Destino, Data */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por Tipo, Serviço ou Destino..."
                      value={tableSearch}
                      onChange={e => setTableSearch(e.target.value)}
                      className="pl-9 bg-white"
                    />
                  </div>
                  <Popover open={tableRangeOpen} onOpenChange={setTableRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start font-normal min-w-[230px]">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {tableRange.from && tableRange.to
                          ? `${format(tableRange.from, 'dd/MM')} – ${format(tableRange.to, 'dd/MM/yy')}`
                          : tableRange.from
                            ? format(tableRange.from, 'dd/MM/yyyy')
                            : 'Período (data)'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range"
                        selected={{ from: tableRange.from, to: tableRange.to }}
                        onSelect={(r: any) => setTableRange({ from: r?.from, to: r?.to })}
                        locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {(tableSearch || tableRange.from) && (
                    <Button variant="ghost" size="icon" onClick={() => { setTableSearch(''); setTableRange({}); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium">Filtrar tipo:</span>
                  {(['all', 'MULTA', 'JUROS', 'PREVISAO', 'PAGO'] as TypeFilter[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border',
                        typeFilter === t ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-card text-muted-foreground'
                      )}
                    >
                      {t === 'all' ? 'Todos' : TYPE_LABELS[t as CalendarEntry['type']]}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead>Tipo</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableEntries.map(e => {
                        const status = e.type === 'PAGO' ? 'Pago'
                          : e.type === 'PREVISAO' ? 'Previsto'
                          : e.type === 'MULTA' ? 'Multa Recebida'
                          : 'Juros Recebidos';
                        const exp = e.refKind === 'expense' ? expenses.find(x => x.id === e.refId) : null;
                        return (
                          <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEntryClick(e)}>
                            <TableCell>
                              <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', TYPE_STYLES[e.type])}>
                                {TYPE_LABELS[e.type]}
                              </span>
                            </TableCell>
                            <TableCell>{exp?.service || e.title}</TableCell>
                            <TableCell>{exp?.destination || '—'}</TableCell>
                            <TableCell>{fmtDate(e.date)}</TableCell>
                            <TableCell className="text-right font-semibold">{BRL(e.value)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{status}</TableCell>
                          </TableRow>
                        );
                      })}
                      {tableEntries.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ FRETES ============ */}
        <TabsContent value="fretes" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3 justify-between">
                <div className="flex items-end gap-2 flex-wrap">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Período</label>
                    <Select value={freightPeriod} onValueChange={v => setFreightPeriod(v as 'week' | 'month' | 'custom')}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Semana</SelectItem>
                        <SelectItem value="month">Mês</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {freightPeriod !== 'custom' && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon"
                        onClick={() => setFreightCursor(freightPeriod === 'week'
                          ? new Date(freightCursor.getTime() - 7 * 86400000)
                          : subMonths(freightCursor, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium min-w-[180px] text-center">
                        {freightPeriod === 'week'
                          ? `${format(freightInterval.start, 'dd/MM')} – ${format(freightInterval.end, 'dd/MM/yy')}`
                          : format(freightCursor, "MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                      <Button variant="outline" size="icon"
                        onClick={() => setFreightCursor(freightPeriod === 'week'
                          ? new Date(freightCursor.getTime() + 7 * 86400000)
                          : addMonths(freightCursor, 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setFreightCursor(new Date())}>Hoje</Button>
                    </div>
                  )}

                  {freightPeriod === 'custom' && (
                    <Popover open={freightRangeOpen} onOpenChange={setFreightRangeOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start font-normal min-w-[230px]">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {freightRange.from && freightRange.to
                            ? `${format(freightRange.from, 'dd/MM')} – ${format(freightRange.to, 'dd/MM/yy')}`
                            : 'Selecionar período'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="range"
                          selected={{ from: freightRange.from, to: freightRange.to }}
                          onSelect={(r: any) => setFreightRange({ from: r?.from, to: r?.to })}
                          locale={ptBR} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar entregador..."
                    value={freightSearch}
                    onChange={e => setFreightSearch(e.target.value)}
                    className="pl-9 w-72 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total de Entregas</p><p className="text-xl font-bold text-secondary">{freightRows.length}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Entregadores Ativos</p><p className="text-xl font-bold text-secondary">{freightAggregated.length}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Valor Total</p><p className="text-xl font-bold text-green-700">{BRL(freightAggregated.reduce((s, r) => s + r.total, 0))}</p></CardContent></Card>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead>Entregador</TableHead>
                      <TableHead className="text-right">Qtd. Entregas</TableHead>
                      <TableHead className="text-right">Soma dos Valores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freightAggregated.map(row => (
                      <TableRow key={row.person} className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setFreightDetail({ open: true, person: row.person })}>
                        <TableCell className="font-medium">{row.person}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">{BRL(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    {freightAggregated.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum frete encontrado no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detail modal */}
          <Dialog open={freightDetail.open} onOpenChange={(o) => setFreightDetail(s => ({ ...s, open: o }))}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Entregas — {freightDetail.person}</DialogTitle>
              </DialogHeader>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead>Data</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freightDetailRows.map((r, i) => {
                      const ord = orders.find(o => o.id === r.orderId);
                      return (
                        <TableRow key={i} className="cursor-pointer hover:bg-muted/50"
                          onClick={() => { if (ord) { setFreightDetail({ open: false, person: '' }); setOrderModal({ open: true, order: ord }); } }}>
                          <TableCell>{fmtDate(r.date)}</TableCell>
                          <TableCell className="font-medium">{r.os}</TableCell>
                          <TableCell>{r.customer}</TableCell>
                          <TableCell className="text-right font-semibold">{BRL(r.value)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {freightDetailRows.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem entregas no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-2 text-sm text-muted-foreground">
                Total: <span className="ml-2 font-semibold text-green-700">{BRL(freightDetailRows.reduce((s, r) => s + r.value, 0))}</span>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

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

