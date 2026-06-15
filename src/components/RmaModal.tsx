import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, CalendarIcon, Search, ChevronRight, Plus, Trash2, Printer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Order, OrderItem, ItemStatus, RmaItem, RmaItemStatus, FreightCard,
  Company, Seller,
  RMA_ITEM_STATUSES, RMA_STATUS_LABELS, RMA_STATUS_COLORS,
  calcFreightTotal,
} from '@/store/OrderStore';
import { useCreateRma } from '@/api/hooks/useRma';
import { useVendedores } from '@/hooks/useVendedores';
import { getApiError } from '@/api/client';
import type { CreateRmaPayload } from '@/types/api';
import { useOrdersQuery, PedidoListItem } from '@/hooks/use-orders-query';

function toBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function parseBRL(s: string): number { return parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')) || 0; }
function fmtDate(iso?: string) {
  if (!iso) return 'Selecionar';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}
function handleEnterBlur(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
}

type Step = 'pick-order' | 'pick-items' | 'form';

interface RmaParent {
  id: string;
  os: string;
  customer: string;
  cnpj: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  orders?: Order[];
  rma?: Order | null;
  onSave: (rma: Order) => void;
  nextRmaNumber: (parentOs: string) => string;
}

export function RmaModal({ open, onClose, orders, rma, onSave, nextRmaNumber }: Props) {
  const isEdit = !!rma;
  const [step, setStep] = useState<Step>(isEdit ? 'form' : 'pick-order');

  const { mutate: createRma, isPending } = useCreateRma();
  const { data: vendedoresData } = useVendedores();
  const vendedores = vendedoresData?.items ?? [];

  /* ---------- Step 1: delivered orders from API ---------- */
  const [orderSearch, setOrderSearch] = useState('');
  const [deliveredPage, setDeliveredPage] = useState(1);
  const {
    data: deliveredData,
    isLoading: deliveredLoading,
    isError: deliveredError,
    refetch: deliveredRefetch,
  } = useOrdersQuery(
    { page: deliveredPage, limit: 20, status: 'Delivered', sort_by: 'data_entrega', sort_dir: 'desc' },
    { enabled: open && !isEdit }
  );

  const filteredDelivered = useMemo(() => {
    const items = deliveredData?.items ?? [];
    const q = orderSearch.toLowerCase().trim();
    if (!q) return items;
    return items.filter(o =>
      o.numero_os.toLowerCase().includes(q) ||
      (o.nome_cliente ?? '').toLowerCase().includes(q)
    );
  }, [deliveredData, orderSearch]);

  /* ---------- Step 2: item selection ---------- */
  const [localParentItems, setLocalParentItems] = useState<OrderItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  /* ---------- Form state ---------- */
  const [parent, setParent] = useState<RmaParent | null>(null);
  const [rmaNumberDisplay, setRmaNumberDisplay] = useState('');
  const [registrationDate, setRegistrationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
  const [actualDeliveryDate, setActualDeliveryDate] = useState<string>('');
  const [seller, setSeller] = useState<Seller>('');
  const [company, setCompany] = useState<Company>('');
  const [rmaItems, setRmaItems] = useState<RmaItem[]>([]);
  const [freight, setFreight] = useState<FreightCard[]>([]);
  const [observations, setObservations] = useState('');
  const [regDateOpen, setRegDateOpen] = useState(false);
  const [delDateOpen, setDelDateOpen] = useState(false);
  const [actualDelDateOpen, setActualDelDateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (rma) {
      setParent({
        id: rma.rmaParentOrderId || rma.id,
        os: rma.rmaNumber || rma.os,
        customer: rma.customer,
        cnpj: rma.cnpj || '',
      });
      setStep('form');
      setRmaNumberDisplay(rma.rmaNumber || rma.os);
      setRegistrationDate(rma.orderDate);
      setDeliveryDate(rma.deliveryDate);
      setActualDeliveryDate(rma.rmaActualDeliveryDate || '');
      setSeller(rma.seller);
      setCompany(rma.company);
      setRmaItems(rma.rmaItems ? rma.rmaItems.map(i => ({ ...i })) : []);
      setFreight(rma.rmaFreight ? rma.rmaFreight.map(f => ({ ...f })) : []);
      setObservations(rma.observations || '');
    } else {
      setStep('pick-order');
      setOrderSearch('');
      setDeliveredPage(1);
      setParent(null);
      setLocalParentItems([]);
      setSelectedItemIds(new Set());
      setRegistrationDate(format(new Date(), 'yyyy-MM-dd'));
      setDeliveryDate(format(addDays(new Date(), 14), 'yyyy-MM-dd'));
      setActualDeliveryDate('');
      setSeller('');
      setCompany('');
      setRmaItems([]);
      setFreight([]);
      setObservations('');
      setRmaNumberDisplay('');
    }
  }, [open, rma]);

  const choosePicked = (o: PedidoListItem) => {
    setParent({ id: o.id, os: o.numero_os, customer: o.nome_cliente ?? '', cnpj: '' });
    setCompany((o.nome_loja ?? '') as Company);
    setSeller((o.nome_vendedor ?? '') as Seller);
    setRmaNumberDisplay(nextRmaNumber(o.numero_os));
    const apiItems: OrderItem[] = (o.produtos ?? []).map(p => ({
      id: p.id,
      name: p.descricao,
      quantity: p.quantidade,
      status: p.status as ItemStatus,
      projectedValue: parseFloat(String(p.valor_projetado)) || 0,
      purchaseValue: parseFloat(String(p.valor_compra ?? '0')) || 0,
    }));
    setLocalParentItems(apiItems);
    setSelectedItemIds(new Set());
    setRmaItems([]);
    setStep('pick-items');
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const goToForm = () => {
    if (localParentItems.length > 0) {
      const picked = localParentItems.filter(i => selectedItemIds.has(i.id));
      setRmaItems(picked.map<RmaItem>(i => ({
        id: crypto.randomUUID(),
        sourceItemId: i.id,
        name: i.name,
        quantity: i.quantity,
        repairedBy: '',
        status: 'Not Received',
      })));
    }
    setStep('form');
  };

  /* ---------- Back navigation ---------- */
  const goBack = () => {
    if (step === 'form') setStep('pick-items');
    else if (step === 'pick-items') setStep('pick-order');
  };

  /* ---------- RMA items (form step) ---------- */
  const addRmaItem = () => setRmaItems(prev => [...prev, {
    id: crypto.randomUUID(),
    sourceItemId: '',
    name: '',
    quantity: 1,
    repairedBy: '',
    status: 'Not Received' as RmaItemStatus,
  }]);
  const removeRmaItem = (id: string) => setRmaItems(prev => prev.filter(i => i.id !== id));
  const updateRmaItem = (id: string, field: keyof RmaItem, value: any) =>
    setRmaItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  /* ---------- Freight ---------- */
  const addFreight = () => setFreight(prev => [...prev, {
    id: crypto.randomUUID(), deliveryPerson: '', value: 0, deliveryDate: undefined,
  }]);
  const updateFreight = (id: string, field: keyof FreightCard, value: any) =>
    setFreight(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  const removeFreight = (id: string) => setFreight(prev => prev.filter(f => f.id !== id));
  const freightTotal = useMemo(() => calcFreightTotal(freight), [freight]);

  /* ---------- Save ---------- */
  const handleSave = () => {
    if (!parent || rmaItems.length === 0) return;
    const rmaNumber = isEdit ? (rma!.rmaNumber || rma!.os) : nextRmaNumber(parent.os);
    const newOrder: Order = {
      id: rma?.id || crypto.randomUUID(),
      os: rmaNumber,
      createdAt: rma?.createdAt || Date.now(),
      orderDate: registrationDate,
      customer: parent.customer,
      cnpj: parent.cnpj,
      company,
      seller,
      ocAfPed: '',
      directBilling: false,
      supplier: '',
      invoice: '',
      invoiceSupplier: '',
      paymentMethods: [],
      installments: 1,
      deliveryDate,
      rmaActualDeliveryDate: actualDeliveryDate || undefined,
      status: 'To Pack',
      isRMA: true,
      rmaNumber,
      rmaParentOrderId: parent.id,
      cancelled: false,
      observations: observations || `RMA do pedido ${parent.os}`,
      initialProductCost: 0, finalProductCost: 0,
      boletoCost: 0, giftCost: 0,
      creditCostPercent: 0, creditCostValue: 0,
      debitCostPercent: 0, debitCostValue: 0,
      purchaseTaxPercent: 0, purchaseTaxValue: 0,
      salesTaxPercent: 0, salesTaxValue: 0,
      salesValue: 0,
      items: [],
      freight: [],
      rmaItems,
      rmaFreight: freight,
    };

    if (isEdit) {
      onSave(newOrder);
      onClose();
      return;
    }

    const payload: CreateRmaPayload = {
      id_pedido_origem: parent.id,
      prazo_entrega: deliveryDate || undefined,
      itens: rmaItems.map(i => ({ descricao: i.name, quantidade: i.quantity })),
    };

    createRma(payload, {
      onSuccess: () => {
        toast.success('RMA criado com sucesso');
        onSave(newOrder);
        onClose();
      },
      onError: (err) => toast.error(getApiError(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#16273F] flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {!isEdit && step !== 'pick-order' && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'pick-order' && 'Novo RMA — Selecionar Pedido Entregue'}
            {step === 'pick-items' && `RMA — Selecionar Itens (Pedido #${parent?.os})`}
            {step === 'form' && (isEdit ? `Editar RMA — ${rmaNumberDisplay}` : `Novo RMA — ${rmaNumberDisplay}`)}
          </DialogTitle>
        </DialogHeader>

        {/* ===== STEP 1: pick order ===== */}
        {step === 'pick-order' && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar OS ou Cliente..."
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                onKeyDown={handleEnterBlur}
                className="pl-9 bg-white"
                autoFocus
              />
            </div>
            {deliveredError && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>Falha ao carregar pedidos entregues.</span>
                  <Button variant="outline" size="sm" onClick={() => deliveredRefetch()}>Tentar novamente</Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8FAFD]">
                    <TableHead>OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Data Entrega</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveredLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredDelivered.map(o => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => choosePicked(o)}>
                      <TableCell className="font-medium">{o.numero_os}</TableCell>
                      <TableCell>{o.nome_cliente || '—'}</TableCell>
                      <TableCell>{o.nome_loja || '—'}</TableCell>
                      <TableCell>{o.nome_vendedor || '—'}</TableCell>
                      <TableCell>{fmtDate(o.data_entrega)}</TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {!deliveredLoading && filteredDelivered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum pedido entregue encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {(deliveredData?.pages ?? 1) > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                <span>{deliveredData?.total ?? 0} pedidos entregues</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={deliveredPage <= 1}
                    onClick={() => setDeliveredPage(p => p - 1)}>Anterior</Button>
                  <span>Página {deliveredPage} de {deliveredData?.pages ?? 1}</span>
                  <Button variant="outline" size="sm" disabled={deliveredPage >= (deliveredData?.pages ?? 1)}
                    onClick={() => setDeliveredPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== STEP 2: pick items ===== */}
        {step === 'pick-items' && parent && (
          <>
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{parent.customer || '—'}</span>
              {parent.cnpj && <> · CPF/CNPJ: <span className="font-medium text-foreground">{parent.cnpj}</span></>}
            </p>
            {localParentItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F8FAFD]">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localParentItems.map(it => (
                      <TableRow key={it.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleItem(it.id)}>
                        <TableCell>
                          <Checkbox checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} />
                        </TableCell>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>{it.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                Nenhum produto encontrado para este pedido no sistema local.
                <br />
                Você poderá adicionar os itens manualmente na próxima etapa.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={goToForm}
                disabled={localParentItems.length > 0 && selectedItemIds.size === 0}
                className="bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white"
              >
                {localParentItems.length > 0
                  ? `Próximo (${selectedItemIds.size} ${selectedItemIds.size === 1 ? 'item' : 'itens'})`
                  : 'Continuar'}
              </Button>
            </div>
          </>
        )}

        {/* ===== STEP 3: form ===== */}
        {step === 'form' && parent && (
          <>
            <section className="border border-[#E2E8F1] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#5B6B82] uppercase tracking-widest mb-3">Informações Gerais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Nº RMA (auto)</Label>
                  <Input readOnly className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" value={rmaNumberDisplay} />
                </div>
                <div><Label>Cliente</Label><Input readOnly value={parent.customer} className="bg-[#F4F7FB] border-[#E2E8F1]" /></div>
                <div><Label>CPF/CNPJ</Label><Input readOnly value={parent.cnpj || '—'} className="bg-[#F4F7FB] border-[#E2E8F1]" /></div>
                <div>
                  <Label>Data de Registro *</Label>
                  <Popover open={regDateOpen} onOpenChange={setRegDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                        <CalendarIcon className="mr-2 h-4 w-4" />{fmtDate(registrationDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single"
                        selected={registrationDate ? new Date(registrationDate + 'T12:00:00') : undefined}
                        onSelect={d => { if (d) setRegistrationDate(format(d, 'yyyy-MM-dd')); setRegDateOpen(false); }}
                        locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Empresa *</Label>
                  <Select value={company || ''} onValueChange={v => setCompany(v as Company)}>
                    <SelectTrigger className="bg-[#FBFCFE] border-[#E2E8F1]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lucky Store">Lucky Store</SelectItem>
                      <SelectItem value="BTech">BTech</SelectItem>
                      <SelectItem value="AJJ">AJJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vendedor *</Label>
                  <Select value={seller || ''} onValueChange={v => setSeller(v as Seller)}>
                    <SelectTrigger className="bg-[#FBFCFE] border-[#E2E8F1]"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {vendedores.map(v => <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo de Entrega *</Label>
                  <Popover open={delDateOpen} onOpenChange={setDelDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                        <CalendarIcon className="mr-2 h-4 w-4" />{fmtDate(deliveryDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single"
                        selected={deliveryDate ? new Date(deliveryDate + 'T12:00:00') : undefined}
                        onSelect={d => { if (d) setDeliveryDate(format(d, 'yyyy-MM-dd')); setDelDateOpen(false); }}
                        locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Data de Entrega Real</Label>
                  <Popover open={actualDelDateOpen} onOpenChange={setActualDelDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
                        <CalendarIcon className="mr-2 h-4 w-4" />{actualDeliveryDate ? fmtDate(actualDeliveryDate) : 'Selecionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single"
                        selected={actualDeliveryDate ? new Date(actualDeliveryDate + 'T12:00:00') : undefined}
                        onSelect={d => { setActualDeliveryDate(d ? format(d, 'yyyy-MM-dd') : ''); setActualDelDateOpen(false); }}
                        locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Frete <span className="text-xs text-muted-foreground">(soma)</span></Label>
                  <Input readOnly value={toBRL(freightTotal)} className="bg-[#F4F7FB] border-[#E2E8F1] font-semibold" />
                </div>
              </div>
            </section>

            <section className="border border-[#E2E8F1] rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-[#5B6B82] uppercase tracking-widest">Produtos do RMA</h3>
                <Button size="sm" onClick={addRmaItem} className="bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                </Button>
              </div>
              <div className="space-y-3">
                {rmaItems.map(it => (
                  <div key={it.id} className="border border-[#E2E8F1] rounded-lg p-3 bg-[#F8FAFD] grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label>Produto</Label>
                      <Input className="bg-[#FBFCFE] border-[#E2E8F1]" value={it.name}
                        onChange={e => updateRmaItem(it.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                    </div>
                    <div>
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} className="bg-[#FBFCFE] border-[#E2E8F1]" value={it.quantity}
                        onChange={e => updateRmaItem(it.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                    </div>
                    <div>
                      <Label>Reparado por</Label>
                      <Input
                        className="bg-[#FBFCFE] border-[#E2E8F1]"
                        value={it.repairedBy || ''}
                        onChange={e => updateRmaItem(it.id, 'repairedBy', e.target.value)}
                        onKeyDown={handleEnterBlur}
                        placeholder="Fornecedor / técnico"
                      />
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label>Status</Label>
                        <Select value={it.status} onValueChange={v => updateRmaItem(it.id, 'status', v as RmaItemStatus)}>
                          <SelectTrigger className={cn('border', RMA_STATUS_COLORS[it.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RMA_ITEM_STATUSES.map(s => (
                              <SelectItem key={s} value={s}>
                                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', RMA_STATUS_COLORS[s])}>
                                  {RMA_STATUS_LABELS[s]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeRmaItem(it.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {rmaItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum item adicionado. Clique em "Adicionar Item" para inserir produtos.
                  </p>
                )}
              </div>
            </section>

            <section className="border border-[#E2E8F1] rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-[#5B6B82] uppercase tracking-widest">Frete</h3>
                <Button size="sm" onClick={addFreight} className="bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white">
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Frete
                </Button>
              </div>
              <div className="space-y-2">
                {freight.map((f, idx) => (
                  <RmaFreightRow key={f.id} idx={idx} card={f}
                    onChange={(k, v) => updateFreight(f.id, k, v)}
                    onRemove={() => removeFreight(f.id)} />
                ))}
                {freight.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3">Nenhum frete adicionado</p>
                )}
              </div>
              <div className="mt-3 text-right text-sm font-semibold text-[#2F6BFF]">
                Total: {toBRL(freightTotal)}
              </div>
            </section>

            <section className="border border-[#E2E8F1] rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#5B6B82] uppercase tracking-widest mb-3">Observações</h3>
              <Textarea
                className="bg-[#FBFCFE] border-[#E2E8F1] min-h-24"
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Anotações sobre este RMA..."
              />
            </section>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              <Button
                onClick={handleSave}
                disabled={isPending || rmaItems.length === 0}
                className="bg-[#2F6BFF] hover:bg-[#1E4FD8] text-white"
              >
                {isPending ? 'Salvando...' : (isEdit ? 'Salvar Alterações' : 'Criar RMA')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- RMA Freight row ---------- */
function RmaFreightRow({ idx, card, onChange, onRemove }: {
  idx: number; card: FreightCard;
  onChange: (k: keyof FreightCard, v: any) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-[#E2E8F1] rounded-lg p-2 bg-[#F8FAFD]">
      <span className="col-span-1 text-xs font-bold text-[#5B6B82]">#{idx + 1}</span>
      <Input placeholder="Entregador" className="col-span-4 bg-[#FBFCFE] border-[#E2E8F1]"
        value={card.deliveryPerson} onChange={e => onChange('deliveryPerson', e.target.value)} onKeyDown={handleEnterBlur} />
      <div className="col-span-3">
        <Input placeholder="R$ 0,00" className="bg-[#FBFCFE] border-[#E2E8F1]"
          value={editing ? draft : toBRL(card.value || 0)}
          onFocus={() => { setEditing(true); setDraft(card.value ? String(card.value) : ''); }}
          onBlur={() => { onChange('value', parseBRL(draft) || parseFloat(draft) || 0); setEditing(false); }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleEnterBlur} />
      </div>
      <div className="col-span-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal bg-white">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {card.deliveryDate ? format(new Date(card.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single"
              selected={card.deliveryDate ? new Date(card.deliveryDate + 'T12:00:00') : undefined}
              onSelect={d => { onChange('deliveryDate', d ? format(d, 'yyyy-MM-dd') : undefined); setOpen(false); }}
              locale={ptBR} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>
      <Button variant="ghost" size="icon" className="col-span-1" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
