import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './Dashboard';

vi.mock('@/hooks/use-dashboard-query', () => ({
  useDashboardKpis: vi.fn(),
  useDashboardProjections: vi.fn(),
  useDashboardBreakdownByCompany: vi.fn(),
  useDashboardBreakdownBySeller: vi.fn(),
  useDashboardGoals: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useUpsertGoal: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteGoal: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useVendorGoals: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useVendedores: vi.fn(() => ({ data: { items: [] } })),
  useUpsertVendorGoal: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteVendorGoal: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/store/DashboardFilterStore', () => ({
  useDashboardFilters: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/components/dashboard/KpiCard', () => ({
  KpiCard: ({ label, value }: any) => <div data-testid="kpi-card">{label}: {value}</div>,
}));

vi.mock('@/components/dashboard/CompanyBreakdownTable', () => ({
  CompanyBreakdownTable: () => <div data-testid="company-table" />,
}));

vi.mock('@/components/dashboard/SellerBreakdownTable', () => ({
  SellerBreakdownTable: () => <div data-testid="seller-table" />,
}));

vi.mock('@/components/dashboard/DashboardPieChart', () => ({
  DashboardPieChart: () => <div data-testid="pie-chart" />,
}));

vi.mock('@/components/dashboard/DashboardTicketBar', () => ({
  DashboardTicketBar: () => <div data-testid="ticket-bar" />,
}));

vi.mock('@/components/dashboard/HistoricalChart', () => ({
  HistoricalChart: () => <div data-testid="historical-chart" />,
}));

vi.mock('@/components/dashboard/SellerCard', () => ({
  SellerCard: () => <div data-testid="seller-card" />,
}));

vi.mock('@/components/dashboard/SellerGoalChart', () => ({
  SellerGoalChart: () => <div data-testid="seller-goal-chart" />,
}));

vi.mock('@/api/storeConfig', () => ({
  LOJA_IDS: { 'Lucky Store': 'ls1', BTech: 'bt1', AJJ: 'ajj1' },
  VENDEDOR_IDS: {},
}));

import {
  useDashboardKpis,
  useDashboardProjections,
  useDashboardBreakdownByCompany,
  useDashboardBreakdownBySeller,
} from '@/hooks/use-dashboard-query';
import { useDashboardFilters } from '@/store/DashboardFilterStore';
import { toast } from 'sonner';

const mockFilters = {
  filters: { year: 2026, month: 4 },
  setFilters: vi.fn(),
  mode: 'company' as const,
  setMode: vi.fn(),
  section: 'geral' as const,
  setSection: vi.fn(),
};

const mockKpis = {
  receita: 50000,
  receita_hoje: 2000,
  lucro: 10000,
  margem: 0.2,
  num_pedidos: 120,
  num_cancelamentos: 3,
  valor_cancelamentos: 1500,
  ticket_venda: 416.67,
  ticket_lucro: 83.33,
  ticket_custo: 333.33,
  imposto_compra: 2000,
  imposto_venda: 3000,
  outros_custos: 5000,
  custo: 40000,
  periodo_inicio: '2026-05-01',
  periodo_fim: '2026-05-31',
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <Dashboard />
    </QueryClientProvider>
  );
}

function setupDefaultMocks() {
  vi.mocked(useDashboardFilters).mockReturnValue(mockFilters);
  vi.mocked(useDashboardProjections).mockReturnValue({ data: undefined, isLoading: false, isError: false } as any);
  vi.mocked(useDashboardBreakdownByCompany).mockReturnValue({ data: undefined, isLoading: false, isError: false } as any);
  vi.mocked(useDashboardBreakdownBySeller).mockReturnValue({ data: undefined, isLoading: false, isError: false } as any);
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton when kpisLoading is true', () => {
    setupDefaultMocks();
    vi.mocked(useDashboardKpis).mockReturnValue({ data: undefined, isLoading: true, isError: false } as any);

    renderDashboard();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId('kpi-card')).toHaveLength(0);
  });

  it('renders KpiCards when kpisLoading is false and data is available', () => {
    setupDefaultMocks();
    vi.mocked(useDashboardKpis).mockReturnValue({ data: mockKpis, isLoading: false, isError: false } as any);

    renderDashboard();

    expect(screen.queryAllByTestId('kpi-card').length).toBeGreaterThan(0);
  });

  it('renders HistoricalChart in geral section (mode=company)', () => {
    setupDefaultMocks();
    vi.mocked(useDashboardKpis).mockReturnValue({ data: mockKpis, isLoading: false, isError: false } as any);
    vi.mocked(useDashboardFilters).mockReturnValue({
      ...mockFilters,
      mode: 'company',
      section: 'geral',
    });

    renderDashboard();

    expect(screen.getByTestId('historical-chart')).toBeInTheDocument();
  });

  it('renders SellerGoalChart in seller mode', () => {
    setupDefaultMocks();
    vi.mocked(useDashboardKpis).mockReturnValue({ data: mockKpis, isLoading: false, isError: false } as any);
    vi.mocked(useDashboardFilters).mockReturnValue({
      ...mockFilters,
      mode: 'seller',
      section: 'geral',
    });

    renderDashboard();

    expect(screen.getByTestId('seller-goal-chart')).toBeInTheDocument();
  });

  it('calls toast.error when kpisError is true', async () => {
    setupDefaultMocks();
    vi.mocked(useDashboardKpis).mockReturnValue({ data: undefined, isLoading: false, isError: true } as any);

    renderDashboard();

    expect(toast.error).toHaveBeenCalledWith('Erro ao carregar dados do dashboard');
  });
});
