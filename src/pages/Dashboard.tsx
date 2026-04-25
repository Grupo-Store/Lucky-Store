import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Target, Pencil } from 'lucide-react';
import { format, getMonth, getYear, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isAfter, subYears } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useOrders, calcTotal, calcFinalCost, calcProfit, Order, SELLERS, calcFreightTotal } from '@/store/OrderStore';
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

function computeStats(orders: Order[], all: Order[], f: FilterCriteria, goal?: Goal) {
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
  open, onClose, goals, upsertGoal, deleteGoal, year, month,
}: {
  open: boolean; onClose: () => void; goals: Goal[];
  upsertGoal: (g: Goal) => void; deleteGoal: (key: string) => void;
  year: number; month: number;
}) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month + 1);
  const [scopeType, setScopeType] = useState<GoalScopeType>('company');
  const [scopeId, setScopeId] = useState<string>('all');
  const [target, setTarget] = useState<number>(0);
  const [floor, setFloor] = useState<number>(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const companyOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Geral (todas as empresas)' },
    { value: 'Lucky Store', label: 'Lucky Store' },
    { value: 'BTech', label: 'BTech' },
    { value: 'AJJ', label: 'AJJ' },
  ];
  const sellerOptions = SELLERS.map(s => ({ value: s, label: s }));
  const scopeOptions = scopeType === 'company' ? companyOptions : sellerOptions;

  const onScopeTypeChange = (v: GoalScopeType) => {
    setScopeType(v);
    setScopeId(v === 'company' ? 'all' : SELLERS[0]);
  };

  const resetForm = () => {
    setTarget(0); setFloor(0); setEditingKey(null);
  };

  const save = () => {
    const key = goalKey(y, m, scopeType, scopeId);
    upsertGoal({ key, year: y, month: m, scopeType, scopeId, target, floor });
    resetForm();
  };

  const loadForEdit = (g: Goal) => {
    setY(g.year);
    setM(g.month);
    setScopeType(g.scopeType);
    setScopeId(g.scopeId);
    setTarget(g.target);
    setFloor(g.floor);
    setEditingKey(g.key);
  };

  const scopeLabel = (g: Goal) =>
    g.scopeType === 'company'
      ? (g.scopeId === 'all' ? 'Empresa: Geral' : `Empresa: ${g.scopeId}`)
      : `Vendedor: ${g.scopeId}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingKey ? 'Editar Meta' : 'Configurar Metas'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Tipo de Meta</Label>
              <Select value={scopeType} onValueChange={(v) => onScopeTypeChange(v as GoalScopeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="seller">Vendedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{scopeType === 'company' ? 'Empresa' : 'Vendedor'}</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scopeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
            <Button onClick={save} className="flex-1">
              {editingKey ? 'Atualizar Meta' : 'Salvar Meta'}
            </Button>
            {editingKey && (
              <Button variant="outline" onClick={resetForm}>Cancelar Edição</Button>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Metas registradas</h4>
            <p className="text-xs text-muted-foreground mb-2">Clique em uma meta para editá-la.</p>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Mês/Ano</TableHead><TableHead>Escopo</TableHead><TableHead>Meta</TableHead><TableHead>Piso</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {goals.map(g => (
                    <TableRow
                      key={g.key}
                      className={cn('cursor-pointer hover:bg-muted/50', editingKey === g.key && 'bg-secondary/10')}
                      onClick={() => loadForEdit(g)}
                    >
                      <TableCell>{MONTHS[g.month - 1]}/{g.year}</TableCell>
                      <TableCell>{scopeLabel(g)}</TableCell>
                      <TableCell>{BRL(g.target)}</TableCell>
                      <TableCell>{BRL(g.floor)}</TableCell>
                      <TableCell className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => loadForEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          deleteGoal(g.key);
                          if (editingKey === g.key) resetForm();
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
  const { goals, upsertGoal, deleteGoal, expenses } = useFinance();
  const { quotes } = useQuotes();
  const { filters: globalFilters, mode } = useDashboardFilters();

  // Local: company sub-filter & section tab
  const [company, setCompany] = useState<CompanyKey>('all');
  const [section, setSection] = useState<SectionKey>('geral');
  const [goalsOpen, setGoalsOpen] = useState(false);

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
    () => goals.find(g =>
      g.year === filters.year && g.month === filters.month + 1 &&
      g.scopeType === 'company' && g.scopeId === filters.company
    ),
    [goals, filters.year, filters.month, filters.company]
  );
  const stats = useMemo(() => computeStats(filtered, orders, filters, goal), [filtered, orders, filters, goal]);

  const perSeller = useMemo(() => {
    return SELLERS.map(seller => {
      const list = filtered.filter(o => o.seller === seller);
      const sGoal = goals.find(g =>
        g.year === filters.year && g.month === filters.month + 1 &&
        g.scopeType === 'seller' && g.scopeId === seller
      );
      const s = computeStats(list, orders, filters, sGoal);
      return { seller, ...s };
    });
  }, [filtered, orders, filters, goals]);

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
      {mode === 'company' && (
        <>
          {/* Sub-header: company chips (left) + Goals btn (right) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-full p-1 w-fit">
              {COMPANIES.map(c => (
                <button key={c} onClick={() => setCompany(c)}
                  className={cn('px-4 py-1.5 rounded-full text-sm font-medium',
                    company === c ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground')}>
                  {c === 'all' ? 'Geral' : c}
                </button>
              ))}
            </div>
            <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
              <Target className="h-4 w-4" /> Configurar Metas
            </Button>
          </div>

          {/* Centralized horizontal section tabs */}
          <div className="flex justify-center">
            <div className="inline-flex items-center rounded-lg border border-border bg-card overflow-hidden">
              {SECTIONS.map((s, idx) => (
                <div key={s.key} className="flex items-center">
                  {idx > 0 && <div className="w-px h-6 bg-border" aria-hidden />}
                  <button
                    onClick={() => setSection(s.key)}
                    className={cn(
                      'px-6 py-2.5 text-sm font-bold tracking-wider uppercase transition-all relative',
                      section === s.key
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {s.label}
                    {section === s.key && (
                      <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-secondary-foreground" />
                    )}
                  </button>
                </div>
              ))}
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
              {company === 'all' && TaxByCompanyCard}
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
              const sellerGoal = goals.find(g =>
                g.year === filters.year && g.month === filters.month + 1 &&
                g.scopeType === 'seller' && g.scopeId === s.seller
              );
              const floor = sellerGoal?.floor ?? 0;
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
                  Alvo: s.target,
                  Piso: goals.find(g =>
                    g.year === filters.year && g.month === filters.month + 1 &&
                    g.scopeType === 'seller' && g.scopeId === s.seller
                  )?.floor ?? 0,
                  Vendas: s.revenue,
                  Lucro: s.profit,
                }))}>
                  <XAxis dataKey="name" /><YAxis />
                  <Tooltip formatter={(v: number) => BRL(v)} />
                  <Legend />
                  <Bar dataKey="Alvo" fill="hsl(35, 90%, 55%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Piso" fill="hsl(0, 70%, 60%)" radius={[4, 4, 0, 0]} />
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
        goals={goals} upsertGoal={upsertGoal} deleteGoal={deleteGoal}
        year={filters.year} month={filters.month}
      />
    </div>
  );
}
