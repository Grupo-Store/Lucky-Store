import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOrders, Order, OrderStatus, ItemStatus, ORDER_STATUS_COLORS, ITEM_STATUS_COLORS, isOpenOrder, calcTotal } from '@/store/OrderStore';
import { OrderModal } from '@/components/OrderModal';

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

export default function Sales() {
  const { orders, addOrder, updateOrder, deleteOrder, updateItemStatus } = useOrders();
  const [tab, setTab] = useState('orders');
  const [openOnly, setOpenOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortByDelivery, setSortByDelivery] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);

  // Products filters
  const [prodStatusFilter, setProdStatusFilter] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    let list = [...orders];
    if (openOnly) list = list.filter(o => isOpenOrder(o.status));
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (sortByDelivery) list.sort((a, b) => {
      const da = Math.abs(new Date(a.deliveryDate).getTime() - Date.now());
      const db = Math.abs(new Date(b.deliveryDate).getTime() - Date.now());
      return da - db;
    });
    return list;
  }, [orders, openOnly, statusFilter, sortByDelivery]);

  // Products: aggregated items from open orders
  const products = useMemo(() => {
    return orders
      .filter(o => isOpenOrder(o.status))
      .flatMap(o => o.items.map(item => ({ ...item, orderId: o.id, deliveryDate: o.deliveryDate })))
      .filter(p => prodStatusFilter === 'all' || p.status === prodStatusFilter);
  }, [orders, prodStatusFilter]);

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    updateOrder({ ...order, status: newStatus });
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
              {/* Global filter */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium">Todos os Pedidos</span>
                <Switch checked={openOnly} onCheckedChange={setOpenOnly} />
                <span className="text-sm font-medium">Apenas Abertos</span>
              </div>

              {/* Table controls */}
              <div className="flex justify-between items-center mb-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-2 py-0.5 rounded text-xs', ORDER_STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => { setEditOrder(null); setModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Pedido
                </Button>
              </div>

              {/* Orders table */}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead>OS</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          Data de Entrega
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSortByDelivery(v => !v)}>
                            <ArrowUpDown className="h-3 w-3" />
                          </Button>
                        </div>
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
                        <TableCell>{format(new Date(order.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select value={order.status} onValueChange={v => handleStatusChange(order, v as OrderStatus)}>
                            <SelectTrigger className={cn('w-44 text-xs font-medium border', ORDER_STATUS_COLORS[order.status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABELS) as OrderStatus[]).map(s => (
                                <SelectItem key={s} value={s}>
                                  <span className={cn('px-2 py-0.5 rounded', ORDER_STATUS_COLORS[s])}>{STATUS_LABELS[s]}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatBRL(calcTotal(order))}</TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
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
                <Select value={prodStatusFilter} onValueChange={setProdStatusFilter}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <span className={cn('px-2 py-0.5 rounded text-xs', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/10">
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prazo de Entrega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => (
                      <TableRow key={`${p.orderId}-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>
                          <Select value={p.status} onValueChange={v => updateItemStatus(p.orderId, p.id, v as ItemStatus)}>
                            <SelectTrigger className={cn('w-40 text-xs font-medium border', ITEM_STATUS_COLORS[p.status])}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(['To Buy', 'Bought', 'In Stock'] as ItemStatus[]).map(s => (
                                <SelectItem key={s} value={s}>
                                  <span className={cn('px-2 py-0.5 rounded', ITEM_STATUS_COLORS[s])}>{ITEM_STATUS_LABELS[s]}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{format(new Date(p.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                    {products.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
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
