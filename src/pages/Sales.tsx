import { useState, useMemo, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, ArrowDown, Plus, Search, CalendarIcon, X, AlertTriangle } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  useOrders, Order, OrderItem, OrderStatus, ItemStatus,
  ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ITEM_STATUS_COLORS,
  WARN_STATUSES, isOpenOrder, calcTotal, calcItemLatestDelivery,
} from '@/store/OrderStore';
import { OrderModal } from '@/components/OrderModal';
import { ProductModal } from '@/components/ProductModal';

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

type DateRange = { from?: Date; to?: Date };

/* ============================================================
 * Date range picker (used in both tabs)
 * ============================================================ */
const DateRangeFilter = memo(({
  field, onFieldChange, fieldOptions, range, onRangeChange,
}: {
  field: string;
  onFieldChange: (v: string) => void;
  fieldOptions: { value: string; label: string }[];
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
}) => {
  const [open, setOpen] = useState(false);
  const hasRange = !!range.from;
  const label = hasRange
    ? range.to && range.to.getTime() !== range.from!.getTime()
      ? `${format(range.from!, 'dd/MM/yy')} → ${format(range.to, 'dd/MM/yy')}`
      : format(range.from!, 'dd/MM/yyyy')
    : 'Período';
  return (
    <div className="flex items-center gap-1">
      <Select value={field} onValueChange={onFieldChange}>
        <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
        <SelectContent>
          {fieldOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('gap-2 bg-white', hasRange && 'text-secondary border-secondary')}>
            <CalendarIcon className="h-4 w-4" />{label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={range as any}
            onSelect={(r: any) => onRangeChange(r || {})}
            locale={ptBR}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
          <div className="p-2 border-t flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => { onRangeChange({}); setOpen(false); }}>Limpar</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

/* ============================================================
 * Search bar (memoized to keep focus while typing)
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
  const { orders, addOrder, updateOrder, deleteOrder, updateItemStatus, nextOS } = useOrders();
  const [tab, setTab] = useState('orders');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);

  /* ---------- Orders tab state ---------- */
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateField, setOrderDateField] = useState<'orderDate' | 'deliveryDate'>('deliveryDate');
  const [orderRange, setOrderRange] = useState<DateRange>({});
  const [orderView, setOrderView] = useState<'all' | 'open' | 'rma'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* ---------- Products tab state ---------- */
  const [prodSearch, setProdSearch] = useState('');
  const [prodDateField, setProdDateField] = useState<'order' | 'product'>('order');
  const [prodRange, setProdRange] = useState<DateRange>({});

  /* ---------- Quotes tab state ---------- */
  const [quoteSearch, setQuoteSearch] = useState('');

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  /* ---------- Orders filter (excludes Quotes) ---------- */
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    let list = orders.filter(o => o.status !== 'Quote');
    if (orderView === 'open') list = list.filter(o => isOpenOrder(o.status));
    if (orderView === 'rma') list = list.filter(o => o.isRMA);
    if (orderStatusFilter !== 'all') list = list.filter(o => o.status === orderStatusFilter);
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
    }
    return list;
  }, [orders, orderSearch, orderView, orderStatusFilter, orderDateField, orderRange, sortField, sortDir]);

  /* ---------- Quotes ---------- */
  const filteredQuotes = useMemo(() => {
    const q = quoteSearch.toLowerCase().trim();
    return orders.filter(o => o.status === 'Quote' && (
      !q || o.os.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) ||
      (o.company || '').toLowerCase().includes(q) || (o.seller || '').toLowerCase().includes(q)
    ));
  }, [orders, quoteSearch]);

  /* ---------- Products ---------- */
  const products = useMemo(() => {
    const q = prodSearch.toLowerCase().trim();
    return orders
      .filter(o => isOpenOrder(o.status))
      .flatMap(o => o.items.map(item => ({
        ...item,
        orderId: o.id,
        os: o.os,
        customer: o.customer,
        company: o.company,
        seller: o.seller,
        orderDeliveryDate: o.deliveryDate,
      })))
      .filter(p => !q || (
        p.os.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        (p.company || '').toLowerCase().includes(q) ||
        (p.seller || '').toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
      ))
      .filter(p => {
        const dateIso = prodDateField === 'order' ? p.orderDeliveryDate : (p.productDeliveryDate || p.orderDeliveryDate);
        return isInRange(dateIso, prodRange);
      });
  }, [orders, prodSearch, prodDateField, prodRange]);

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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-secondary">Cotações</h2>
                  <div className="flex items-center gap-2">
                    <SearchBar value={quoteSearch} onChange={setQuoteSearch} placeholder="Buscar cotação..." />
                    <Button onClick={() => { setEditOrder(null); setModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                      <Plus className="h-4 w-4 mr-1" /> Nova Cotação
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead>OS</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Data do Pedido</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map(o => (
                        <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setEditOrder(o); setModalOpen(true); }}>
                          <TableCell className="font-medium">{o.os}</TableCell>
                          <TableCell>{o.customer}</TableCell>
                          <TableCell>{o.company || '—'}</TableCell>
                          <TableCell>{o.seller || '—'}</TableCell>
                          <TableCell>{fmtDate(o.orderDate)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatBRL(calcTotal(o))}</TableCell>
                        </TableRow>
                      ))}
                      {filteredQuotes.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma cotação encontrada</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
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
                    <DateRangeFilter
                      field={orderDateField}
                      onFieldChange={v => setOrderDateField(v as any)}
                      fieldOptions={[{ value: 'orderDate', label: 'Data do Pedido' }, { value: 'deliveryDate', label: 'Data de Entrega' }]}
                      range={orderRange}
                      onRangeChange={setOrderRange}
                    />
                    {(orderSearch || orderRange.from) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOrderSearch(''); setOrderRange({}); }}>
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
                      {ALL_STATUSES.filter(s => s !== 'Quote').map(s => (
                        <SelectItem key={s} value={s}>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{ORDER_STATUS_LABELS[s]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => { setEditOrder(null); setModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Pedido
                  </Button>
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
                      {filteredOrders.map(order => {
                        const warn = shouldWarnDelivery(order);
                        return (
                          <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setEditOrder(order); setModalOpen(true); }}>
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
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatBRL(calcTotal(order))}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredOrders.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
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
                    <DateRangeFilter
                      field={prodDateField}
                      onFieldChange={v => setProdDateField(v as any)}
                      fieldOptions={[{ value: 'order', label: 'Entrega Pedido' }, { value: 'product', label: 'Entrega Produto' }]}
                      range={prodRange}
                      onRangeChange={setProdRange}
                    />
                    {(prodSearch || prodRange.from) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setProdSearch(''); setProdRange({}); }}>
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
                      {products.map(p => {
                        const productLate = p.productDeliveryDate && p.productDeliveryDate > p.orderDeliveryDate;
                        return (
                          <TableRow key={`${p.orderId}-${p.id}`}>
                            <TableCell className="font-medium">{p.os}</TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.customer}</TableCell>
                            <TableCell>{p.quantity}</TableCell>
                            <TableCell>
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
                      {products.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
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
      </div>
    </TooltipProvider>
  );
}
