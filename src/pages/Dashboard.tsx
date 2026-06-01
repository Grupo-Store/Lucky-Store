import { useState, useMemo, useEffect } from 'react';
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
import { Target, Pencil, CalendarIcon, Building2, User, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDashboardFilters } from '@/store/DashboardFilterStore';
import { toast } from 'sonner';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DashboardPieChart } from '@/components/dashboard/DashboardPieChart';
import { DashboardTicketBar } from '@/components/dashboard/DashboardTicketBar';
import { CompanyBreakdownTable } from '@/components/dashboard/CompanyBreakdownTable';
import { SellerCard } from '@/components/dashboard/SellerCard';
import { SellerGoalChart } from '@/components/dashboard/SellerGoalChart';
import { HistoricalChart } from '@/components/dashboard/HistoricalChart';
import {
  useDashboardKpis,
  useDashboardProjections,
  useDashboardBreakdownByCompany,
  useDashboardBreakdownBySeller,
  useDashboardGoals,
  useUpsertGoal,
  useDeleteGoal,
  useVendorGoals,
  useUpsertVendorGoal,
  useDeleteVendorGoal,
  useVendedores,
} from '@/hooks/use-dashboard-query';
import type { DashboardQueryParams, ApiGoal, ApiVendorGoal } from '@/hooks/use-dashboard-query';
import type { DashboardFilters } from '@/store/DashboardFilterStore';
import { LOJA_IDS, VENDEDOR_IDS } from '@/api/storeConfig';

type CompanyKey = 'all' | 'Lucky Store' | 'BTech' | 'AJJ';
const COMPANIES: CompanyKey[] = ['all', 'Lucky Store', 'BTech', 'AJJ'];

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SECTION_LABELS: Record<string, string> = { geral: 'Geral', vendas: 'Vendas', ticket: 'Ticket', meta: 'Meta' };

function toApiParams(filters: DashboardFilters, company: CompanyKey): DashboardQueryParams {
  const useRange = !!(filters.rangeFrom && filters.rangeTo);
  return {
    mes:         useRange ? undefined : filters.month + 1,
    ano:         useRange ? undefined : filters.year,
    data_inicio: useRange ? format(filters.rangeFrom!, 'yyyy-MM-dd') : undefined,
    data_fim:    useRange ? format(filters.rangeTo!,   'yyyy-MM-dd') : undefined,
    id_loja:     company !== 'all' ? (LOJA_IDS[company] || undefined) : undefined,
  };
}

// ─── Goals Modal ──────────────────────────────────────────────────────────────

const COMPANY_DOT: Record<string, string> = {
  'Lucky Store': 'bg-green-500',
  'BTech':       'bg-blue-500',
  'AJJ':         'bg-amber-500',
};
const VENDOR_COLORS = ['bg-purple-500', 'bg-amber-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500'];

function GoalsModal({ open, onClose, year, month }: {
  open: boolean; onClose: () => void; year: number; month: number;
}) {
  const [goalTab, setGoalTab] = useState<'empresa' | 'vendedor'>('empresa');
  const [ano, setAno] = useState(year);
  const [mes, setMes] = useState(month + 1);
  const [companyName, setCompanyName]   = useState('Lucky Store');
  const [vendedorId, setVendedorId]     = useState('');
  const [target, setTarget]             = useState(0);
  const [floor, setFloor]               = useState(0);
  const [editingId, setEditingId]       = useState<string | null>(null);

  const companyOptions = ['Lucky Store', 'BTech', 'AJJ'];

  const { data: goalsData,       isLoading: goalsLoading }       = useDashboardGoals();
  const { data: vendorGoalsData, isLoading: vendorGoalsLoading } = useVendorGoals();
  const { data: vendedoresData }                                  = useVendedores();
  const companyGoals = goalsData?.items       ?? [];
  const vendorGoals  = vendorGoalsData?.items ?? [];
  const vendedores   = vendedoresData?.items  ?? [];

  const upsertCompany = useUpsertGoal();
  const deleteCompany = useDeleteGoal();
  const upsertVendor  = useUpsertVendorGoal();
  const deleteVendor  = useDeleteVendorGoal();

  // Initialise vendedorId to first available seller
  useEffect(() => {
    if (goalTab === 'vendedor' && !vendedorId && vendedores.length > 0) {
      setVendedorId(vendedores[0].id);
    }
  }, [goalTab, vendedorId, vendedores]);

  const resetForm = () => { setTarget(0); setFloor(0); setEditingId(null); };

  const save = () => {
    if (goalTab === 'empresa') {
      const id_loja = LOJA_IDS[companyName];
      if (!id_loja) { toast.error('ID da loja não configurado'); return; }
      upsertCompany.mutate(
        { ano, mes, id_loja, target, floor: floor || null },
        { onSuccess: resetForm, onError: () => toast.error('Erro ao salvar meta') },
      );
    } else {
      if (!vendedorId) { toast.error('Selecione um vendedor'); return; }
      upsertVendor.mutate(
        { ano, mes, id_vendedor: vendedorId, target, floor: floor || null },
        { onSuccess: resetForm, onError: () => toast.error('Erro ao salvar meta') },
      );
    }
  };

  const loadCompanyGoal = (g: ApiGoal) => {
    setAno(g.ano); setMes(g.mes);
    setCompanyName(g.nome_loja ?? 'Lucky Store');
    setTarget(Number(g.target)); setFloor(Number(g.floor ?? 0));
    setEditingId(g.id);
  };

  const loadVendorGoal = (g: ApiVendorGoal) => {
    setAno(g.ano); setMes(g.mes);
    setVendedorId(g.id_vendedor);
    setTarget(Number(g.target)); setFloor(Number(g.floor ?? 0));
    setEditingId(g.id);
  };

  const isPending = upsertCompany.isPending || upsertVendor.isPending;

  const switchTab = (tab: 'empresa' | 'vendedor') => {
    setGoalTab(tab);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Configurar Metas</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {goalTab === 'empresa'
              ? 'Defina a meta de faturamento por empresa.'
              : 'Defina a meta de faturamento por vendedor.'}
          </p>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="inline-flex gap-2">
          <button
            onClick={() => switchTab('empresa')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all',
              goalTab === 'empresa'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Building2 className="h-4 w-4" /> Empresa
          </button>
          <button
            onClick={() => switchTab('vendedor')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all',
              goalTab === 'vendedor'
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <User className="h-4 w-4" /> Vendedor
          </button>
        </div>

        <div className="space-y-4">
          {/* Row 1: selector + mes + ano */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{goalTab === 'empresa' ? 'Empresa' : 'Vendedor'}</Label>
              {goalTab === 'empresa' ? (
                <Select value={companyName} onValueChange={setCompanyName}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {companyOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={vendedorId} onValueChange={setVendedorId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(mes)} onValueChange={v => setMes(+v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((nm, i) => <SelectItem key={i} value={String(i + 1)}>{nm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={ano} onChange={e => setAno(+e.target.value || ano)} />
            </div>
          </div>

          {/* Row 2: target + floor currency inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor da Meta</Label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground pointer-events-none">R$</span>
                <Input type="number" className="pl-8" placeholder="0" value={target || ''} onChange={e => setTarget(+e.target.value || 0)} />
              </div>
            </div>
            <div>
              <Label>Piso da Meta</Label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground pointer-events-none">R$</span>
                <Input type="number" className="pl-8" placeholder="0" value={floor || ''} onChange={e => setFloor(+e.target.value || 0)} />
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {editingId ? 'Atualizar Meta' : 'Salvar Meta'}
          </Button>

          {/* Registered goals list */}
          <div className="border-t pt-4 space-y-2">
            <h4 className="text-lg font-bold">Metas registradas</h4>
            <p className="text-xs text-muted-foreground">Clique no lápis para editar ou em excluir para remover.</p>

            {goalTab === 'empresa' ? (
              goalsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : companyGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Mês/Ano</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Meta</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Piso</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyGoals.map(g => (
                      <TableRow key={g.id} className={cn(editingId === g.id && 'bg-secondary/10')}>
                        <TableCell>{MONTHS[g.mes - 1]}/{g.ano}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold">
                            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', COMPANY_DOT[g.nome_loja ?? ''] ?? 'bg-muted-foreground')} />
                            {g.nome_loja ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-green-700 font-semibold">{BRL(Number(g.target))}</TableCell>
                        <TableCell>{g.floor != null ? BRL(Number(g.floor)) : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => loadCompanyGoal(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={deleteCompany.isPending} onClick={() => {
                              deleteCompany.mutate(g.id);
                              if (editingId === g.id) resetForm();
                            }}>Excluir</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              vendorGoalsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : vendorGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Mês/Ano</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Vendedor</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Meta</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Piso</TableHead>
                      <TableHead className="text-xs uppercase tracking-wide text-muted-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorGoals.map((g, idx) => (
                      <TableRow key={g.id} className={cn(editingId === g.id && 'bg-secondary/10')}>
                        <TableCell>{MONTHS[g.mes - 1]}/{g.ano}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-semibold">
                            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', VENDOR_COLORS[idx % VENDOR_COLORS.length])} />
                            {g.nome_vendedor ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-green-700 font-semibold">{BRL(Number(g.target))}</TableCell>
                        <TableCell>{g.floor != null ? BRL(Number(g.floor)) : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => loadVendorGoal(g)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="destructive" disabled={deleteVendor.isPending} onClick={() => {
                              deleteVendor.mutate(g.id);
                              if (editingId === g.id) resetForm();
                            }}>Excluir</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { filters: globalFilters, setFilters: setGlobalFilters, mode, section } = useDashboardFilters();

  const [company, setCompany] = useState<CompanyKey>('all');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateTab, setDateTab] = useState<'data' | 'periodo'>('data');

  const params = useMemo(
    () => toApiParams(globalFilters, company),
    [globalFilters, company]
  );

  const prevMonth = () => setGlobalFilters(f => {
    const d = new Date(f.year, f.month - 1, 1);
    return { ...f, month: d.getMonth(), year: d.getFullYear(), rangeFrom: undefined, rangeTo: undefined };
  });
  const nextMonth = () => setGlobalFilters(f => {
    const d = new Date(f.year, f.month + 1, 1);
    return { ...f, month: d.getMonth(), year: d.getFullYear(), rangeFrom: undefined, rangeTo: undefined };
  });

  const { data: kpis,      isLoading: kpisLoading,      isError: kpisError }      = useDashboardKpis(params);
  const { data: proj,      isLoading: projLoading,      isError: projError }      = useDashboardProjections(params);
  const { data: byCompany, isLoading: byCompanyLoading, isError: byCompanyError } = useDashboardBreakdownByCompany(params);
  const { data: bySeller,  isLoading: bySellerLoading,  isError: bySellerError }  = useDashboardBreakdownBySeller(params);

  useEffect(() => {
    if (kpisError || projError || byCompanyError || bySellerError) {
      toast.error('Erro ao carregar dados do dashboard');
    }
  }, [kpisError, projError, byCompanyError, bySellerError]);

  const { data: vendorGoalsData } = useVendorGoals({
    ano: globalFilters.year,
    mes: globalFilters.month + 1,
  });

  const vendorGoalsForPeriod = vendorGoalsData?.items ?? [];

  // Calendar arithmetic for seller projections
  const { diasNoMes, diasDecorridos } = useMemo(() => {
    const ano = globalFilters.year;
    const mes = globalFilters.month;
    const total = new Date(ano, mes + 1, 0).getDate();
    const hoje = new Date();
    const ehMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;
    return { diasNoMes: total, diasDecorridos: ehMesAtual ? hoje.getDate() : total };
  }, [globalFilters.year, globalFilters.month]);

  // Derived financial values
  const ganhosFinanceiros = 0; // mocked — backend não suporta ainda
  const gastosFixos       = kpis?.outros_custos ?? 0;
  const lucroBruto        = kpis?.lucro ?? 0;
  const lucroLiquido      = lucroBruto + ganhosFinanceiros - gastosFixos;
  const receita           = kpis?.receita ?? 0;
  const margemLiquida     = receita > 0 ? lucroLiquido / receita : 0;

  // Seller items: always show all known sellers (from VENDEDOR_IDS), even when the
  // breakdown endpoint returns an empty array (no orders in period). Real data
  // overwrites the zero-baseline when it exists.
  const sellerItems = useMemo(() => {
    const realItems = bySeller?.items ?? [];
    const knownSellers = Object.entries(VENDEDOR_IDS).filter(([, id]) => id !== '');

    // No sellers configured in env → just use whatever the API returns
    if (knownSellers.length === 0) return realItems;

    const realByName = new Map(realItems.map(i => [i.nome, i]));

    return knownSellers.map(([nome, id_vendedor]) =>
      realByName.get(nome) ?? {
        id_vendedor,
        nome,
        receita: 0, custo: 0, lucro: 0, margem: 0,
        num_pedidos: 0, num_cancelamentos: 0, valor_cancelamentos: 0,
        ticket_venda: 0, ticket_custo: 0, ticket_lucro: 0,
      }
    );
  }, [bySeller?.items]);

  // Per-seller vendor goal lookup keyed by id_vendedor
  const vendorGoalByVendedor = useMemo(() => {
    const map: Record<string, typeof vendorGoalsForPeriod[number]> = {};
    for (const g of vendorGoalsForPeriod) {
      map[g.id_vendedor] = g;
    }
    return map;
  }, [vendorGoalsForPeriod]);

  // Goals shaped for SellerGoalChart
  const sellerGoalChartData = useMemo(() => {
    const result: Record<string, { alvo: number; piso: number }> = {};
    for (const g of vendorGoalsForPeriod) {
      result[g.id_vendedor] = { alvo: Number(g.target), piso: Number(g.floor ?? 0) };
    }
    return result;
  }, [vendorGoalsForPeriod]);

  // ─── Date picker (shared) ──────────────────────────────────────────────────
  const datePicker = (
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
  );

  // ─── Filter row ────────────────────────────────────────────────────────────
  const filterRow = (
    <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      {/* Company tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setCompany('all')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            company === 'all'
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Geral
          <span className="text-[10px] bg-muted px-1 rounded ml-0.5">3</span>
        </button>
        {(['Lucky Store', 'BTech', 'AJJ'] as CompanyKey[]).map(c => (
          <button
            key={c}
            onClick={() => setCompany(c)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              company === c
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', COMPANY_DOT[c])} />
            {c}
          </button>
        ))}
      </div>

      {/* Date picker */}
      {datePicker}

      {/* Configurar Metas */}
      <Button onClick={() => setGoalsOpen(true)} className="gap-1.5 shrink-0">
        <Target className="h-4 w-4" /> Configurar Metas
      </Button>
    </div>
  );

  // ─── Breadcrumb ─────────────────────────────────────────────────────────────
  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-sm flex-wrap">
      <span className="text-muted-foreground">Exibindo</span>
      <span className="font-semibold">{SECTION_LABELS[section] ?? section}</span>
      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Empresa</span>
      {company !== 'all' && <span className="font-semibold">{company}</span>}
      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-semibold">{MONTHS[globalFilters.month]}/{globalFilters.year}</span>
    </div>
  );

  // ─── Skeleton loader ────────────────────────────────────────────────────────
  const kpiSkeleton = (count: number) => (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-muted" />
      ))}
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── EMPRESA MODE ────────────────────────────────────────────────────── */}
      {mode === 'company' && (
        <>
          {filterRow}
          {breadcrumb}

          {section === 'geral' ? (
            <div className="space-y-6">

              {/* RESUMO DO MÊS */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resumo do Mês</p>
                {kpisLoading ? kpiSkeleton(4) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      label="Total de Pedidos"
                      value={String(kpis?.num_pedidos ?? 0)}
                      sub={`${(kpis?.num_pedidos ?? 0) - (kpis?.num_cancelamentos ?? 0)} concluídos · ${kpis?.num_cancelamentos ?? 0} cancelado${(kpis?.num_cancelamentos ?? 0) !== 1 ? 's' : ''}`}
                      accent="text-secondary"
                      borderAccent="border-l-4 border-l-green-500"
                    />
                    <KpiCard
                      label="Cancelamentos"
                      value={String(kpis?.num_cancelamentos ?? 0)}
                      sub={`Perda de ${BRL(kpis?.valor_cancelamentos ?? 0)}`}
                      accent="text-orange-500"
                      borderAccent="border-l-4 border-l-amber-500"
                    />
                    <KpiCard
                      label="Faturamento do Mês"
                      value={BRL(kpis?.receita ?? 0)}
                      sub={
                        proj?.pct_meta != null
                          ? `${PCT(proj.pct_meta)} da meta · Hoje: ${BRL(kpis?.receita_hoje ?? 0)}`
                          : `Hoje: ${BRL(kpis?.receita_hoje ?? 0)}`
                      }
                      accent="text-green-700"
                      borderAccent="border-l-4 border-l-green-500"
                    />
                    <KpiCard
                      label="Ticket Médio"
                      value={BRL(kpis?.ticket_venda ?? 0)}
                      sub="Por pedido concluído"
                      accent="text-secondary"
                      borderAccent="border-l-4 border-l-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* RESULTADO FINANCEIRO */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Resultado Financeiro</p>
                {kpisLoading ? kpiSkeleton(4) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      label="Faturamento Total"
                      value={BRL(kpis?.receita ?? 0)}
                      sub="Receita bruta do período"
                      accent="text-green-700"
                    />
                    <KpiCard
                      label="Custo Total"
                      value={BRL(kpis?.custo ?? 0)}
                      sub="Custo das vendas"
                      accent="text-red-600"
                    />
                    <KpiCard
                      label="Lucro Bruto"
                      value={BRL(lucroBruto)}
                      sub="Faturamento – Custo"
                      accent={lucroBruto >= 0 ? 'text-green-700' : 'text-red-600'}
                      badge="= calculado"
                    />
                    {/* Lucro Líquido — col 4 rows 1-2 no desktop, card normal no mobile */}
                    <div className="md:row-span-2 rounded-xl bg-secondary text-secondary-foreground p-5 flex flex-col justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Lucro Líquido</p>
                      <p className="text-3xl font-bold leading-tight my-2">{BRL(lucroLiquido)}</p>
                      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-xs opacity-80">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                          Lucro bruto
                        </span>
                        <span>+</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                          Ganhos
                        </span>
                        <span>–</span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                          Fixos
                        </span>
                      </div>
                    </div>
                    <KpiCard
                      label="Ganhos Financeiros"
                      value={BRL(ganhosFinanceiros)}
                      sub="Multas + Juros"
                      accent="text-blue-700"
                    />
                    <KpiCard
                      label="Gastos Fixos"
                      value={BRL(gastosFixos)}
                      sub="Despesas registradas"
                      accent="text-orange-500"
                    />
                    <KpiCard
                      label="Margem Líquida"
                      value={PCT(margemLiquida)}
                      sub="Lucro líquido / Faturamento"
                    />
                  </div>
                )}
              </div>

              <DashboardPieChart
                impostoCompra={kpis?.imposto_compra ?? 0}
                impostoVenda={kpis?.imposto_venda ?? 0}
                outrosCustos={kpis?.outros_custos ?? 0}
              />
              <HistoricalChart params={params} />

            </div>
          ) : (
            <>
              {kpisLoading ? kpiSkeleton(3) : (
                <>
                  {/* ── VENDAS ── */}
                  {section === 'vendas' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <KpiCard label="Pedidos" value={String(kpis?.num_pedidos ?? 0)} />
                      <KpiCard label="Margem" value={PCT(kpis?.margem ?? 0)} />
                      <KpiCard
                        label="Cancelamentos"
                        value={String(kpis?.num_cancelamentos ?? 0)}
                        sub={`Perda: ${BRL(kpis?.valor_cancelamentos ?? 0)}`}
                        accent="text-red-600"
                      />
                    </div>
                  )}

                  {/* ── TICKET ── */}
                  {section === 'ticket' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <KpiCard label="Ticket Custo" value={BRL(kpis?.ticket_custo ?? 0)} accent="text-red-600" />
                        <KpiCard label="Ticket Venda" value={BRL(kpis?.ticket_venda ?? 0)} accent="text-green-700" />
                        <KpiCard label="Ticket Lucro" value={BRL(kpis?.ticket_lucro ?? 0)} accent={(kpis?.ticket_lucro ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'} />
                      </div>
                      <DashboardTicketBar
                        ticketCusto={kpis?.ticket_custo ?? 0}
                        ticketVenda={kpis?.ticket_venda ?? 0}
                        ticketLucro={kpis?.ticket_lucro ?? 0}
                      />
                    </div>
                  )}

                  {/* ── META ── */}
                  {section === 'meta' && (
                    <div className="space-y-3">
                      {/* Row 1: metas cadastradas */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KpiCard
                          label="Meta (Alvo)"
                          value={proj?.meta_target != null ? BRL(proj.meta_target) : '—'}
                          sub="Target cadastrado"
                          accent="text-green-700"
                          borderAccent="border-l-4 border-l-green-500"
                        />
                        <KpiCard
                          label="Meta (Piso)"
                          value={proj?.meta_floor != null ? BRL(proj.meta_floor) : '—'}
                          sub="Floor cadastrado"
                          accent="text-amber-600"
                          borderAccent="border-l-4 border-l-amber-500"
                        />
                        <KpiCard
                          label="% da Meta"
                          value={proj?.pct_meta != null ? PCT(proj.pct_meta) : '—'}
                          sub={`Faturamento: ${BRL(kpis?.receita ?? 0)}`}
                          accent={(proj?.pct_meta ?? 0) >= 1 ? 'text-green-700' : 'text-orange-600'}
                          borderAccent={(proj?.pct_meta ?? 0) >= 1 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-orange-400'}
                        />
                        <KpiCard
                          label="Gap para Alvo"
                          value={proj?.gap_target != null ? BRL(proj.gap_target) : '—'}
                          sub={proj?.gap_target === 0 ? 'Meta atingida!' : undefined}
                          accent={proj?.gap_target === 0 ? 'text-green-700' : 'text-orange-600'}
                        />
                      </div>
                      {/* Row 2: projeção e meta dinâmica */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <KpiCard
                          label="Projeção do Mês"
                          value={BRL(proj?.projecao_mes ?? 0)}
                          sub={`Média/dia: ${BRL(proj?.media_diaria ?? 0)}`}
                          accent="text-secondary"
                        />
                        <KpiCard
                          label="Gap para Piso"
                          value={proj?.gap_floor != null ? BRL(proj.gap_floor) : '—'}
                          sub={proj?.gap_floor === 0 ? 'Piso atingido!' : undefined}
                          accent={proj?.gap_floor === 0 ? 'text-green-700' : 'text-orange-500'}
                        />
                        <KpiCard
                          label="Meta Diária Dinâmica"
                          value={proj?.meta_diaria_dinamica != null ? BRL(proj.meta_diaria_dinamica) : '—'}
                          sub={`${proj?.dias_uteis_restantes ?? 0} dia(s) úteis restantes`}
                          accent="text-blue-700"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── VENDEDOR MODE ───────────────────────────────────────────────────── */}
      {mode === 'seller' && (
        <div className="space-y-4">
          {/* Seller filter row */}
          <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            {datePicker}
            <Button onClick={() => setGoalsOpen(true)} className="gap-1.5 shrink-0">
              <Target className="h-4 w-4" /> Configurar Metas
            </Button>
          </div>

          <h3 className="text-lg font-semibold text-secondary">Performance por Vendedor</h3>

          {bySellerLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-72 rounded-lg bg-muted" />
              ))}
            </div>
          ) : sellerItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado para o período selecionado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sellerItems.map(item => {
                const goal = vendorGoalByVendedor[item.id_vendedor];
                const projecao = diasDecorridos > 0
                  ? (item.receita / diasDecorridos) * diasNoMes
                  : item.receita;
                return (
                  <SellerCard
                    key={item.id_vendedor || item.nome}
                    item={item}
                    metaDiaria={goal ? Number(goal.target) / diasNoMes : null}
                    gapMeta={goal ? Number(goal.target) - item.receita : null}
                    projecaoMes={projecao}
                    hasGoal={goal != null}
                  />
                );
              })}
            </div>
          )}

          {/* Vendas vs Meta por Vendedor */}
          <SellerGoalChart items={sellerItems} goals={sellerGoalChartData} />
        </div>
      )}

      <GoalsModal
        open={goalsOpen} onClose={() => setGoalsOpen(false)}
        year={globalFilters.year} month={globalFilters.month}
      />
    </div>
  );
}
