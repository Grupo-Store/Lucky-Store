import { useState, useMemo, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, ArrowDown, Plus, Search, X, AlertTriangle } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useOrders, Order, OrderItem, OrderStatus, ItemStatus,
  ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ITEM_STATUS_COLORS,
  WARN_STATUSES, isOpenOrder, calcTotal, calcItemLatestDelivery,
  RMA_STATUS_LABELS, RMA_STATUS_COLORS, calcRmaParentStatus,
} from '@/store/OrderStore';
import {
  useQuotes, Quote, QuotePhaseKey, QUOTE_PHASE_LABELS, QUOTE_PHASE_COLORS,
  getHighestPhase, getPhaseDate,
} from '@/store/QuoteStore';
import { OrderModal } from '@/components/OrderModal';
import { ProductModal } from '@/components/ProductModal';
import { QuoteModal } from '@/components/QuoteModal';
import { RmaModal } from '@/components/RmaModal';
import { DateFilter, DateRange } from '@/components/DateFilter';
import { Pagination, PAGE_SIZE } from '@/components/Pagination';

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'To Buy': 'A Comprar', 'Bought': 'Comprado', 'In Stock': 'Em Estoque',
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}

/* ============================================================
 * Search bar (memoized)
 * ============================================================ */
const SearchBar = memo(({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="pl-9 w-72 bg-white"
    />
  </div>
));
SearchBar.displayName = 'SearchBar';

/* ============================================================
 * Helpers
 * ============================================================ */
function isInRange(iso: string, range: DateRange): boolean {
  if (!range.from) return true;
  const d = new Date(iso + 'T12:00:00');
  const from = new Date(range.from); from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : new Date(range.from);
  to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

function shouldWarnDelivery(o: Order): boolean {
  if (!WARN_STATUSES.includes(o.status)) return false;
  const days = differenceInCalendarDays(new Date(o.deliveryDate + 'T12:00:00'), new Date());
  return days <= 3;
}

type SortField = 'os' | 'deliveryDate';
type SortDir = 'asc' | 'desc';

export default function Sales() {
  const { orders, addOrder, updateOrder, deleteOrder, updateItemStatus, nextOS, nextRmaNumber } = useOrders();
  const { quotes, addQuote, updateQuote, deleteQuote, nextIndex } = useQuotes();
  const [tab, setTab] = useState('orders');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalCtx, setProductModalCtx] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [rmaModalOpen, setRmaModalOpen] = useState(false);
  const [editRma, setEditRma] = useState<Order | null>(null);

  /* ---------- Orders tab state ---------- */
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateField, setOrderDateField] = useState<'orderDate' | 'deliveryDate'>('deliveryDate');
  const [orderRange, setOrderRange] = useState<DateRange>({});
  const [orderView, setOrderView] = useState<'all' | 'open' | 'rma'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderAlertsOnly, setOrderAlertsOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [orderPage, setOrderPage] = useState(1);

  /* ---------- Products tab state ---------- */
  const [prodSearch, setProdSearch] = useState('');
  const [prodDateField, setProdDateField] = useState<'order' | 'product'>('order');
  const [prodRange, setProdRange] = useState<DateRange>({});
  const [prodAlertsOnly, setProdAlertsOnly] = useState(false);
  const [prodStatusFilter, setProdStatusFilter] = useState<string>('all');
  const [prodPage, setProdPage] = useState(1);

  /* ---------- Quotes tab state ---------- */
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteDateField, setQuoteDateField] = useState<'requestDate' | 'phaseDate'>('requestDate');
  const [quoteRange, setQuoteRange] = useState<DateRange>({});
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('all');
  const [quotePage, setQuotePage] = useState(1);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  /* ---------- Orders filter ---------- */
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    let list = [...orders];
    if (orderView === 'open') list = list.filter(o => isOpenOrder(o.status));
    if (orderView === 'rma') list = list.filter(o => o.isRMA);
    else if (orderView === 'all') {
      // 'all' shows everything (including RMAs)
    }
    if (orderStatusFilter !== 'all') list = list.filter(o => o.status === orderStatusFilter);
    if (orderAlertsOnly) list = list.filter(o => shouldWarnDelivery(o));
    if (q) list = list.filter(o =>
      o.os.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.cnpj.toLowerCase().includes(q) ||
      (o.company || '').toLowerCase().includes(q) ||
      (o.seller || '').toLowerCase().includes(q)
    );
    list = list.filter(o => isInRange(o[orderDateField], orderRange));
    if (sortField) {
      list.sort((a, b) => {
        const cmp = sortField === 'os'
          ? a.os.localeCompare(b.os, undefined, { numeric: true })
          : a.deliveryDate.localeCompare(b.deliveryDate);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      // Default: newest created on top
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return list;
  }, [orders, orderSearch, orderView, orderStatusFilter, orderAlertsOnly, orderDateField, orderRange, sortField, sortDir]);

  const orderPageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = useMemo(
    () => filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE),
    [filteredOrders, orderPage]
  );

  /* ---------- Quotes ---------- */
  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.toLowerCase().trim();
    const list = quotes.filter(qt => {
      const highest = getHighestPhase(qt);
      if (quoteStatusFilter !== 'all' && highest !== quoteStatusFilter) return false;
      if (q && !(
        qt.index.toLowerCase().includes(q) ||
        qt.customer.toLowerCase().includes(q) ||
        qt.requestNumber.toLowerCase().includes(q) ||
        (qt.company || '').toLowerCase().includes(q) ||
        (qt.seller || '').toLowerCase().includes(q) ||
        (qt.directBilling ? 'sim faturamento direto' : 'não nao').includes(q)
      )) return false;
      const dateIso = quoteDateField === 'requestDate' ? qt.requestDate : (getPhaseDate(qt) || '');
      if (quoteRange.from && !dateIso) return false;
      return isInRange(dateIso, quoteRange);
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [quotes, quoteSearch, quoteStatusFilter, quoteDateField, quoteRange]);

  const quotePageCount = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const pagedQuotes = useMemo(
    () => filteredQuotes.slice((quotePage - 1) * PAGE_SIZE, quotePage * PAGE_SIZE),
    [filteredQuotes, quotePage]
  );

  /* ---------- Products ---------- */
  const products = useMemo(() => {
    const q = prodSearch.toLowerCase().trim();
    const list = orders
      .filter(o => isOpenOrder(o.status))
      .flatMap(o => o.items.map(item => ({
        ...item,
        orderId: o.id,
        os: o.os,
        customer: o.customer,
        company: o.company,
        seller: o.seller,
        orderDeliveryDate: o.deliveryDate,
        productDeliveryDate: calcItemLatestDelivery(item),
        createdAt: o.createdAt,
      })))
      .filter(p => !q || (
        p.os.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.seller || '').toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      ))
      .filter(p => prodStatusFilter === 'all' || p.status === prodStatusFilter)
      .filter(p => {
        const dateIso = prodDateField === 'order' ? p.orderDeliveryDate : (p.productDeliveryDate || p.orderDeliveryDate);
        return isInRange(dateIso, prodRange);
      })
      .filter(p => {
        if (!prodAlertsOnly) return true;
        return p.productDeliveryDate && p.productDeliveryDate > p.orderDeliveryDate;
      });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [orders, prodSearch, prodDateField, prodRange, prodStatusFilter, prodAlertsOnly]);

  const prodPageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pagedProducts = useMemo(
    () => products.slice((prodPage - 1) * PAGE_SIZE, prodPage * PAGE_SIZE),
    [products, prodPage]
  );

  const openProductModal = (orderId: string, itemId: string) => {
    const o = orders.find(x => x.id === orderId);
    const it = o?.items.find(i => i.id === itemId);
    if (o && it) {
      setProductModalCtx({ order: o, item: it });
      setProductModalOpen(true);
    }
  };

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    updateOrder({ ...order, status: newStatus });
  };

  const SortArrow = ({ field }: { field: SortField }) => {
    const active = sortField === field;
    const Icon = active && sortDir === 'desc' ? ArrowDown : ArrowUp;
    return (
      <Button variant="ghost" size="icon" className={cn('h-6 w-6', active && 'text-secondary')} onClick={() => toggleSort(field)}>
        <Icon className="h-3.5 w-3.5" />
      </Button>
    );
  };

  const ALL_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

  const handleRowClick = (order: Order) => {
    if (order.isRMA) {
      setEditRma(order);
      setRmaModalOpen(true);
    } else {
      setEditOrder(order);
      setModalOpen(true);
    }
  };

  return (
    <TooltipProvider>
      <div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card mb-4">
            <TabsTrigger value="quotes" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Cotações</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Pedidos</TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Produtos</TabsTrigger>
          </TabsList>

          {/* ============== QUOTES TAB ============== */}
          <TabsContent value="quotes">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-secondary">Cotações</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SearchBar value={quoteSearch} onChange={setQuoteSearch} placeholder="Cliente, Req, Empresa, Vendedor, Fat. Direto..." />
                    <DateFilter
                      field={quoteDateField}
                      onFieldChange={v => setQuoteDateField(v as any)}
                      fieldOptions={[
                        { value: 'requestDate', label: 'Data Requisição' },
                        { value: 'phaseDate', label: 'Data da Fase' },
                      ]}
                      range={quoteRange}
                      onRangeChange={setQuoteRange}
                    />
                    <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                      <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        {(Object.keys(QUOTE_PHASE_LABELS) as QuotePhaseKey[]).map(k => (
                          <SelectItem key={k} value={k}>
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', QUOTE_PHASE_COLORS[k])}>{QUOTE_PHASE_LABELS[k]}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(quoteSearch || quoteRange.from || quoteStatusFilter !== 'all') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setQuoteSearch(''); setQuoteRange({}); setQuoteStatusFilter('all'); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={() => { setEditQuote(null); setQuoteModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                      <Plus className="h-4 w-4 mr-1" /> Nova Cotação
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead>Índice</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data Requisição</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedQuotes.map(qt => {
                        const highest = getHighestPhase(qt);
                        const phaseDate = getPhaseDate(qt);
                        return (
                          <TableRow key={qt.id} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => { setEditQuote(qt); setQuoteModalOpen(true); }}>
                            <TableCell className="font-medium">{qt.index}</TableCell>
                            <TableCell>{qt.customer}</TableCell>
                            <TableCell>{fmtDate(qt.requestDate)}</TableCell>
                            <TableCell>{qt.company || '—'}</TableCell>
                            <TableCell>{qt.seller || '—'}</TableCell>
                            <TableCell>
                              {highest ? (
                                <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', QUOTE_PHASE_COLORS[highest])}>
                                  {QUOTE_PHASE_LABELS[highest]}
                                </span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>{fmtDate(phaseDate)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {qt.value ? formatBRL(qt.value) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedQuotes.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma cotação encontrada</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={quotePage} pageCount={quotePageCount} total={filteredQuotes.length} pageSize={PAGE_SIZE} onPageChange={setQuotePage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============== ORDERS TAB ============== */}
          <TabsContent value="orders">
            <Card>
              <CardContent className="p-4">
                {/* Filter bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-1 bg-muted rounded-full p-1">
                    {([
                      { v: 'all', l: 'Todos os Pedidos' },
                      { v: 'open', l: 'Apenas Abertos' },
                      { v: 'rma', l: 'RMAs' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setOrderView(opt.v)}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                          orderView === opt.v ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >{opt.l}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SearchBar value={orderSearch} onChange={setOrderSearch} placeholder="OS, Cliente, CNPJ, Empresa, Vendedor..." />
                    <Button
                      variant={orderAlertsOnly ? 'default' : 'outline'}
                      onClick={() => setOrderAlertsOnly(v => !v)}
                      className={cn('gap-1.5', orderAlertsOnly ? 'bg-[hsl(var(--st-invoiced-pending))] text-white hover:bg-[hsl(var(--st-invoiced-pending))]/90' : 'bg-white')}
                    >
                      <AlertTriangle className="h-4 w-4" /> Alertas
                    </Button>
                    <DateFilter
                      field={orderDateField}
                      onFieldChange={v => setOrderDateField(v as any)}
                      fieldOptions={[{ value: 'orderDate', label: 'Data do Pedido' }, { value: 'deliveryDate', label: 'Data de Entrega' }]}
                      range={orderRange}
                      onRangeChange={setOrderRange}
                    />
                    {(orderSearch || orderRange.from || orderAlertsOnly) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOrderSearch(''); setOrderRange({}); setOrderAlertsOnly(false); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                    <SelectTrigger className="w-64 bg-white"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      {ALL_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{ORDER_STATUS_LABELS[s]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => { setEditRma(null); setRmaModalOpen(true); }} variant="outline" className="border-secondary text-secondary hover:bg-secondary/10">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar RMA
                    </Button>
                    <Button onClick={() => { setEditOrder(null); setModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Pedido
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead><div className="flex items-center gap-1">OS <SortArrow field="os" /></div></TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead><div className="flex items-center gap-1">Data de Entrega <SortArrow field="deliveryDate" /></div></TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedOrders.map(order => {
                        const warn = shouldWarnDelivery(order);
                        const rmaParentStatus = order.isRMA ? calcRmaParentStatus(order.rmaItems) : null;
                        return (
                          <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(order)}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1.5">
                                {warn && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-4 w-4 text-[hsl(var(--st-invoiced-pending))]" />
                                    </TooltipTrigger>
                                    <TooltipContent>Entrega em ≤ 3 dias</TooltipContent>
                                  </Tooltip>
                                )}
                                {order.os}
                                {order.isRMA && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">RMA</span>}
                              </div>
                            </TableCell>
                            <TableCell>{order.customer}</TableCell>
                            <TableCell>{order.company || '—'}</TableCell>
                            <TableCell>{order.seller || '—'}</TableCell>
                            <TableCell>{fmtDate(order.deliveryDate)}</TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              {order.isRMA ? (
                                rmaParentStatus ? (
                                  <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', RMA_STATUS_COLORS[rmaParentStatus])}>
                                    {RMA_STATUS_LABELS[rmaParentStatus]}
                                  </span>
                                ) : <span className="text-muted-foreground text-xs">—</span>
                              ) : (
                                <Select value={order.status} onValueChange={v => handleStatusChange(order, v as OrderStatus)}>
                                  <SelectTrigger className={cn('w-56 text-xs font-semibold border', ORDER_STATUS_COLORS[order.status])}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_STATUSES.map(s => (
                                      <SelectItem key={s} value={s}>
                                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{ORDER_STATUS_LABELS[s]}</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {order.isRMA ? <span className="text-muted-foreground">—</span> : formatBRL(calcTotal(order))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedOrders.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={orderPage} pageCount={orderPageCount} total={filteredOrders.length} pageSize={PAGE_SIZE} onPageChange={setOrderPage} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============== PRODUCTS TAB ============== */}
          <TabsContent value="products">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-secondary">Produtos (Pedidos Abertos)</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SearchBar value={prodSearch} onChange={setProdSearch} placeholder="OS, Cliente, Empresa, Vendedor, Produto..." />
                    <Button
                      variant={prodAlertsOnly ? 'default' : 'outline'}
                      onClick={() => setProdAlertsOnly(v => !v)}
                      className={cn('gap-1.5', prodAlertsOnly ? 'bg-[hsl(var(--st-delayed))] text-white hover:bg-[hsl(var(--st-delayed))]/90' : 'bg-white')}
                    >
                      <AlertTriangle className="h-4 w-4" /> Alertas
                    </Button>
                    <Select value={prodStatusFilter} onValueChange={setProdStatusFilter}>
                      <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                          <SelectItem key={s} value={s}>
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DateFilter
                      field={prodDateField}
                      onFieldChange={v => setProdDateField(v as any)}
                      fieldOptions={[{ value: 'order', label: 'Entrega Pedido' }, { value: 'product', label: 'Entrega Produto' }]}
                      range={prodRange}
                      onRangeChange={setProdRange}
                    />
                    {(prodSearch || prodRange.from || prodAlertsOnly || prodStatusFilter !== 'all') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setProdSearch(''); setProdRange({}); setProdAlertsOnly(false); setProdStatusFilter('all'); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead>OS Pai</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Entrega Pedido</TableHead>
                        <TableHead>Entrega Produto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedProducts.map(p => {
                        const productLate = p.productDeliveryDate && p.productDeliveryDate > p.orderDeliveryDate;
                        return (
                          <TableRow key={`${p.orderId}-${p.id}`} className="cursor-pointer hover:bg-muted/50" onClick={() => openProductModal(p.orderId, p.id)}>
                            <TableCell className="font-medium">{p.os}</TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.customer}</TableCell>
                            <TableCell>{p.quantity}</TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Select value={p.status} onValueChange={v => updateItemStatus(p.orderId, p.id, v as ItemStatus)}>
                                <SelectTrigger className={cn('w-40 text-xs font-semibold border', ITEM_STATUS_COLORS[p.status])}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                                    <SelectItem key={s} value={s}>
                                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>{fmtDate(p.orderDeliveryDate)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {productLate && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-4 w-4 text-[hsl(var(--st-delayed))]" />
                                    </TooltipTrigger>
                                    <TooltipContent>Entrega do produto após a entrega do pedido</TooltipContent>
                                  </Tooltip>
                                )}
                                {fmtDate(p.productDeliveryDate)}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedProducts.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={prodPage} pageCount={prodPageCount} total={products.length} pageSize={PAGE_SIZE} onPageChange={setProdPage} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <OrderModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          order={editOrder}
          onSave={o => editOrder ? updateOrder(o) : addOrder(o)}
          onDelete={deleteOrder}
          nextOS={nextOS}
        />
        <ProductModal
          open={productModalOpen}
          onClose={() => setProductModalOpen(false)}
          order={productModalCtx?.order || null}
          item={productModalCtx?.item || null}
          onSave={updateOrder}
        />
        <QuoteModal
          open={quoteModalOpen}
          onClose={() => setQuoteModalOpen(false)}
          quote={editQuote}
          onSave={q => editQuote ? updateQuote(q) : addQuote(q)}
          onDelete={deleteQuote}
          nextIndex={nextIndex}
        />
        <RmaModal
          open={rmaModalOpen}
          onClose={() => setRmaModalOpen(false)}
          orders={orders}
          rma={editRma}
          onSave={o => editRma ? updateOrder(o) : addOrder(o)}
          nextRmaNumber={nextRmaNumber}
        />
      </div>
    </TooltipProvider>
  );
}
