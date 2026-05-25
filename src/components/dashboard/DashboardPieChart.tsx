import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DashboardPieChartProps {
  impostoCompra: number;
  impostoVenda: number;
  outrosCustos: number;
}

export function DashboardPieChart({ impostoCompra, impostoVenda, outrosCustos }: DashboardPieChartProps) {
  const data = [
    { name: 'Imposto de Compra', value: impostoCompra },
    { name: 'Imposto de Venda', value: impostoVenda },
    { name: 'Outros Custos', value: outrosCustos },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-secondary">Custo Total — Composição</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={50}
              label={(e: any) => `${e.name}: ${BRL(e.value)}`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
