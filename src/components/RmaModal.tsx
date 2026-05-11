import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Order, RmaItem, RmaItemStatus, FreightCard,
  Company, Seller, SELLERS,
  RMA_ITEM_STATUSES, RMA_STATUS_LABELS, RMA_STATUS_COLORS,
  calcFreightTotal,
} from '@/store/OrderStore';
import { useCreateRma } from '@/api/hooks/useRma';
import { getApiError } from '@/api/client';
import type { CreateRmaPayload } from '@/types/api';

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

interface Props {
  open: boolean;
  onClose: () => void;
  /** All orders — used to filter for "Delivered" candidates */
  orders: Order[];
  /** Existing RMA being edited — when set, the modal opens directly in 'form' step */
  rma?: Order | null;
  onSave: (rma: Order) => void;
  nextRmaNumber: (parentOs: string) => string;
}

export function RmaModal({ open, onClose, orders, rma, onSave, nextRmaNumber }: Props) {
  const isEdit = !!rma;
  const [step, setStep] = useState<Step>(isEdit ? 'form' : 'pick-order');

  const { mutate: createRma, isPending } = useCreateRma();
  const [search, setSearch] = useState('');
  const [parent, setParent] = useState<Order | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

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

  // Reset on open
  useEffect(() => {
    if (!open) return;
    if (rma) {
      // EDIT mode
      const parentOrder = orders.find(o => o.id === rma.rmaParentOrderId) || null;
      setParent(parentOrder);
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
      setSearch('');
      setParent(null);
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
  }, [open, rma, orders]);

  /* ---------- Step 1: order list ---------- */
  const deliveredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders
      .filter(o => o.status === 'Delivered' && !o.isRMA)
      .filter(o => !q || (
        o.os.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        (o.cnpj || '').toLowerCase().includes(q)
      ));
  }, [orders, search]);

  const choosePicked = (o: Order) => {
    setParent(o);
    setSelectedItemIds(new Set());
    setCompany(o.company);
    setSeller(o.seller);
    setRmaNumberDisplay(nextRmaNumber(o.os));
    setStep('pick-items');
  };

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ---------- Step 2 → 3: build RmaItems ---------- */
  const goToForm = () => {
    if (!parent) return;
    const picked = parent.items.filter(i => selectedItemIds.has(i.id));
    setRmaItems(picked.map<RmaItem>(i => ({
      id: crypto.randomUUID(),
      sourceItemId: i.id,
      name: i.name,
      quantity: i.quantity,
      repairedBy: '',
      status: 'Not Received',
    })));
    setStep('form');
  };

  const updateRmaItem = (id: string, field: keyof RmaItem, value: any) => {
    setRmaItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  /* ---------- Freight ---------- */
  const addFreight = () => setFreight(prev => [...prev, {
    id: crypto.randomUUID(), deliveryPerson: '', value: 0, deliveryDate: undefined,
  }]);
  const updateFreight = (id: string, field: keyof FreightCard, value: any) => {
    setFreight(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
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
      // Sem endpoint de update para RMA — mantém comportamento local
      onSave(newOrder);
      onClose();
      return;
    }

    const payload: CreateRmaPayload = {
      id_pedido_origem: parent.id,
      prazo_entrega: deliveryDate || undefined,
      itens: rmaItems.map(i => ({
        descricao: i.name,
        quantidade: i.quantity,
      })),
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
          <DialogTitle className="text-secondary text-xl flex items-center gap-2">
            {!isEdit && step !== 'pick-order' && (
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setStep(step === 'form' ? 'pick-items' : 'pick-order')}>
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
                placeholder="Buscar OS, Cliente ou CNPJ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleEnterBlur}
                className="pl-9 bg-white"
                autoFocus
              />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead>OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Data Entrega</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveredOrders.map(o => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => choosePicked(o)}>
                      <TableCell className="font-medium">{o.os}</TableCell>
                      <TableCell>{o.customer}</TableCell>
                      <TableCell>{o.cnpj || '—'}</TableCell>
                      <TableCell>{o.company || '—'}</TableCell>
                      <TableCell>{fmtDate(o.deliveryDate)}</TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {deliveredOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum pedido entregue encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* ===== STEP 2: pick items ===== */}
        {step === 'pick-items' && parent && (
          <>
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{parent.customer}</span>
              {' · '}CPF/CNPJ: <span className="font-medium text-foreground">{parent.cnpj || '—'}</span>
            </p>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/10">
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parent.items.map(it => (
                    <TableRow key={it.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleItem(it.id)}>
                      <TableCell><Checkbox checked={selectedItemIds.has(it.id)} onCheckedChange={() => toggleItem(it.id)} /></TableCell>
                      <TableCell>{it.name}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                    </TableRow>
                  ))}
                  {parent.items.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem itens neste pedido</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={goToForm} disabled={selectedItemIds.size === 0} className="bg-secondary hover:bg-secondary/90">
                Próximo ({selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'itens'})
              </Button>
            </div>
          </>
        )}

        {/* ===== STEP 3: final form ===== */}
        {step === 'form' && parent && (
          <>
            <section className="border rounded-lg p-4">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Informações Gerais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label>Nº RMA (auto)</Label>
                  <Input readOnly className="bg-muted border-border font-semibold" value={rmaNumberDisplay} />
                </div>
                <div><Label>Cliente</Label><Input readOnly value={parent.customer} className="bg-muted border-border" /></div>
                <div><Label>CPF/CNPJ</Label><Input readOnly value={parent.cnpj || '—'} className="bg-muted border-border" /></div>
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
                    <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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
                    <SelectTrigger className="bg-white border-border"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {SELLERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                  <Label>Data de Entrega</Label>
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
                  <Input readOnly value={toBRL(freightTotal)} className="bg-muted border-border font-semibold" />
                </div>
              </div>
            </section>

            <section className="border rounded-lg p-4">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Produtos do RMA</h3>
              <div className="space-y-3">
                {rmaItems.map(it => (
                  <div key={it.id} className="border rounded-md p-3 bg-muted/20 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label>Produto</Label>
                      <Input className="bg-white border-border" value={it.name}
                        onChange={e => updateRmaItem(it.id, 'name', e.target.value)} onKeyDown={handleEnterBlur} />
                    </div>
                    <div>
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} className="bg-white border-border" value={it.quantity}
                        onChange={e => updateRmaItem(it.id, 'quantity', parseInt(e.target.value) || 1)} onKeyDown={handleEnterBlur} />
                    </div>
                    <div>
                      <Label>Reparado por</Label>
                      <Input
                        className="bg-white border-border"
                        value={it.repairedBy || ''}
                        onChange={e => updateRmaItem(it.id, 'repairedBy', e.target.value)}
                        onKeyDown={handleEnterBlur}
                        placeholder="Fornecedor / técnico"
                      />
                    </div>
                    <div>
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
                  </div>
                ))}
              </div>
            </section>

            {/* Freight section */}
            <section className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wide">Frete</h3>
                <Button size="sm" onClick={addFreight} className="bg-secondary hover:bg-secondary/90">
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
              <div className="mt-3 text-right text-sm font-semibold text-secondary">
                Total: {toBRL(freightTotal)}
              </div>
            </section>

            {/* Observations section */}
            <section className="border rounded-lg p-4">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Observações</h3>
              <Textarea
                className="bg-white border-border min-h-24"
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
              <Button onClick={handleSave} disabled={isPending} className="bg-secondary hover:bg-secondary/90">
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
    <div className="grid grid-cols-12 gap-2 items-center border rounded-md p-2 bg-muted/20">
      <span className="col-span-1 text-xs font-bold text-secondary">#{idx + 1}</span>
      <Input placeholder="Entregador" className="col-span-4 bg-white border-border"
        value={card.deliveryPerson} onChange={e => onChange('deliveryPerson', e.target.value)} onKeyDown={handleEnterBlur} />
      <div className="col-span-3">
        <Input placeholder="R$ 0,00" className="bg-white border-border"
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
