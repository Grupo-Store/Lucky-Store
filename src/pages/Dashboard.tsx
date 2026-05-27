import { useState, useMemo } from 'react';
import { useDashboardKpis } from '@/hooks/use-dashboard-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Target, Pencil, CalendarIcon } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format, getMonth, getYear, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isAfter, subYears } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useOrders, calcTotal, calcFinalCost, calcProfit, Order, SELLERS, calcFreightTotal } from '@/store/OrderStore';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoals, useUpsertGoal, useDeleteGoal, type ApiGoal, LOJA_ID, LOJA_NAME } from '@/api/hooks/useDashboard';
import { useVendedores } from '@/hooks/useVendedores';
import { useFinance, Goal, GoalScopeType, goalKey, expandExpense } from '@/store/FinanceStore';
import { useQuotes } from '@/store/QuoteStore';
import { useDashboardFilters } from '@/store/DashboardFilterStore';
import { Checkbox } from '@/components/ui/checkbox';
import {
  remainingBusinessDaysInMonth, elapsedBusinessDaysInMonth,
} from '@/lib/holidays';

type CompanyKey = 'all' | 'Lucky Store' | 'BTech' | 'AJJ';
const COMPANIES: CompanyKey[] = ['all', 'Lucky Store', 'BTech', 'AJJ'];

type SectionKey = 'geral' | 'vendas' | 'ticket' | 'meta';
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'geral', label: 'GERAL' },
  { key: 'vendas', label: 'VENDAS' },
  { key: 'ticket', label: 'TICKET' },
  { key: 'meta', label: 'META' },
];

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function remainingBusinessDays(year: number, month: number): number {
  return remainingBusinessDaysInMonth(year, month);
}
function elapsedBusinessDays(year: number, month: number): number {
  return elapsedBusinessDaysInMonth(year, month);
}

interface FilterCriteria {
  year: number;
  month: number;
  rangeFrom?: Date;
  rangeTo?: Date;
  company: CompanyKey;
}

function applyFilters(orders: Order[], f: FilterCriteria): Order[] {
  return orders.filter(o => {
    if (o.cancelled || o.isRMA) return false;
    if (!o.orderDate) return false;
    const d = new Date(o.orderDate + 'T12:00:00');
    if (f.rangeFrom && f.rangeTo) {
      if (isBefore(d, f.rangeFrom) || isAfter(d, f.rangeTo)) return false;
    } else {
      if (getYear(d) !== f.year) return false;
      if (getMonth(d) !== f.month) return false;
    }
    if (f.company !== 'all' && o.company !== f.company) return false;
    return true;
  });
}

function computeStats(orders: Order[], all: Order[], f: FilterCriteria, goal?: { target: number; floor: number }) {
  const revenue = orders.reduce((s, o) => s + calcTotal(o), 0);
  const cost = orders.reduce((s, o) => s + calcFinalCost(o), 0);
  const profit = orders.reduce((s, o) => s + calcProfit(o), 0);
  const margin = revenue > 0 ? profit / revenue : 0;
  const salesCount = orders.length;
  const ticketSale = salesCount > 0 ? revenue / salesCount : 0;
  const ticketProfit = salesCount > 0 ? profit / salesCount : 0;
  const avgPurchase = salesCount > 0 ? cost / salesCount : 0;

  const cancellations = all.filter(o => {
    if (!o.cancelled || o.isRMA) return false;
    if (!o.orderDate) return false;
    const d = new Date(o.orderDate + 'T12:00:00');
    if (f.rangeFrom && f.rangeTo) {
      if (isBefore(d, f.rangeFrom) || isAfter(d, f.rangeTo)) return false;
    } else {
      if (getYear(d) !== f.year || getMonth(d) !== f.month) return false;
    }
    if (f.company !== 'all' && o.company !== f.company) return false;
    return true;
  });
  const cancCount = cancellations.length;
  const cancValue = cancellations.reduce((s, o) => s + calcTotal(o), 0);

  const today = new Date();
  const todayRevenue = orders.filter(o => o.orderDate === format(today, 'yyyy-MM-dd')).reduce((s, o) => s + calcTotal(o), 0);

  const target = goal?.target || 0;
  const floor = goal?.floor || 0;
  const pctTarget = target > 0 ? revenue / target : 0;
  const gap = Math.max(0, target - revenue);
  const gapFloor = Math.max(0, floor - revenue);
  const elapsed = elapsedBusinessDays(f.year, f.month);
  const remaining = remainingBusinessDays(f.year, f.month);
  const dailyAvg = elapsed > 0 ? revenue / elapsed : 0;
  const projection = elapsed > 0 ? dailyAvg * (elapsed + remaining) : revenue;
  const dailyTarget = remaining > 0 && floor > 0 ? gapFloor / remaining : 0;
  const efficiency = dailyAvg - dailyTarget;

  const purchaseTax = orders.reduce((s, o) => s + (o.purchaseTaxValue || 0), 0);
  const salesTax = orders.reduce((s, o) => s + (o.salesTaxValue || 0), 0);
  const totalTax = purchaseTax + salesTax;
  const otherCost = cost - totalTax;
  const salesTaxPct = revenue > 0 ? salesTax / revenue : 0;

  const productCost = orders.reduce((s, o) => s + (o.finalProductCost || 0), 0);
  const boletoCost = orders.reduce((s, o) => s + (o.boletoCost || 0), 0);
  const giftCost = orders.reduce((s, o) => s + (o.giftCost || 0), 0);
  const creditCost = orders.reduce((s, o) => s + (o.creditCostValue || 0), 0);
  const debitCost = orders.reduce((s, o) => s + (o.debitCostValue || 0), 0);
  const freightCost = orders.reduce((s, o) => s + calcFreightTotal(o.freight), 0);

  return {
    revenue, cost, profit, margin, salesCount, ticketSale, ticketProfit, avgPurchase,
    cancCount, cancValue, todayRevenue,
    target, floor, pctTarget, gap, gapFloor, projection, dailyTarget, dailyAvg, efficiency,
    elapsed, remaining,
    totalTax, otherCost, salesTax, purchaseTax, salesTaxPct,
    productCost, boletoCost, giftCost, creditCost, debitCost, freightCost,
  };
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', accent || 'text-secondary')}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function GoalsModal({
  open, onClose, year, month,
}: {
  open: boolean; onClose: () => void;
  year: number; month: number;
}) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month + 1);
  const defaultLojaId = LOJA_ID['Lucky Store'] ?? Object.values(LOJA_ID)[0] ?? '';
  const [idLoja, setIdLoja] = useState<string>(defaultLojaId);
  const [target, setTarget] = useState<number>(0);
  const [floor, setFloor] = useState<number>(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: goals = [], isLoading } = useGoals({ ano: y, mes: m });
  const { mutate: upsert, isPending: saving } = useUpsertGoal();
  const { mutate: removeGoal } = useDeleteGoal();

  const { data: vendedoresData } = useVendedores();
  const goalSellerNames = vendedoresData?.items.map(v => v.nome) ?? SELLERS;

  const companyOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Geral (todas as empresas)' },
    { value: 'Lucky Store', label: 'Lucky Store' },
    { value: 'BTech', label: 'BTech' },
    { value: 'AJJ', label: 'AJJ' },
  ];
  const sellerOptions = goalSellerNames.map(s => ({ value: s, label: s }));
  const scopeOptions = scopeType === 'company' ? companyOptions : sellerOptions;

  const onScopeTypeChange = (v: GoalScopeType) => {
    setScopeType(v);
    setScopeId(v === 'company' ? 'all' : (goalSellerNames[0] ?? ''));
  };


  const resetForm = () => {
    setTarget(0); setFloor(0); setEditingId(null);
  };

  const save = () => {
    upsert({ ano: y, mes: m, id_loja: idLoja, target, floor }, { onSuccess: resetForm });
  };

  const loadForEdit = (g: ApiGoal) => {
    setY(g.ano);
    setM(g.mes);
    setIdLoja(String(g.id_loja));
    setTarget(g.target);
    setFloor(g.floor);
    setEditingId(g.id);
  };

  const lojaLabel = (id: string) => LOJA_NAME[id] ?? id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Meta' : 'Configurar Metas'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Empresa</Label>
              <Select value={idLoja} onValueChange={setIdLoja}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companyOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(m)} onValueChange={v => setM(+v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((nm, i) => <SelectItem key={i} value={String(i + 1)}>{nm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={y} onChange={e => setY(+e.target.value || y)} />
            </div>
            <div>
              <Label>Valor Meta (R$)</Label>
              <Input type="number" value={target || ''} onChange={e => setTarget(+e.target.value || 0)} />
            </div>
            <div>
              <Label>Piso da Meta (R$)</Label>
              <Input type="number" value={floor || ''} onChange={e => setFloor(+e.target.value || 0)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1">
              {editingId ? 'Atualizar Meta' : 'Salvar Meta'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>Cancelar Edição</Button>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Metas registradas</h4>
            <p className="text-xs text-muted-foreground mb-2">Clique em uma meta para editá-la.</p>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada para este período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Piso</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map(g => (
                    <TableRow
                      key={g.id}
                      className={cn('cursor-pointer hover:bg-muted/50', editingId === g.id && 'bg-secondary/10')}
                      onClick={() => loadForEdit(g)}
                    >
                      <TableCell>{MONTHS[g.mes - 1]}/{g.ano}</TableCell>
                      <TableCell>{lojaLabel(g.id_loja)}</TableCell>
                      <TableCell>{BRL(g.target)}</TableCell>
                      <TableCell>{BRL(g.floor)}</TableCell>
                      <TableCell className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => loadForEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          removeGoal(g.id);
                          if (editingId === g.id) resetForm();
                        }}>Excluir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { orders } = useOrders();
  const { data: vendedoresData } = useVendedores();
  const sellerNames = vendedoresData?.items.map(v => v.nome) ?? SELLERS;
  const { goals, upsertGoal, deleteGoal, expenses } = useFinance();
  const { quotes } = useQuotes();
  const { filters: globalFilters, setFilters: setGlobalFilters, mode, section } = useDashboardFilters();
  const { data: apiKpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: apiGoals = [] } = useGoals({ ano: globalFilters.year, mes: globalFilters.month + 1 });

  // Local: company sub-filter
  const [company, setCompany] = useState<CompanyKey>('all');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateTab, setDateTab] = useState<'data' | 'periodo'>('data');

  // Toggleable historical metrics
  const [showCost, setShowCost] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showPrevYear, setShowPrevYear] = useState(true);

  const filters: FilterCriteria = useMemo(() => ({
    year: globalFilters.year,
    month: globalFilters.month,
    rangeFrom: globalFilters.rangeFrom,
    rangeTo: globalFilters.rangeTo,
    company,
  }), [globalFilters, company]);

  const filtered = useMemo(() => applyFilters(orders, filters), [orders, filters]);

  const goal = useMemo(
    () => apiGoals.find(g => String(g.id_loja) === LOJA_ID[filters.company]),
    [apiGoals, filters.company]
  );
  const stats = useMemo(() => computeStats(filtered, orders, filters, goal), [filtered, orders, filters, goal]);

  const perSeller = useMemo(() => {
    return sellerNames.map(seller => {
      const list = filtered.filter(o => o.seller === seller);
      const s = computeStats(list, orders, filters);
      return { seller, ...s };
    });
  }, [filtered, orders, filters, goals, sellerNames]);

  const quotesCount = useMemo(() => {
    return quotes.filter(q => {
      if (!q.requestDate) return false;
      const d = new Date(q.requestDate + 'T12:00:00');
      if (filters.rangeFrom && filters.rangeTo) {
        if (isBefore(d, filters.rangeFrom) || isAfter(d, filters.rangeTo)) return false;
      } else {
        if (getYear(d) !== filters.year || getMonth(d) !== filters.month) return false;
      }
      if (filters.company !== 'all' && q.company !== filters.company) return false;
      return true;
    }).length;
  }, [quotes, filters]);

  const financialGains = useMemo(() => {
    return filtered.reduce((s, o) => s + (o.penaltyValue || 0) + (o.interestValue || 0), 0);
  }, [filtered]);

  const fixedExpenses = useMemo(() => {
    let total = 0;
    expenses.forEach(e => {
      expandExpense(e).forEach(entry => {
        if (!entry.date) return;
        const d = new Date(entry.date + 'T12:00:00');
        if (filters.rangeFrom && filters.rangeTo) {
          if (isBefore(d, filters.rangeFrom) || isAfter(d, filters.rangeTo)) return;
        } else {
          if (getYear(d) !== filters.year || getMonth(d) !== filters.month) return;
        }
        total += entry.value;
      });
    });
    return total;
  }, [expenses, filters]);

  const grossProfit = stats.profit;
  const netProfit = grossProfit + financialGains - fixedExpenses;

  const dailySeries = useMemo(() => {
    const useRange = filters.rangeFrom && filters.rangeTo;
    const start = useRange ? filters.rangeFrom! : startOfMonth(new Date(filters.year, filters.month, 1));
    const end = useRange ? filters.rangeTo! : endOfMonth(new Date(filters.year, filters.month, 1));
    const days = eachDayOfInterval({ start, end });

    const prevStart = subYears(start, 1);
    const prevEnd = subYears(end, 1);
    const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });

    const sumForDay = (list: Order[], iso: string, kind: 'revenue' | 'cost' | 'profit') => {
      let total = 0;
      list.forEach(o => {
        if (o.cancelled || o.isRMA) return;
        if (o.orderDate !== iso) return;
        if (filters.company !== 'all' && o.company !== filters.company) return;
        if (kind === 'revenue') total += calcTotal(o);
        else if (kind === 'cost') total += calcFinalCost(o);
        else total += calcProfit(o);
      });
      return total;
    };

    return days.map((d, idx) => {
      const isoStr = format(d, 'yyyy-MM-dd');
      const prevIso = prevDays[idx] ? format(prevDays[idx], 'yyyy-MM-dd') : null;
      return {
        day: format(d, 'dd/MM'),
        Custo: sumForDay(orders, isoStr, 'cost'),
        Faturamento: sumForDay(orders, isoStr, 'revenue'),
        Lucro: sumForDay(orders, isoStr, 'profit'),
        AnoAnterior: prevIso ? sumForDay(orders, prevIso, 'revenue') : 0,
      };
    });
  }, [orders, filters]);

  const costCompositionData = [
    { name: 'Produtos', value: stats.productCost },
    { name: 'Frete', value: stats.freightCost },
    { name: 'Impostos', value: stats.totalTax },
    { name: 'Cartão Crédito', value: stats.creditCost },
    { name: 'Cartão Débito', value: stats.debitCost },
    { name: 'Boleto', value: stats.boletoCost },
    { name: 'Brindes', value: stats.giftCost },
  ].filter(d => d.value > 0);

  const ticketData = [
    { name: 'Custo', value: stats.avgPurchase },
    { name: 'Venda', value: stats.ticketSale },
    { name: 'Lucro', value: stats.ticketProfit },
  ];

  const taxByCompanyData = useMemo(() => {
    return ['Lucky Store', 'BTech', 'AJJ'].map(c => {
      const list = filtered.filter(o => o.company === c);
      const rev = list.reduce((s, o) => s + calcTotal(o), 0);
      const tax = list.reduce((s, o) => s + (o.salesTaxValue || 0), 0);
      return { name: c, pct: rev > 0 ? (tax / rev) * 100 : 0, valor: tax };
    });
  }, [filtered]);

  /* ---------- Reusable chart cards ---------- */
  const CostPieCard = (
    <Card>
      <CardHeader><CardTitle className="text-secondary">Custo Total — Composição</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={costCompositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={(e: any) => `${e.name}: ${BRL(e.value)}`}>
              {costCompositionData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const TicketBarCard = (
    <Card>
      <CardHeader><CardTitle className="text-secondary">Ticket Médio — Comparativo</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ticketData}>
            <XAxis dataKey="name" /><YAxis />
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Bar dataKey="value" fill="hsl(192, 76%, 29%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const HistoricalLineCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-secondary">Análise Histórica — Diário</CardTitle>
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showCost} onCheckedChange={(v) => setShowCost(!!v)} /> Custo</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showRevenue} onCheckedChange={(v) => setShowRevenue(!!v)} /> Faturamento</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showProfit} onCheckedChange={(v) => setShowProfit(!!v)} /> Lucro</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><Checkbox checked={showPrevYear} onCheckedChange={(v) => setShowPrevYear(!!v)} /> Ano Anterior (Fat.)</label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={dailySeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis tickFormatter={(v: number) => v.toLocaleString('pt-BR', { notation: 'compact' })} />
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Legend />
            {stats.floor > 0 && (
              <ReferenceLine y={stats.floor} stroke="hsl(0, 70%, 60%)" strokeDasharray="6 4"
                label={{ value: `Piso: ${BRL(stats.floor)}`, position: 'insideTopRight', fill: 'hsl(0, 70%, 40%)', fontSize: 11 }} />
            )}
            {stats.target > 0 && (
              <ReferenceLine y={stats.target} stroke="hsl(35, 90%, 45%)" strokeDasharray="6 4"
                label={{ value: `Alvo: ${BRL(stats.target)}`, position: 'insideTopRight', fill: 'hsl(35, 90%, 35%)', fontSize: 11 }} />
            )}
            {showCost && <Line type="monotone" dataKey="Custo" stroke="hsl(0, 70%, 50%)" strokeWidth={2} dot={false} />}
            {showRevenue && <Line type="monotone" dataKey="Faturamento" stroke="hsl(192, 76%, 29%)" strokeWidth={2} dot={false} />}
            {showProfit && <Line type="monotone" dataKey="Lucro" stroke="hsl(140, 70%, 40%)" strokeWidth={2} dot={false} />}
            {showPrevYear && <Line type="monotone" dataKey="AnoAnterior" stroke="hsl(220, 15%, 55%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Fat. Ano Anterior" />}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  const TaxByCompanyCard = (
    <Card>
      <CardHeader><CardTitle className="text-secondary">Imposto de Venda (%) por Empresa</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={taxByCompanyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(v: number, key: string) => key === 'pct' ? `${v.toFixed(2)}%` : BRL(v)} />
            <Legend />
            <Bar dataKey="pct" name="% Imposto / Faturamento" fill="hsl(35, 90%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
      ) : apiKpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total de Pedidos" value={String(apiKpis.num_pedidos ?? 0)} />
          <KpiCard label="Cancelamentos" value={String(apiKpis.num_cancelamentos ?? 0)} accent="text-orange-600" />
          <KpiCard label="Faturamento do Mês" value={BRL(apiKpis.receita ?? 0)} accent="text-green-700" />
          <KpiCard label="Ticket Médio" value={BRL(apiKpis.ticket_venda ?? 0)} />
        </div>
      ) : null}

      {mode === 'company' && (
        <>
          {/* Sub-header: Date filter (left) + Centered company pill tabs + Goals btn (right) */}
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="shrink-0">
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {globalFilters.rangeFrom && globalFilters.rangeTo
                      ? `${format(globalFilters.rangeFrom, 'dd/MM/yy')} – ${format(globalFilters.rangeTo, 'dd/MM/yy')}`
                      : `${MONTHS[globalFilters.month]}/${globalFilters.year}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex border-b">
                    <button
                      onClick={() => setDateTab('data')}
                      className={cn('flex-1 px-4 py-2 text-sm font-semibold transition',
                        dateTab === 'data' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                      Data
                    </button>
                    <button
                      onClick={() => setDateTab('periodo')}
                      className={cn('flex-1 px-4 py-2 text-sm font-semibold transition',
                        dateTab === 'periodo' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                      Período
                    </button>
                  </div>
                  {dateTab === 'data' ? (
                    <div className="p-4 space-y-3 w-[280px]">
                      <div>
                        <Label className="text-xs">Mês</Label>
                        <Select
                          value={String(globalFilters.month)}
                          onValueChange={v => setGlobalFilters(f => ({ ...f, month: +v, rangeFrom: undefined, rangeTo: undefined }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Ano</Label>
                        <Input
                          type="number"
                          value={globalFilters.year}
                          onChange={e => setGlobalFilters(f => ({ ...f, year: +e.target.value || f.year, rangeFrom: undefined, rangeTo: undefined }))}
                        />
                      </div>
                      <Button className="w-full" size="sm" onClick={() => setDateOpen(false)}>Aplicar</Button>
                    </div>
                  ) : (
                    <div>
                      <Calendar
                        mode="range"
                        selected={{ from: globalFilters.rangeFrom, to: globalFilters.rangeTo }}
                        onSelect={(r: any) => setGlobalFilters(f => ({ ...f, rangeFrom: r?.from, rangeTo: r?.to }))}
                        locale={ptBR}
                        numberOfMonths={2}
                        className="p-3 pointer-events-auto"
                      />
                      <div className="p-2 border-t flex justify-between">
                        <Button size="sm" variant="ghost" onClick={() => setGlobalFilters(f => ({ ...f, rangeFrom: undefined, rangeTo: undefined }))}>Limpar</Button>
                        <Button size="sm" onClick={() => setDateOpen(false)}>Aplicar</Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="order-3 lg:order-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 mx-auto">
              <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
                {COMPANIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCompany(c)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all',
                      company === c
                        ? 'bg-secondary text-secondary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {c === 'all' ? 'Geral' : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-2 lg:order-3 shrink-0">
              <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
                <Target className="h-4 w-4" /> Configurar Metas
              </Button>
            </div>
          </div>

          {/* ===== GERAL ===== */}
          {section === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Custo Total" value={BRL(stats.cost)} accent="text-red-600" />
                <KpiCard label="Faturamento Total" value={BRL(stats.revenue)} sub={`Hoje: ${BRL(stats.todayRevenue)}`} accent="text-green-700" />
                <KpiCard label="Lucro Bruto" value={BRL(grossProfit)} sub="Fat. − Custo" accent={grossProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
                <KpiCard label="Ganhos Financeiros" value={BRL(financialGains)} sub="Multas + Juros" accent="text-blue-700" />
                <KpiCard label="Gastos Fixos" value={BRL(fixedExpenses)} sub="Despesas registradas" accent="text-orange-600" />
                <KpiCard label="Lucro Líquido" value={BRL(netProfit)} sub="Bruto + Ganhos − Fixos" accent={netProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>

              {CostPieCard}
              {HistoricalLineCard}
            </div>
          )}

          {/* ===== VENDAS ===== */}
          {section === 'vendas' && (
            <div className="space-y-4">
              <div className={cn('grid grid-cols-2 md:grid-cols-3 gap-3',
                company !== 'all' ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
                <KpiCard label="Quantidade de Vendas" value={String(stats.salesCount)} />
                <KpiCard label="Margem por Venda" value={PCT(stats.margin)} />
                <KpiCard label="Quantidade de Cotações" value={String(quotesCount)} />
                <KpiCard label="Cancelamentos" value={String(stats.cancCount)} sub={`Perda: ${BRL(stats.cancValue)}`} accent="text-red-600" />
                {company !== 'all' && (
                  <KpiCard label="% Imposto de Venda" value={PCT(stats.salesTaxPct)} sub={`Total: ${BRL(stats.salesTax)}`} accent="text-orange-600" />
                )}
              </div>
              {company === 'all' && TaxByCompanyCard}
            </div>
          )}

          {/* ===== TICKET ===== */}
          {section === 'ticket' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <KpiCard label="Ticket Médio de Custo" value={BRL(stats.avgPurchase)} accent="text-red-600" />
                <KpiCard label="Ticket Médio de Vendas" value={BRL(stats.ticketSale)} accent="text-green-700" />
                <KpiCard label="Ticket Médio de Lucro" value={BRL(stats.ticketProfit)} accent={stats.ticketProfit >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>
              {TicketBarCard}
            </div>
          )}

          {/* ===== META ===== */}
          {section === 'meta' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Alvo" value={stats.target > 0 ? BRL(stats.target) : '—'} sub={stats.floor > 0 ? `Piso: ${BRL(stats.floor)}` : 'Sem meta'} />
                <KpiCard label="% da Meta Atingida" value={stats.target > 0 ? PCT(stats.pctTarget) : '—'} sub={stats.target > 0 ? `${BRL(stats.revenue)} / ${BRL(stats.target)}` : '—'} accent={stats.pctTarget >= 1 ? 'text-green-700' : 'text-secondary'} />
                <KpiCard label="Meta Diária Dinâmica" value={BRL(stats.dailyTarget)} sub={`${stats.remaining} dia(s) úteis restantes`} accent="text-blue-700" />
                <KpiCard label="Gap para Meta" value={BRL(stats.gap)} sub={stats.gapFloor > 0 ? `Piso: ${BRL(stats.gapFloor)}` : undefined} accent="text-orange-600" />
                <KpiCard label="Projeção do Mês" value={BRL(stats.projection)} sub={`Média/dia: ${BRL(stats.dailyAvg)}`} />
                <KpiCard label="Eficiência" value={BRL(stats.efficiency)} sub="Média/dia − Meta diária" accent={stats.efficiency >= 0 ? 'text-green-700' : 'text-red-600'} />
              </div>
              {HistoricalLineCard}
            </div>
          )}
        </>
      )}

      {mode === 'seller' && (
        <>
          {/* Goals button still accessible in seller mode */}
          <div className="flex justify-end">
            <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
              <Target className="h-4 w-4" /> Configurar Metas
            </Button>
          </div>
          <h3 className="text-lg font-semibold text-secondary">Performance por Vendedor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {perSeller.map(s => {
              const hasGoal = s.target > 0;
              const floor = 0;
              const aboveFloor = floor > 0 && s.revenue >= floor;
              const aboveTarget = hasGoal && s.revenue >= s.target;
              return (
                <Card key={s.seller} className="border-2">
                  <CardHeader>
                    <CardTitle className="text-secondary flex items-center justify-between">
                      <span>{s.seller}</span>
                      {hasGoal && (
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          aboveTarget ? 'bg-green-100 text-green-700'
                            : aboveFloor ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        )}>
                          {PCT(s.pctTarget)}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasGoal && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Meta: {BRL(s.target)}</span>
                          {floor > 0 && <span>Piso: {BRL(floor)}</span>}
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                          <div
                            className={cn('h-full transition-all',
                              aboveTarget ? 'bg-green-500'
                                : aboveFloor ? 'bg-amber-500'
                                : 'bg-red-500')}
                            style={{ width: `${Math.min(100, s.pctTarget * 100)}%` }}
                          />
                          {floor > 0 && s.target > 0 && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
                              style={{ left: `${Math.min(100, (floor / s.target) * 100)}%` }}
                              title={`Piso: ${BRL(floor)}`}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-xs text-muted-foreground">Lucro</p><p className={cn('font-bold', s.profit >= 0 ? 'text-green-700' : 'text-red-600')}>{BRL(s.profit)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Vendas</p><p className="font-bold">{s.salesCount}</p></div>
                      <div><p className="text-xs text-muted-foreground">Valor das Vendas</p><p className="font-bold">{BRL(s.revenue)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Meta Diária</p><p className="font-bold text-blue-700">{hasGoal ? BRL(s.dailyTarget) : '—'}</p></div>
                      <div><p className="text-xs text-muted-foreground">Gap p/ Meta</p><p className="font-bold text-orange-600">{hasGoal ? BRL(s.gap) : '—'}</p></div>
                      <div><p className="text-xs text-muted-foreground">Projeção Mês</p><p className="font-bold">{BRL(s.projection)}</p></div>
                    </div>
                    <div className="border-t pt-2 grid grid-cols-3 gap-2 text-xs text-center">
                      <div><p className="text-muted-foreground">Méd. Custo</p><p className="font-semibold">{BRL(s.avgPurchase)}</p></div>
                      <div><p className="text-muted-foreground">Méd. Venda</p><p className="font-semibold">{BRL(s.ticketSale)}</p></div>
                      <div><p className="text-muted-foreground">Méd. Lucro</p><p className="font-semibold">{BRL(s.ticketProfit)}</p></div>
                    </div>
                    {!hasGoal && (
                      <p className="text-xs text-muted-foreground italic text-center">
                        Sem meta cadastrada para este vendedor.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-secondary">Vendas vs Meta por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perSeller.map(s => ({
                  name: s.seller,
                  Vendas: s.revenue,
                  Lucro: s.profit,
                }))}>
                  <XAxis dataKey="name" /><YAxis />
                  <Tooltip formatter={(v: number) => BRL(v)} />
                  <Legend />
                  <Bar dataKey="Vendas" fill="hsl(192, 76%, 29%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Lucro" fill="hsl(140, 70%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <GoalsModal
        open={goalsOpen} onClose={() => setGoalsOpen(false)}
        year={filters.year} month={filters.month}
      />
    </div>
  );
}
