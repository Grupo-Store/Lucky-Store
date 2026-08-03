import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { DashboardPieChart } from './DashboardPieChart';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => <div data-testid="pie">{data?.map((d: any) => <span key={d.name}>{d.name}</span>)}</div>,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('DashboardPieChart', () => {
  it('renderiza o título "Custo Total — Composição"', () => {
    render(<DashboardPieChart custoPedidos={100} custoFrete={200} outrosCustos={50} />);
    expect(screen.getByText('Custo Total — Composição')).toBeInTheDocument();
  });

  it('renderiza os 3 nomes de slice quando todos os valores > 0', () => {
    render(<DashboardPieChart custoPedidos={100} custoFrete={200} outrosCustos={50} />);
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Fretes')).toBeInTheDocument();
    expect(screen.getByText('Despesas')).toBeInTheDocument();
  });

  it('filtra slice com value = 0 (Despesas=0 não aparece)', () => {
    render(<DashboardPieChart custoPedidos={100} custoFrete={200} outrosCustos={0} />);
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Fretes')).toBeInTheDocument();
    expect(screen.queryByText('Despesas')).not.toBeInTheDocument();
  });
});
