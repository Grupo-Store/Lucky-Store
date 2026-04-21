import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders, OrderStatus, calcTotal, isOpenOrder } from '@/store/OrderStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { FinancialManager } from '@/components/finance/FinancialManager';

const PIE_COLORS = ['#facc15', '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#22c55e', '#ef4444'];
const STATUS_KEYS: OrderStatus[] = ['To Buy', 'Bought', 'Received', 'Ready for Delivery', 'Out for Delivery', 'Delivered', 'Delayed'];
const COMPANY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Geral', value: 'all' },
  { label: 'Lucky Store', value: 'Lucky Store' },
  { label: 'BTech', value: 'BTech' },
  { label: 'AJJ', value: 'AJJ' },
];

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ChartsView() {
  const { orders } = useOrders();
  const [companyFilter, setCompanyFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    if (companyFilter === 'all') return orders;
    return orders.filter(o => o.company === companyFilter);
  }, [orders, companyFilter]);

  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + calcTotal(o), 0);
    const openOrders = filteredOrders.filter(o => isOpenOrder(o.status)).length;
    const deliveredOrders = filteredOrders.filter(o => o.status === 'Delivered').length;
    const statusDist = STATUS_KEYS.map(s => ({ name: s, value: filteredOrders.filter(o => o.status === s).length })).filter(d => d.value > 0);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyRevenue = months.map((m, i) => ({
      name: m,
      receita: i < 4 ? Math.round(totalRevenue * (0.5 + Math.random()) / 3) : 0,
      pedidos: i < 4 ? Math.max(1, Math.round(filteredOrders.length * (0.5 + Math.random()))) : 0,
    }));

    const quarterlyData = [
      { name: 'Q1', receita: monthlyRevenue.slice(0, 3).reduce((s, m) => s + m.receita, 0) },
      { name: 'Q2', receita: monthlyRevenue.slice(3, 6).reduce((s, m) => s + m.receita, 0) },
      { name: 'Q3', receita: monthlyRevenue.slice(6, 9).reduce((s, m) => s + m.receita, 0) },
      { name: 'Q4', receita: monthlyRevenue.slice(9, 12).reduce((s, m) => s + m.receita, 0) },
    ];

    return { totalRevenue, openOrders, deliveredOrders, statusDist, monthlyRevenue, quarterlyData, totalOrders: filteredOrders.length };
  }, [filteredOrders]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium text-muted-foreground">Empresa:</span>
        <div className="flex items-center gap-1 bg-muted rounded-full p-1">
          {COMPANY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCompanyFilter(opt.value)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                companyFilter === opt.value ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="bg-card mb-4">
          <TabsTrigger value="monthly" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Mensal</TabsTrigger>
          <TabsTrigger value="annual" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Anual</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[
              ['Total Pedidos', stats.totalOrders],
              ['Pedidos Abertos', stats.openOrders],
              ['Entregues', stats.deliveredOrders],
              ['Receita Total', formatBRL(stats.totalRevenue)],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-secondary">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-secondary">Receita Mensal</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.monthlyRevenue}>
                    <XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="receita" fill="hsl(192, 76%, 29%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-secondary">Distribuição de Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={stats.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {stats.statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="annual">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              ['Receita Anual', formatBRL(stats.totalRevenue)],
              ['Volume Total', stats.totalOrders],
              ['Ticket Médio', formatBRL(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-secondary">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-secondary">Receita por Trimestre</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.quarterlyData}>
                    <XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="receita" fill="hsl(195, 85%, 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-secondary">Tendência Anual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={stats.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis />
                    <Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                    <Line type="monotone" dataKey="receita" stroke="hsl(192, 76%, 29%)" strokeWidth={2} />
                    <Line type="monotone" dataKey="pedidos" stroke="hsl(195, 85%, 51%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Tabs defaultValue="finance" className="w-full">
      <TabsList className="bg-card mb-4">
        <TabsTrigger value="finance" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
          Gerenciador Financeiro
        </TabsTrigger>
        <TabsTrigger value="charts" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
          Gráficos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="finance">
        <FinancialManager />
      </TabsContent>

      <TabsContent value="charts">
        <ChartsView />
      </TabsContent>
    </Tabs>
  );
}
