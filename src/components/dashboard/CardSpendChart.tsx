import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { CardSpendItem } from '@/hooks/use-dashboard-query';

const COLORS = ['#2F6BFF', '#19A974', '#9B6BFF', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#EF4444', '#0EA5E9', '#84CC16'];
const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  items: CardSpendItem[];
}

export function CardSpendChart({ items }: Props) {
  const data = (items ?? []).filter(d => d.total > 0);
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-secondary">Gastos por Cartão</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum gasto por cartão registrado no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
                nameKey="card"
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={70}
                paddingAngle={1}
                label={(e: any) => `${e.card}: ${BRL(e.total)}`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, p: any) => {
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
                  return [`${BRL(v)} (${pct}%)`, p?.payload?.card];
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
