import { useState, useMemo, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowUp, ArrowDown, Plus, Search, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrders, Order, OrderStatus, ItemStatus, ORDER_STATUS_COLORS, ITEM_STATUS_COLORS, isOpenOrder, calcTotal } from '@/store/OrderStore';
import { OrderModal } from '@/components/OrderModal';

const SearchFilterBar = memo(({ query, onQueryChange, date, onDateChange }: {
  query: string; onQueryChange: (v: string) => void; date?: Date; onDateChange: (d: Date | undefined) => void;
}) => {
  const [calOpen, setCalOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou OS..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="pl-9 w-64 bg-white"
        />
      </div>
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('gap-2', date && 'text-secondary border-secondary')}>
            <CalendarIcon className="h-4 w-4" />
            {date ? format(date, 'dd/MM/yyyy') : 'Data'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={d => { onDateChange(d); setCalOpen(false); }}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {(query || date) && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onQueryChange(''); onDateChange(undefined); }}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

const STATUS_LABELS: Record<OrderStatus, string> = {
  'To Buy': 'A Comprar', 'Bought': 'Comprado', 'Received': 'Recebido',
  'Ready for Delivery': 'Pronto p/ Entrega', 'Out for Delivery': 'Saiu p/ Entrega',
  'Delivered': 'Entregue', 'Delayed': 'Atrasado',
};

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'To Buy': 'A Comprar', 'Bought': 'Comprado', 'In Stock': 'Em Estoque',
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type SortField = 'os' | 'deliveryDate';
type SortDir = 'asc' | 'desc';

export default function Sales() {
  const { orders, addOrder, updateOrder, deleteOrder, updateItemStatus } = useOrders();
  const [tab, setTab] = useState('orders');
  const [openOnly, setOpenOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [prodStatusFilter, setProdStatusFilter] = useState<string>('all');

  // Search & date filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [prodFilterDate, setProdFilterDate] = useState<Date | undefined>(undefined);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const matchesSearch = (order: Order, query: string, date?: Date) => {
    const q = query.toLowerCase().trim();
    const textMatch = !q || order.customer.toLowerCase().includes(q) || order.os.toLowerCase().includes(q);
    const dateMatch = !date || order.deliveryDate === format(date, 'yyyy-MM-dd');
    return textMatch && dateMatch;
  };

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (openOnly) list = list.filter(o => isOpenOrder(o.status));
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    list = list.filter(o => matchesSearch(o, searchQuery, filterDate));
    if (sortField) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'os') cmp = a.os.localeCompare(b.os, undefined, { numeric: true });
        else cmp = a.deliveryDate.localeCompare(b.deliveryDate);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [orders, openOnly, statusFilter, sortField, sortDir, searchQuery, filterDate]);

  const products = useMemo(() => {
    return orders
      .filter(o => isOpenOrder(o.status))
      .flatMap(o => o.items.map(item => ({ ...item, orderId: o.id, deliveryDate: o.deliveryDate, customer: o.customer })))
      .filter(p => prodStatusFilter === 'all' || p.status === prodStatusFilter)
      .filter(p => {
        const q = prodSearchQuery.toLowerCase().trim();
        const textMatch = !q || p.name.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q);
        const dateMatch = !prodFilterDate || p.deliveryDate === format(prodFilterDate, 'yyyy-MM-dd');
        return textMatch && dateMatch;
      });
  }, [orders, prodStatusFilter, prodSearchQuery, prodFilterDate]);

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

  return (
    <div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card mb-4">
          <TabsTrigger value="orders" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Pedidos</TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-4">
              {/* Top row: toggle + search */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 bg-muted rounded-full p-1 w-fit">
                  <button
                    onClick={() => setOpenOnly(false)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                      !openOnly ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Todos os Pedidos
                  </button>
                  <button
                    onClick={() => setOpenOnly(true)}
                    className={cn(
                      'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                      openOnly ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Apenas Abertos
                  </button>
                </div>
                <SearchFilterBar query={searchQuery} onQueryChange={setSearchQuery} date={filterDate} onDateChange={setFilterDate} />
              </div>

              <div className="flex justify-between items-center mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
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
                      <TableHead>
                        <div className="flex items-center gap-1">OS <SortArrow field="os" /></div>
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">Data de Entrega <SortArrow field="deliveryDate" /></div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setEditOrder(order); setModalOpen(true); }}
                      >
                        <TableCell className="font-medium">{order.os}</TableCell>
                        <TableCell>{order.customer}</TableCell>
                        <TableCell>{order.company || '—'}</TableCell>
                        <TableCell>{format(new Date(order.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select value={order.status} onValueChange={v => handleStatusChange(order, v as OrderStatus)}>
                            <SelectTrigger className={cn('w-44 text-xs font-semibold border', ORDER_STATUS_COLORS[order.status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
                                <SelectItem key={s} value={s}>
                                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatBRL(calcTotal(order))}</TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-secondary">Produtos (Pedidos Abertos)</h2>
                <div className="flex items-center gap-3">
                  <SearchFilterBar query={prodSearchQuery} onQueryChange={setProdSearchQuery} date={prodFilterDate} onDateChange={setProdFilterDate} />
                  <Select value={prodStatusFilter} onValueChange={setProdStatusFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                        <SelectItem key={s} value={s}>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead>Produto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prazo de Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => (
                      <TableRow key={`${p.orderId}-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
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
                        <TableCell>{format(new Date(p.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {products.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
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
      />
    </div>
  );
}
