import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Target, Settings2 } from 'lucide-react';
import { format, getMonth, getYear, isSameMonth, isSameYear, startOfMonth, endOfMonth, eachDayOfInterval, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useOrders, calcTotal, calcFinalCost, calcProfit, Order, SELLERS } from '@/store/OrderStore';
import { useFinance, Goal, GoalScopeType, goalKey } from '@/store/FinanceStore';

type ViewMode = 'company' | 'seller';
type CompanyKey = 'all' | 'Lucky Store' | 'BTech' | 'AJJ';
const COMPANIES: CompanyKey[] = ['all', 'Lucky Store', 'BTech', 'AJJ'];

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Counts business days (Mon-Fri) remaining in the month from today (inclusive) */
function remainingBusinessDays(year: number, month: number): number {
  const today = new Date();
  const isCurMonth = today.getFullYear() === year && today.getMonth() === month;
  const start = isCurMonth ? today : startOfMonth(new Date(year, month, 1));
  const end = endOfMonth(new Date(year, month, 1));
  if (isAfter(start, end)) return 0;
  return eachDayOfInterval({ start, end }).filter(d => {
    const w = d.getDay();
    return w !== 0 && w !== 6;
  }).length;
}

/** Days elapsed in current month (business days, capped) */
function elapsedBusinessDays(year: number, month: number): number {
  const today = new Date();
  const start = startOfMonth(new Date(year, month, 1));
  const end = today.getFullYear() === year && today.getMonth() === month
    ? today
    : endOfMonth(new Date(year, month, 1));
  if (isBefore(end, start)) return 0;
  return eachDayOfInterval({ start, end }).filter(d => {
    const w = d.getDay();
    return w !== 0 && w !== 6;
  }).length;
}

interface Filters {
  year: number;
  month: number; // 0-11
  rangeFrom?: Date;
  rangeTo?: Date;
  company: CompanyKey;
}

function applyFilters(orders: Order[], f: Filters): Order[] {
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

function computeStats(orders: Order[], all: Order[], f: Filters, goal?: Goal) {
  const revenue = orders.reduce((s, o) => s + calcTotal(o), 0);
  const cost = orders.reduce((s, o) => s + calcFinalCost(o), 0);
  const profit = orders.reduce((s, o) => s + calcProfit(o), 0);
  const margin = revenue > 0 ? profit / revenue : 0;
  const salesCount = orders.length;
  const ticketSale = salesCount > 0 ? revenue / salesCount : 0;
  const ticketProfit = salesCount > 0 ? profit / salesCount : 0;
  const avgPurchase = salesCount > 0 ? cost / salesCount : 0;

  // Cancellations from full set (same period/company)
  const cancellations = all.filter(o => {
    if (!o.cancelled || o.isRMA) return false;
    if (!o.orderDate) return false;
    const d = new Date(o.orderDate + 'T12:00:00');
    if (getYear(d) !== f.year || getMonth(d) !== f.month) return false;
    if (f.company !== 'all' && o.company !== f.company) return false;
    return true;
  });
  const cancCount = cancellations.length;
  const cancValue = cancellations.reduce((s, o) => s + calcTotal(o), 0);

  // Today
  const today = new Date();
  const todayRevenue = orders.filter(o => o.orderDate === format(today, 'yyyy-MM-dd')).reduce((s, o) => s + calcTotal(o), 0);

  const target = goal?.target || 0;
  const pctTarget = target > 0 ? revenue / target : 0;
  const gap = Math.max(0, target - revenue);
  const elapsed = elapsedBusinessDays(f.year, f.month);
  const remaining = remainingBusinessDays(f.year, f.month);
  const dailyAvg = elapsed > 0 ? revenue / elapsed : 0;
  const projection = elapsed > 0
    ? dailyAvg * (elapsed + remaining)
    : revenue;
  const dailyTarget = remaining > 0 && target > 0 ? gap / remaining : 0;

  // Tax breakdown
  const totalTax = orders.reduce((s, o) => s + (o.purchaseTaxValue || 0) + (o.salesTaxValue || 0), 0);
  const otherCost = cost - totalTax;

  return {
    revenue, cost, profit, margin, salesCount, ticketSale, ticketProfit, avgPurchase,
    cancCount, cancValue, todayRevenue,
    target, pctTarget, gap, projection, dailyTarget, dailyAvg,
    totalTax, otherCost,
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

  const companyOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Geral (todas as empresas)' },
    { value: 'Lucky Store', label: 'Lucky Store' },
    { value: 'BTech', label: 'BTech' },
    { value: 'AJJ', label: 'AJJ' },
  ];
  const sellerOptions = SELLERS.map(s => ({ value: s, label: s }));
  const scopeOptions = scopeType === 'company' ? companyOptions : sellerOptions;

  // When scope type changes, reset scopeId to first valid option
  const onScopeTypeChange = (v: GoalScopeType) => {
    setScopeType(v);
    setScopeId(v === 'company' ? 'all' : SELLERS[0]);
  };

  const save = () => {
    const key = goalKey(y, m, scopeType, scopeId);
    upsertGoal({ key, year: y, month: m, scopeType, scopeId, target, floor });
    setTarget(0); setFloor(0);
  };

  const scopeLabel = (g: Goal) =>
    g.scopeType === 'company'
      ? (g.scopeId === 'all' ? 'Empresa: Geral' : `Empresa: ${g.scopeId}`)
      : `Vendedor: ${g.scopeId}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Configurar Metas</DialogTitle></DialogHeader>
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
          <Button onClick={save} className="w-full">Salvar Meta</Button>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Metas registradas</h4>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Mês/Ano</TableHead><TableHead>Escopo</TableHead><TableHead>Meta</TableHead><TableHead>Piso</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {goals.map(g => (
                    <TableRow key={g.key}>
                      <TableCell>{MONTHS[g.month - 1]}/{g.year}</TableCell>
                      <TableCell>{scopeLabel(g)}</TableCell>
                      <TableCell>{BRL(g.target)}</TableCell>
                      <TableCell>{BRL(g.floor)}</TableCell>
                      <TableCell><Button size="sm" variant="destructive" onClick={() => deleteGoal(g.key)}>Excluir</Button></TableCell>
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
  const { goals, upsertGoal, deleteGoal } = useFinance();

  const today = new Date();
  const [filters, setFilters] = useState<Filters>({
    year: today.getFullYear(), month: today.getMonth(), company: 'all',
  });
  const [mode, setMode] = useState<ViewMode>('company');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const filtered = useMemo(() => applyFilters(orders, filters), [orders, filters]);

  // Goal for the current top-level company filter (overall view at top)
  const goal = useMemo(
    () => goals.find(g =>
      g.year === filters.year && g.month === filters.month + 1 &&
      g.scopeType === 'company' && g.scopeId === filters.company
    ),
    [goals, filters.year, filters.month, filters.company]
  );
  const stats = useMemo(() => computeStats(filtered, orders, filters, goal), [filtered, orders, filters, goal]);

  // Per-company breakdown (each company uses its own goal)
  const perCompany = useMemo(() => {
    const allCompanies = ['Lucky Store', 'BTech', 'AJJ'];
    return allCompanies.map(c => {
      const list = filtered.filter(o => o.company === c);
      const cGoal = goals.find(g =>
        g.year === filters.year && g.month === filters.month + 1 &&
        g.scopeType === 'company' && g.scopeId === c
      );
      const s = computeStats(list, orders, { ...filters, company: c as CompanyKey }, cGoal);
      return { company: c, ...s };
    });
  }, [filtered, orders, filters, goals]);

  // Per-seller stats (each seller uses its own goal)
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

  const taxData = [
    { name: 'Imposto Compra', value: filtered.reduce((s, o) => s + (o.purchaseTaxValue || 0), 0) },
    { name: 'Imposto Venda', value: filtered.reduce((s, o) => s + (o.salesTaxValue || 0), 0) },
    { name: 'Outros Custos', value: Math.max(0, stats.otherCost) },
  ].filter(d => d.value > 0);

  const ticketData = [
    { name: 'Venda', value: stats.ticketSale },
    { name: 'Compra', value: stats.avgPurchase },
    { name: 'Lucro', value: stats.ticketProfit },
  ];

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={String(filters.month)} onValueChange={v => setFilters(f => ({ ...f, month: +v, rangeFrom: undefined, rangeTo: undefined }))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Input type="number" className="w-[100px]" value={filters.year}
                onChange={e => setFilters(f => ({ ...f, year: +e.target.value || f.year }))} />
            </div>
            <div>
              <Label className="text-xs">Período</Label>
              <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[230px] justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.rangeFrom && filters.rangeTo
                      ? `${format(filters.rangeFrom, 'dd/MM')} – ${format(filters.rangeTo, 'dd/MM/yy')}`
                      : 'Selecionar período'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range"
                    selected={{ from: filters.rangeFrom, to: filters.rangeTo }}
                    onSelect={(r: any) => setFilters(f => ({ ...f, rangeFrom: r?.from, rangeTo: r?.to }))}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex bg-muted rounded-md p-0.5">
              <button onClick={() => setMode('company')}
                className={cn('px-3 py-1.5 text-sm rounded', mode === 'company' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
                Temporal / Empresa
              </button>
              <button onClick={() => setMode('seller')}
                className={cn('px-3 py-1.5 text-sm rounded', mode === 'seller' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
                Por Vendedor
              </button>
            </div>
          </div>
          <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
            <Target className="h-4 w-4" /> Configurar Metas
          </Button>
        </CardContent>
      </Card>

      {mode === 'company' && (
        <>
          {/* Company tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-full p-1 w-fit">
            {COMPANIES.map(c => (
              <button key={c} onClick={() => setFilters(f => ({ ...f, company: c }))}
                className={cn('px-4 py-1.5 rounded-full text-sm font-medium',
                  filters.company === c ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground')}>
                {c === 'all' ? 'Geral' : c}
              </button>
            ))}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard label="Faturamento Mês" value={BRL(stats.revenue)} sub={`Hoje: ${BRL(stats.todayRevenue)}`} accent="text-green-700" />
            <KpiCard label="Lucro Total" value={BRL(stats.profit)} accent={stats.profit >= 0 ? 'text-green-700' : 'text-red-600'} />
            <KpiCard label="Margem por Venda" value={PCT(stats.margin)} />
            <KpiCard label="% Meta Atingida" value={stats.target > 0 ? PCT(stats.pctTarget) : '—'} sub={stats.target > 0 ? `Meta: ${BRL(stats.target)}` : 'Sem meta cadastrada'} />
            <KpiCard label="Projeção do Mês" value={BRL(stats.projection)} sub={`Média/dia: ${BRL(stats.dailyAvg)}`} />
            <KpiCard label="Gap para Meta" value={BRL(stats.gap)} accent="text-orange-600" />
            <KpiCard label="Quantidade Vendas" value={String(stats.salesCount)} />
            <KpiCard label="Cancelamentos" value={String(stats.cancCount)} sub={`Perda: ${BRL(stats.cancValue)}`} accent="text-red-600" />
            <KpiCard label="Meta Diária Dinâmica" value={BRL(stats.dailyTarget)} sub="Para atingir a meta" accent="text-blue-700" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-secondary">Custo Total — Composição</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={taxData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => BRL(e.value)}>
                      {taxData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => BRL(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
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
          </div>

          {/* Per-company breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-secondary">Detalhamento por Empresa</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">% Meta</TableHead>
                    <TableHead className="text-right">Projeção</TableHead>
                    <TableHead className="text-right">Tkt Venda</TableHead>
                    <TableHead className="text-right">Tkt Lucro</TableHead>
                    <TableHead className="text-right">Impostos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perCompany.map(c => (
                    <TableRow key={c.company}>
                      <TableCell className="font-medium">{c.company}</TableCell>
                      <TableCell className="text-right">{BRL(c.revenue)}</TableCell>
                      <TableCell className="text-right">{BRL(c.cost)}</TableCell>
                      <TableCell className={cn('text-right font-semibold', c.profit >= 0 ? 'text-green-700' : 'text-red-600')}>{BRL(c.profit)}</TableCell>
                      <TableCell className="text-right">{PCT(c.margin)}</TableCell>
                      <TableCell className="text-right">{c.target > 0 ? PCT(c.pctTarget) : '—'}</TableCell>
                      <TableCell className="text-right">{BRL(c.projection)}</TableCell>
                      <TableCell className="text-right">{BRL(c.ticketSale)}</TableCell>
                      <TableCell className="text-right">{BRL(c.ticketProfit)}</TableCell>
                      <TableCell className="text-right">{BRL(c.totalTax)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {mode === 'seller' && (
        <>
          <h3 className="text-lg font-semibold text-secondary">Performance por Vendedor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {perSeller.map(s => (
              <Card key={s.seller} className="border-2">
                <CardHeader><CardTitle className="text-secondary">{s.seller}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Lucro</p><p className={cn('font-bold', s.profit >= 0 ? 'text-green-700' : 'text-red-600')}>{BRL(s.profit)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Vendas</p><p className="font-bold">{s.salesCount}</p></div>
                    <div><p className="text-xs text-muted-foreground">Valor das Vendas</p><p className="font-bold">{BRL(s.revenue)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Meta Diária</p><p className="font-bold text-blue-700">{BRL(s.dailyTarget)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="font-bold">{BRL(s.ticketSale)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Projeção Mês</p><p className="font-bold">{BRL(s.projection)}</p></div>
                  </div>
                  <div className="border-t pt-2 grid grid-cols-3 gap-2 text-xs text-center">
                    <div><p className="text-muted-foreground">Méd. Custo</p><p className="font-semibold">{BRL(s.avgPurchase)}</p></div>
                    <div><p className="text-muted-foreground">Méd. Venda</p><p className="font-semibold">{BRL(s.ticketSale)}</p></div>
                    <div><p className="text-muted-foreground">Méd. Lucro</p><p className="font-semibold">{BRL(s.ticketProfit)}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-secondary">Vendas por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={perSeller.map(s => ({ name: s.seller, Vendas: s.revenue, Lucro: s.profit }))}>
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
        goals={goals} upsertGoal={upsertGoal} deleteGoal={deleteGoal}
        year={filters.year} month={filters.month}
      />
    </div>
  );
}
