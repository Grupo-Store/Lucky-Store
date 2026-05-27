import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

// Generates one entry per day in the given month.
// All values default to 0 — connect to a real endpoint when available.
function buildDailyMock(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return {
      date: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`,
      custo: 0,
      faturamento: 0,
      lucro: 0,
      ano_anterior: 0,
    };
  });
}

const LINE_CONFIG = [
  { key: 'custo',        label: 'Custo',              color: '#ef4444' },
  { key: 'faturamento',  label: 'Faturamento',         color: '#0f4c5c' },
  { key: 'lucro',        label: 'Lucro',               color: '#16a34a' },
  { key: 'ano_anterior', label: 'Fat. Ano Anterior',   color: '#9ca3af', dashed: true },
] as const;

type LineKey = (typeof LINE_CONFIG)[number]['key'];

interface HistoricalChartProps {
  year: number;
  month: number; // 0-11
}

export function HistoricalChart({ year, month }: HistoricalChartProps) {
  const [visible, setVisible] = useState<Record<LineKey, boolean>>({
    custo: true,
    faturamento: true,
    lucro: true,
    ano_anterior: true,
  });

  const data = buildDailyMock(year, month);

  const toggle = (key: LineKey) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }));

  // Show only every other label on the X-axis when there are > 15 days
  const xInterval = data.length > 15 ? 1 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-secondary">Análise Histórica — Diário</CardTitle>

          <div className="flex items-center gap-4 flex-wrap">
            {LINE_CONFIG.map(({ key, label, color }) => (
              <label
                key={key}
                className="flex items-center gap-1.5 cursor-pointer select-none text-xs"
              >
                <input
                  type="checkbox"
                  checked={visible[key]}
                  onChange={() => toggle(key)}
                  className="cursor-pointer"
                  style={{ accentColor: color }}
                />
                <span className={cn(!visible[key] && 'text-muted-foreground line-through')}>
                  {key === 'ano_anterior' ? 'Ano Anterior (Fat.)' : label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval={xInterval}
            />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip />

            {LINE_CONFIG.map(({ key, label, color, dashed }) =>
              visible[key] ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={dashed ? '5 5' : undefined}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                />
              ) : null,
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend row matching the prototype style */}
        <div className="mt-2 flex justify-center gap-5 flex-wrap">
          {LINE_CONFIG.map(({ key, label, color, dashed }) => (
            <span key={key} className="flex items-center gap-1 text-xs text-muted-foreground">
              <svg width="20" height="10">
                <line
                  x1="0" y1="5" x2="20" y2="5"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={dashed ? '4 3' : undefined}
                />
                <circle cx="10" cy="5" r="3" fill={color} />
              </svg>
              {key === 'ano_anterior' ? 'Fat. Ano Anterior' : label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
