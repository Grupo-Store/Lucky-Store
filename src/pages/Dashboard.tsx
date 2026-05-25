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
import { Target, Pencil, CalendarIcon } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDashboardFilters } from '@/store/DashboardFilterStore';
import { toast } from 'sonner';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { DashboardPieChart } from '@/components/dashboard/DashboardPieChart';
import { DashboardTicketBar } from '@/components/dashboard/DashboardTicketBar';
import { CompanyBreakdownTable } from '@/components/dashboard/CompanyBreakdownTable';
import { SellerBreakdownTable } from '@/components/dashboard/SellerBreakdownTable';
import {
  useDashboardKpis,
  useDashboardProjections,
  useDashboardBreakdownByCompany,
  useDashboardBreakdownBySeller,
  useDashboardGoals,
  useUpsertGoal,
  useDeleteGoal,
} from '@/hooks/use-dashboard-query';
import type { DashboardQueryParams, ApiGoal } from '@/hooks/use-dashboard-query';
import type { DashboardFilters } from '@/store/DashboardFilterStore';
import { LOJA_IDS } from '@/api/storeConfig';

type CompanyKey = 'all' | 'Lucky Store' | 'BTech' | 'AJJ';
const COMPANIES: CompanyKey[] = ['all', 'Lucky Store', 'BTech', 'AJJ'];

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function GoalsModal({ open, onClose, year, month }: {
  open: boolean; onClose: () => void; year: number; month: number;
}) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month + 1);
  const [companyName, setCompanyName] = useState('Lucky Store');
  const [target, setTarget] = useState(0);
  const [floor, setFloor] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: goalsData, isLoading: goalsLoading } = useDashboardGoals();
  const goals = goalsData?.items ?? [];
  const upsert = useUpsertGoal();
  const del = useDeleteGoal();

  const companyOptions = [
    { value: 'Lucky Store', label: 'Lucky Store' },
    { value: 'BTech', label: 'BTech' },
    { value: 'AJJ', label: 'AJJ' },
  ];

  const resetForm = () => { setTarget(0); setFloor(0); setEditingId(null); };

  const save = () => {
    const id_loja = LOJA_IDS[companyName];
    if (!id_loja) { toast.error('ID da loja não configurado'); return; }
    upsert.mutate(
      { ano: y, mes: m, id_loja, target, floor: floor || null },
      { onSuccess: resetForm, onError: () => toast.error('Erro ao salvar meta') },
    );
  };

  const loadForEdit = (g: ApiGoal) => {
    setY(g.ano);
    setM(g.mes);
    setCompanyName(g.nome_loja ?? companyOptions[0].value);
    setTarget(Number(g.target));
    setFloor(Number(g.floor ?? 0));
    setEditingId(g.id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Editar Meta' : 'Configurar Metas'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Empresa</Label>
              <Select value={companyName} onValueChange={setCompanyName}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companyOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
            <Button onClick={save} disabled={upsert.isPending} className="flex-1">
              {editingId ? 'Atualizar Meta' : 'Salvar Meta'}
            </Button>
            {editingId && <Button variant="outline" onClick={resetForm}>Cancelar Edição</Button>}
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Metas registradas</h4>
            <p className="text-xs text-muted-foreground mb-2">Clique em uma meta para editá-la.</p>
            {goalsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês/Ano</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Piso</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goals.map(g => (
                    <TableRow
                      key={g.id}
                      className={cn('cursor-pointer hover:bg-muted/50', editingId === g.id && 'bg-secondary/10')}
                      onClick={() => loadForEdit(g)}
                    >
                      <TableCell>{MONTHS[g.mes - 1]}/{g.ano}</TableCell>
                      <TableCell>{g.nome_loja ?? '—'}</TableCell>
                      <TableCell>{BRL(Number(g.target))}</TableCell>
                      <TableCell>{g.floor != null ? BRL(Number(g.floor)) : '—'}</TableCell>
                      <TableCell className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => loadForEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" disabled={del.isPending} onClick={() => {
                          del.mutate(g.id);
                          if (editingId === g.id) resetForm();
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
  const { filters: globalFilters, setFilters: setGlobalFilters, mode, section } = useDashboardFilters();

  const [company, setCompany] = useState<CompanyKey>('all');
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateTab, setDateTab] = useState<'data' | 'periodo'>('data');

  const params = useMemo(
    () => toApiParams(globalFilters, company),
    [globalFilters, company]
  );

  const { data: kpis,      isLoading: kpisLoading,      isError: kpisError }      = useDashboardKpis(params);
  const { data: proj,      isLoading: projLoading,      isError: projError }      = useDashboardProjections(params);
  const { data: byCompany, isLoading: byCompanyLoading, isError: byCompanyError } = useDashboardBreakdownByCompany(params);
  const { data: bySeller,  isLoading: bySellerLoading,  isError: bySellerError }  = useDashboardBreakdownBySeller(params);

  useEffect(() => {
    if (kpisError || projError || byCompanyError || bySellerError) {
      toast.error('Erro ao carregar dados do dashboard');
    }
  }, [kpisError, projError, byCompanyError, bySellerError]);

  return (
    <div className="space-y-4">
      {mode === 'company' && (
        <>
          <div className="relative flex items-center justify-between gap-3 flex-wrap">
            <div className="shrink-0">
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
            </div>

            <div className="order-3 lg:order-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 mx-auto">
              <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
                {COMPANIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCompany(c)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all',
                      company === c
                        ? 'bg-secondary text-secondary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {c === 'all' ? 'Geral' : c}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-2 lg:order-3 shrink-0">
              <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
                <Target className="h-4 w-4" /> Configurar Metas
              </Button>
            </div>
          </div>

          {kpisLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <>
              {section === 'geral' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <KpiCard label="Faturamento" value={BRL(kpis?.receita ?? 0)} sub={`Hoje: ${BRL(kpis?.receita_hoje ?? 0)}`} accent="text-green-700" />
                    <KpiCard label="Lucro" value={BRL(kpis?.lucro ?? 0)} accent={(kpis?.lucro ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'} />
                    <KpiCard label="Margem" value={PCT(kpis?.margem ?? 0)} />
                    <KpiCard label="Pedidos" value={String(kpis?.num_pedidos ?? 0)} />
                    <KpiCard label="Cancelamentos" value={String(kpis?.num_cancelamentos ?? 0)} sub={`Perda: ${BRL(kpis?.valor_cancelamentos ?? 0)}`} accent="text-red-600" />
                  </div>
                  <CompanyBreakdownTable items={byCompany?.items ?? []} loading={byCompanyLoading} />
                  <DashboardPieChart impostoCompra={kpis?.imposto_compra ?? 0} impostoVenda={kpis?.imposto_venda ?? 0} outrosCustos={kpis?.outros_custos ?? 0} />
                </div>
              )}

              {section === 'vendas' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard label="Pedidos" value={String(kpis?.num_pedidos ?? 0)} />
                  <KpiCard label="Margem" value={PCT(kpis?.margem ?? 0)} />
                  <KpiCard label="Cancelamentos" value={String(kpis?.num_cancelamentos ?? 0)} sub={`Perda: ${BRL(kpis?.valor_cancelamentos ?? 0)}`} accent="text-red-600" />
                </div>
              )}

              {section === 'ticket' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <KpiCard label="Ticket Custo"  value={BRL(kpis?.ticket_custo ?? 0)} accent="text-red-600" />
                    <KpiCard label="Ticket Venda"  value={BRL(kpis?.ticket_venda ?? 0)} accent="text-green-700" />
                    <KpiCard label="Ticket Lucro"  value={BRL(kpis?.ticket_lucro ?? 0)} accent={(kpis?.ticket_lucro ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'} />
                  </div>
                  <DashboardTicketBar ticketCusto={kpis?.ticket_custo ?? 0} ticketVenda={kpis?.ticket_venda ?? 0} ticketLucro={kpis?.ticket_lucro ?? 0} />
                </div>
              )}

              {section === 'meta' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard label="% Meta" value={proj?.pct_meta != null ? PCT(proj.pct_meta) : '—'} accent={(proj?.pct_meta ?? 0) >= 1 ? 'text-green-700' : undefined} />
                  <KpiCard label="Projeção" value={BRL(proj?.projecao_mes ?? 0)} sub={`Média/dia: ${BRL(proj?.media_diaria ?? 0)}`} />
                  <KpiCard label="Gap para Meta" value={proj?.gap_target != null ? BRL(proj.gap_target) : '—'} accent="text-orange-600" />
                  <KpiCard label="Meta Diária Dinâmica" value={proj?.meta_diaria_dinamica != null ? BRL(proj.meta_diaria_dinamica) : '—'} sub={`${proj?.dias_uteis_restantes ?? 0} dia(s) úteis restantes`} accent="text-blue-700" />
                </div>
              )}
            </>
          )}
        </>
      )}

      {mode === 'seller' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setGoalsOpen(true)} className="gap-1.5">
              <Target className="h-4 w-4" /> Configurar Metas
            </Button>
          </div>
          <h3 className="text-lg font-semibold text-secondary">Performance por Vendedor</h3>
          <SellerBreakdownTable items={bySeller?.items ?? []} loading={bySellerLoading} />
        </div>
      )}

      <GoalsModal
        open={goalsOpen} onClose={() => setGoalsOpen(false)}
        year={globalFilters.year} month={globalFilters.month}
      />
    </div>
  );
}
