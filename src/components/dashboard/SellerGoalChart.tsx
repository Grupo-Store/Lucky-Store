import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { SellerBreakdownItem } from '@/hooks/use-dashboard-query';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface SellerGoalChartProps {
  items: SellerBreakdownItem[];
  // Per-seller goals not yet supported by backend — alvo/piso are mocked as 0
  goals?: Record<string, { alvo: number; piso: number }>;
}

export function SellerGoalChart({ items, goals = {} }: SellerGoalChartProps) {
  const data = items.map((item) => ({
    name: item.nome,
    alvo: goals[item.id_vendedor]?.alvo ?? 0,
    piso: goals[item.id_vendedor]?.piso ?? 0,
    vendas: item.receita,
    lucro: Math.max(item.lucro, 0), // show only positive lucro in chart
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-secondary">Vendas vs Meta por Vendedor</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => BRL(v)} tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v: number) => BRL(v)} />
            <Legend
              formatter={(value) => {
                const labels: Record<string, string> = {
                  alvo: 'Alvo',
                  piso: 'Piso',
                  vendas: 'Vendas',
                  lucro: 'Lucro',
                };
                return labels[value] ?? value;
              }}
            />
            <Bar dataKey="alvo" name="alvo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="piso" name="piso" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="vendas" name="vendas" fill="#0f4c5c" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lucro" name="lucro" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
