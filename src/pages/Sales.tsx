import { useState, useMemo, memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrdersQuery, OrderFilters, PedidoListItem, FreteApiItem } from '@/hooks/use-orders-query';
import { useQuotes as useQuotesAPI, useDeleteQuote } from '@/api/hooks/useQuotes';
import { useRmas } from '@/api/hooks/useRma';
import { useUpdateItemStatus, useUpdateOrderStatusInline } from '@/api/hooks/useOrders';
import type { CotacaoResponse, CotacaoFilters, RmaFilters, RmaResponse, RmaStatus, PedidoStatus, ItemRmaStatus } from '@/types/api';
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
  useOrders, Order, OrderItem, DirectSupplyOrderItem, SubPurchase, OrderStatus, ItemStatus, Company, Seller,
  ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ITEM_STATUS_COLORS,
  WARN_STATUSES, isOpenOrder, calcItemLatestDelivery,
  RMA_STATUS_LABELS, RMA_STATUS_COLORS, PaymentInstallment, PaymentMethod,
} from '@/store/OrderStore';
import {
  useQuotes as useLocalQuotes, Quote, DirectSupplyQuoteItem, QuotePhaseKey, QUOTE_PHASE_LABELS, QUOTE_PHASE_COLORS,
  getHighestPhase, getPhaseDate, getDisplayValue, emptyPhases,
} from '@/store/QuoteStore';
import { LOJA_IDS, VENDEDOR_IDS, FORMA_PAGAMENTO_MAP } from '@/api/storeConfig';
import { OrderModal } from '@/components/OrderModal';
import { ProductModal } from '@/components/ProductModal';
import { QuoteModal } from '@/components/QuoteModal';
import { RmaModal } from '@/components/RmaModal';
import { RmaEditModal } from '@/components/RmaEditModal';
import { AddOrderChooser, OrderPrefill } from '@/components/AddOrderChooser';
import { DateFilter, DateRange } from '@/components/DateFilter';
import { Pagination, PAGE_SIZE } from '@/components/Pagination';

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  'To Buy': 'A Comprar', 'Bought': 'Comprado', 'In Stock': 'Em Estoque',
};

const ITEM_STATUS_ORDER: ItemStatus[] = ['To Buy', 'Bought', 'In Stock'];

function minItemStatus(statuses: string[]): ItemStatus | null {
  let minIdx = Infinity;
  let minStatus: ItemStatus | null = null;
  for (const s of statuses) {
    const idx = ITEM_STATUS_ORDER.indexOf(s as ItemStatus);
    if (idx !== -1 && idx < minIdx) { minIdx = idx; minStatus = s as ItemStatus; }
  }
  return minStatus;
}

function getOrderDisplayStatus(item: PedidoListItem): ItemStatus | null {
  if (!item.produtos || item.produtos.length === 0) return null;
  const effectiveStatuses = item.produtos.map(p =>
    p.sub_compras && p.sub_compras.length > 0
      ? minItemStatus(p.sub_compras.map(sc => sc.status))
      : (p.status as ItemStatus)
  ).filter((s): s is ItemStatus => s !== null);
  return minItemStatus(effectiveStatuses);
}

// ── Reverse-lookup ID → name ──────────────────────────────────────────────
const LOJA_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(LOJA_IDS).map(([name, id]) => [id, name])
);
const VENDEDOR_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(VENDEDOR_IDS).map(([name, id]) => [id, name])
);

// ── CotacaoResponse helpers ───────────────────────────────────────────────
function getCotacaoPhase(c: CotacaoResponse): QuotePhaseKey | null {
  if (c.status_caida) return 'dropped';
  if (c.status_fechada) return 'closed';
  if (c.status_em_fechamento) return 'forClosing';
  if (c.status_enviada) return 'sent';
  return null;
}

function getCotacaoDisplayValue(c: CotacaoResponse): number {
  return parseFloat(c.valor_total ?? '0') || 0;
}

function cleanStr(v: string | null | undefined): string {
  const s = v?.trim() ?? '';
  return s === 'string' ? '' : s;
}

function cotacaoToQuote(c: CotacaoResponse): Quote {
  const allItems = c.itens ?? [];
  const hasDirect = allItems.some(i => i.is_direct_supply);
  return {
    id: c.id,
    index: '',
    createdAt: new Date(c.created_at).getTime(),
    customer: cleanStr(c.cliente),
    cnpj: cleanStr(c.cnpj_cliente),
    requestNumber: cleanStr(c.numero_requisicao),
    requestDate: c.data_cotacao,
    b2bCompany: cleanStr(c.b2b_company),
    company: (LOJA_BY_ID[c.id_loja] ?? '') as any,
    directBilling: c.is_direct_billing || hasDirect,
    supplier: cleanStr(c.fornecedor),
    seller: (VENDEDOR_BY_ID[c.id_vendedor] ?? '') as any,
    value: parseFloat(c.valor_total ?? '0') || 0,
    items: allItems.filter(i => !i.is_direct_supply).map(i => ({
      id: i.id,
      name: cleanStr(i.descricao),
      quantity: i.quantidade,
      quoteValue: parseFloat(i.valor_unitario) || 0,
      closingValue: i.valor_fechamento ? parseFloat(i.valor_fechamento) : 0,
      supplier: cleanStr(i.fornecedor),
    })),
    directSupplyItems: allItems.filter(i => i.is_direct_supply).map(i => ({
      id: i.id,
      name: cleanStr(i.descricao),
      quantity: i.quantidade,
      quoteValue: parseFloat(i.valor_unitario) || 0,
      closingValue: i.valor_fechamento ? parseFloat(i.valor_fechamento) : 0,
      supplier: cleanStr(i.fornecedor),
      supplierPct: parseFloat(i.porcentagem_fornecedor ?? '0') || 0,
      supplierFreight: parseFloat(i.frete_fornecedor ?? '0') || 0,
    } as DirectSupplyQuoteItem)),
    observations: cleanStr(c.observacao),
    phases: {
      sent: { active: c.status_enviada, date: c.data_envio ?? undefined },
      forClosing: { active: c.status_em_fechamento, expectedDate: c.data_prevista_fechamento ?? undefined },
      closed: {
        active: c.status_fechada,
        date: c.data_fechamento ?? undefined,
        value: c.valor_fechamento ? parseFloat(c.valor_fechamento) : (parseFloat(c.valor_total ?? '0') || 0),
      },
      dropped: { active: c.status_caida, date: c.data_queda ?? undefined },
    },
    taxLucky: parseFloat(c.pct_imposto_lucky ?? '0') || 0,
    taxBTech: parseFloat(c.pct_imposto_btech ?? '0') || 0,
  };
}

// ── RMA status display ────────────────────────────────────────────────────
const RMA_STATUS_OPTIONS: { value: RmaStatus; label: string; color: string }[] = [
  { value: 'Registered',  label: 'Registrado',   color: 'bg-blue-50 text-blue-700 border-blue-300' },
  { value: 'In Analysis', label: 'Em Análise',    color: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  { value: 'Approved',    label: 'Aprovado',      color: 'bg-green-50 text-green-700 border-green-300' },
  { value: 'In Repair',   label: 'Em Reparo',     color: 'bg-orange-50 text-orange-700 border-orange-300' },
  { value: 'Repaired',    label: 'Reparado',      color: 'bg-teal-50 text-teal-700 border-teal-300' },
  { value: 'Ready',       label: 'Pronto',        color: 'bg-cyan-50 text-cyan-700 border-cyan-300' },
  { value: 'Shipped',     label: 'Enviado',       color: 'bg-indigo-50 text-indigo-700 border-indigo-300' },
  { value: 'Delivered',   label: 'Entregue',      color: 'bg-green-100 text-green-800 border-green-400' },
  { value: 'Cancelled',   label: 'Cancelado',     color: 'bg-red-50 text-red-700 border-red-300' },
  { value: 'Completed',   label: 'Concluído',     color: 'bg-purple-50 text-purple-700 border-purple-300' },
];
const RMA_FULL_STATUS_LABELS: Record<string, string> = Object.fromEntries(RMA_STATUS_OPTIONS.map(o => [o.value, o.label]));
const RMA_FULL_STATUS_COLORS: Record<string, string> = Object.fromEntries(RMA_STATUS_OPTIONS.map(o => [o.value, o.color]));

const ITEM_RMA_STATUS_ORDER: ItemRmaStatus[] = [
  'Not Received', 'Received', 'Sent for Repair', 'In Repair',
  'Repaired Not Received', 'Repaired Received',
  'To Pack', 'Ready for Delivery', 'Out for Delivery', 'Delivered',
];

const ITEM_RMA_STATUS_LABELS: Record<ItemRmaStatus, string> = {
  'Not Received':          'Não Recebido',
  'Received':              'Recebido',
  'Sent for Repair':       'Enviado p/ Reparo',
  'In Repair':             'Em Reparo',
  'Repaired Not Received': 'Reparado (Não Recebido)',
  'Repaired Received':     'Reparado e Recebido',
  'To Pack':               'A Embalar',
  'Ready for Delivery':    'Pronto p/ Entrega',
  'Out for Delivery':      'Em Entrega',
  'Delivered':             'Entregue',
};

const ITEM_RMA_STATUS_COLORS: Record<ItemRmaStatus, string> = {
  'Not Received':          'bg-[hsl(var(--st-cancelled)/0.18)] text-[hsl(var(--st-cancelled))] border-[hsl(var(--st-cancelled)/0.5)]',
  'Received':              'bg-[hsl(var(--st-received)/0.18)] text-[hsl(var(--st-received))] border-[hsl(var(--st-received)/0.5)]',
  'Sent for Repair':       'bg-[hsl(var(--st-tobuy)/0.18)] text-[hsl(var(--st-tobuy))] border-[hsl(var(--st-tobuy)/0.5)]',
  'In Repair':             'bg-[hsl(var(--st-bought)/0.18)] text-[hsl(var(--st-bought))] border-[hsl(var(--st-bought)/0.5)]',
  'Repaired Not Received': 'bg-[hsl(var(--st-invoiced-pending)/0.18)] text-[hsl(var(--st-invoiced-pending))] border-[hsl(var(--st-invoiced-pending)/0.6)]',
  'Repaired Received':     'bg-[hsl(var(--st-invoiced-received)/0.4)] text-[hsl(22_85%_30%)] border-[hsl(var(--st-invoiced-received))]',
  'To Pack':               'bg-[hsl(var(--st-topack)/0.35)] text-[hsl(220_70%_30%)] border-[hsl(var(--st-topack))]',
  'Ready for Delivery':    'bg-[hsl(var(--st-ready)/0.18)] text-[hsl(var(--st-ready))] border-[hsl(var(--st-ready)/0.6)]',
  'Out for Delivery':      'bg-[hsl(var(--st-delivering)/0.4)] text-[hsl(140_70%_22%)] border-[hsl(var(--st-delivering))]',
  'Delivered':             'bg-[hsl(var(--st-delivered)/0.18)] text-[hsl(var(--st-delivered))] border-[hsl(var(--st-delivered)/0.6)]',
};

function getRmaDisplayStatus(rma: RmaResponse): ItemRmaStatus | null {
  if (!rma.itens || rma.itens.length === 0) return null;
  let minIdx = Infinity;
  let minStatus: ItemRmaStatus | null = null;
  for (const item of rma.itens) {
    const idx = ITEM_RMA_STATUS_ORDER.indexOf(item.status as ItemRmaStatus);
    if (idx !== -1 && idx < minIdx) { minIdx = idx; minStatus = item.status as ItemRmaStatus; }
  }
  return minStatus;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return format(new Date(iso + 'T12:00:00'), 'dd/MM/yyyy');
}

// API forma string → frontend PaymentMethod
const FORMA_TO_PAYMENT: Record<string, PaymentMethod> = Object.fromEntries(
  Object.entries(FORMA_PAGAMENTO_MAP).map(([k, v]) => [v, k as PaymentMethod])
);

function pedidoListToOrder(item: PedidoListItem): Order {
  return {
    id: item.id,
    os: item.numero_os,
    createdAt: Date.now(),
    orderDate: item.data_pedido,
    customer: item.nome_cliente ?? '',
    cnpj: item.cnpj_cliente ?? '',
    company: (item.nome_loja ?? '') as Company,
    seller: (item.nome_vendedor ?? '') as Seller,
    ocAfPed: item.numero_oc ?? '',
    directBilling: item.is_direct_billing ?? false,
    supplier: item.fornecedor_principal ?? '',
    invoice: item.numero_nf ?? '',
    invoiceSupplier: item.nota_fiscal_fornecedor ?? '',
    paymentMethods: (item.formas_pagamento ?? [])
      .map(fp => FORMA_TO_PAYMENT[fp.forma])
      .filter(Boolean) as PaymentMethod[],
    installments: item.parcelas ?? 1,
    deliveryDate: item.data_entrega,
    status: item.status as OrderStatus,
    isRMA: item.is_rma ?? false,
    cancelled: item.is_cancelled ?? false,
    observations: item.observacao ?? '',
    initialProductCost: parseFloat(item.custo?.custo_produto_inicial ?? '0') || 0,
    finalProductCost:   parseFloat(item.custo?.custo_produto_final   ?? '0') || 0,
    boletoCost:         parseFloat(item.custo?.custo_boleto           ?? '0') || 0,
    giftCost:           parseFloat(item.custo?.brinde                 ?? '0') || 0,
    creditCostPercent:  parseFloat(item.custo?.pct_custo_credito      ?? '0') || 0,
    creditCostValue:    parseFloat(item.custo?.custo_credito          ?? '0') || 0,
    debitCostPercent:   parseFloat(item.custo?.pct_custo_debito       ?? '0') || 0,
    debitCostValue:     parseFloat(item.custo?.custo_debito           ?? '0') || 0,
    purchaseTaxPercent: parseFloat(item.custo?.pct_imposto_compra     ?? '0') || 0,
    purchaseTaxValue:   parseFloat(item.custo?.imposto_compra         ?? '0') || 0,
    salesTaxPercent:    parseFloat(item.custo?.pct_imposto_venda      ?? '0') || 0,
    salesTaxValue:      parseFloat(item.custo?.imposto_venda          ?? '0') || 0,
    salesValue: item.valor_venda ?? 0,
    items: (item.produtos ?? []).filter(p => !p.is_direct_supply).map(p => ({
      id: p.id,
      name: p.descricao,
      quantity: p.quantidade,
      status: p.status as ItemStatus,
      projectedValue: parseFloat(String(p.valor_projetado)) || 0,
      purchaseValue: parseFloat(String(p.valor_compra ?? '0')) || 0,
    })),
    directSupplyItems: (item.produtos ?? []).filter(p => p.is_direct_supply).map(p => ({
      id: p.id,
      name: p.descricao,
      quantity: p.quantidade,
      projectedValue: parseFloat(String(p.valor_projetado)) || 0,
      closingValue: parseFloat(String(p.valor_compra ?? '0')) || 0,
      supplier: p.fornecedor ?? '',
      supplierPct: parseFloat(String(p.porcentagem_fornecedor ?? '0')) || 0,
      supplierFreight: parseFloat(String(p.frete_fornecedor ?? '0')) || 0,
      supplierInvoice: p.nota_fiscal_item ?? '',
    } as DirectSupplyOrderItem)),
    freight: (item.fretes ?? []).map((f: FreteApiItem) => ({
      id: f.id,
      deliveryPerson: f.entregador ?? '',
      value: parseFloat(String(f.valor)) || 0,
      deliveryDate: f.data_frete ?? undefined,
    })),
    paymentDate: item.data_pagamento ?? '',
    penaltyValue: parseFloat(String(item.multa ?? '0')) || 0,
    interestValue: parseFloat(String(item.juros ?? '0')) || 0,
    paymentMethod: (Object.entries(FORMA_PAGAMENTO_MAP).find(([, v]) => v === item.forma_pagamento_efetiva)?.[0] ?? '') as PaymentMethod | '',
    paymentInstallments: item.num_parcelas_efetivas ?? 1,
    paymentInstallmentPlan: (item.plano_parcelas ?? []) as PaymentInstallment[],
  };
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


export default function Sales() {
  const { orders, addOrder, updateOrder, deleteOrder, updateItemStatus, nextOS, nextRmaNumber } = useOrders();
  const { nextIndex } = useLocalQuotes();
  const { mutate: deleteQuoteMutation } = useDeleteQuote();
  const [tab, setTab] = useState('orders');
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productModalCtx, setProductModalCtx] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [rmaModalOpen, setRmaModalOpen] = useState(false);
  const [editRma, setEditRma] = useState<Order | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [orderPrefill, setOrderPrefill] = useState<OrderPrefill | null>(null);

  /* ---------- Orders tab state ---------- */
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDateField, setOrderDateField] = useState<'orderDate' | 'deliveryDate'>('deliveryDate');
  const [orderRange, setOrderRange] = useState<DateRange>({});
  const [orderView, setOrderView] = useState<'all' | 'open' | 'rma'>('all');
  const [orderAlertsOnly, setOrderAlertsOnly] = useState(false);
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1, limit: 20, sort_by: 'data_pedido', sort_dir: 'desc',
  });
  const { data, isLoading, isError, refetch } = useOrdersQuery(filters);

  /* ---------- Products-specific API query (no pagination, loads all) ---------- */
  const prodApiFilters = useMemo<OrderFilters>(
    () => ({ page: 1, limit: 500, sort_by: 'data_pedido', sort_dir: 'desc' }),
    []
  );
  const { data: prodOrdersData } = useOrdersQuery(prodApiFilters, { enabled: tab === 'products' });

  /* ---------- Item / Order status update hooks ---------- */
  const { mutate: updateItemStatusApi } = useUpdateItemStatus();
  const { mutate: updateOrderStatusInline } = useUpdateOrderStatusInline();

  const displayedOrders = useMemo<PedidoListItem[]>(() => {
    if (orderView === 'rma') return [];

    const q = orderSearch.toLowerCase().trim();

    return (data?.items ?? [])
      .filter(item => orderView === 'all' || isOpenOrder(item.status as OrderStatus))
      .filter(item => !orderAlertsOnly || (
        WARN_STATUSES.includes(item.status as OrderStatus) &&
        differenceInCalendarDays(new Date(item.data_entrega + 'T12:00:00'), new Date()) <= 3
      ))
      .filter(item => !q || (
        item.numero_os.toLowerCase().includes(q) ||
        (item.nome_cliente ?? '').toLowerCase().includes(q) ||
        (item.cnpj_cliente ?? '').toLowerCase().includes(q) ||
        (item.nome_loja ?? '').toLowerCase().includes(q) ||
        (item.nome_vendedor ?? '').toLowerCase().includes(q)
      ))
      .filter(item => {
        if (!orderRange.from || orderDateField !== 'deliveryDate') return true;
        return isInRange(item.data_entrega, orderRange);
      });
  }, [data, orderView, orderAlertsOnly, orderSearch, orderRange, orderDateField]);

  /* ---------- Products tab state ---------- */
  const [prodSearch, setProdSearch] = useState('');
  const [prodView, setProdView] = useState<'all' | 'open'>('open');
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
  const [quoteApiFilters, setQuoteApiFilters] = useState<CotacaoFilters>({
    page: 1, limit: 20, sort_by: 'data_cotacao', sort_dir: 'desc',
  });
  const { data: quotesData, isLoading: quotesLoading, isError: quotesError, refetch: quotesRefetch } =
    useQuotesAPI(quoteApiFilters);

  /* ---------- RMA tab state ---------- */
  const [rmaSearch, setRmaSearch] = useState('');
  const [rmaDateRange, setRmaDateRange] = useState<DateRange>({});
  const [rmaEditModalOpen, setRmaEditModalOpen] = useState(false);
  const [editingRma, setEditingRma] = useState<RmaResponse | null>(null);
  const [rmaApiFilters, setRmaApiFilters] = useState<RmaFilters>({
    page: 1, limit: 20, sort_by: 'data_registro', sort_dir: 'desc',
  });
  const { data: rmasData, isLoading: rmasLoading, isError: rmasError, refetch: rmasRefetch } =
    useRmas(rmaApiFilters);

  const toggleSort = (field: string) => {
    setFilters(f => ({
      ...f,
      sort_by: field,
      sort_dir: f.sort_by === field && f.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  /* ---------- Quotes (API-backed, client-side search/status/phaseDate filter on top) ---------- */
  const filteredQuotes = useMemo(() => {
    const items = quotesData?.items ?? [];
    const q = quoteSearch.toLowerCase().trim();
    return items.filter(qt => {
      const highest = getCotacaoPhase(qt);
      if (quoteStatusFilter !== 'all' && highest !== quoteStatusFilter) return false;
      if (q && !(
        qt.cliente.toLowerCase().includes(q) ||
        (qt.numero_requisicao ?? '').toLowerCase().includes(q) ||
        (qt.b2b_company ?? '').toLowerCase().includes(q) ||
        (LOJA_BY_ID[qt.id_loja] ?? '').toLowerCase().includes(q) ||
        (VENDEDOR_BY_ID[qt.id_vendedor] ?? '').toLowerCase().includes(q)
      )) return false;
      if (quoteRange.from && quoteDateField === 'phaseDate') {
        if (!qt.data_validade || !isInRange(qt.data_validade, quoteRange)) return false;
      }
      return true;
    });
  }, [quotesData, quoteSearch, quoteStatusFilter, quoteRange, quoteDateField]);

  /* ---------- RMAs (client-side search on top of API data) ---------- */
  const filteredRmas = useMemo(() => {
    const items = rmasData?.items ?? [];
    const q = rmaSearch.toLowerCase().trim();
    if (!q) return items;
    return items.filter(r =>
      r.numero_rma.toLowerCase().includes(q) ||
      r.id_pedido_origem.toLowerCase().includes(q) ||
      (RMA_FULL_STATUS_LABELS[r.status] ?? r.status).toLowerCase().includes(q)
    );
  }, [rmasData, rmaSearch]);

  /* ---------- Products (from API) ---------- */
  const products = useMemo(() => {
    const q = prodSearch.toLowerCase().trim();
    const sourceOrders = (prodOrdersData?.items ?? []).filter(
      o => !o.is_rma && (prodView === 'all' || isOpenOrder(o.status as OrderStatus))
    );
    const list = sourceOrders
      .flatMap(o => (o.produtos ?? []).filter(p => !p.is_direct_supply).map(p => ({
        id: p.id,
        name: p.descricao,
        quantity: p.quantidade,
        status: (p.sub_compras && p.sub_compras.length > 0
          ? (minItemStatus(p.sub_compras.map((sc: any) => sc.status)) ?? p.status)
          : p.status),
        projectedValue: parseFloat(p.valor_projetado) || 0,
        purchaseValue: parseFloat(p.valor_compra ?? '0') || 0,
        orderId: o.id,
        os: o.numero_os,
        customer: o.nome_cliente ?? '',
        company: o.nome_loja ?? '',
        seller: o.nome_vendedor ?? '',
        orderDeliveryDate: o.data_entrega,
        productDeliveryDate: p.prazo_entrega ?? undefined,
        createdAt: new Date(o.data_pedido).getTime(),
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
  }, [prodOrdersData, prodSearch, prodView, prodDateField, prodRange, prodStatusFilter, prodAlertsOnly]);

  const prodPageCount = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pagedProducts = useMemo(
    () => products.slice((prodPage - 1) * PAGE_SIZE, prodPage * PAGE_SIZE),
    [products, prodPage]
  );

  const openProductModal = (orderId: string, itemId: string) => {
    const pedido = (prodOrdersData?.items ?? []).find(o => o.id === orderId);
    const produto = pedido?.produtos?.find(p => p.id === itemId);
    if (!pedido || !produto) return;
    const order = pedidoListToOrder(pedido);
    const savedPurchaseValue = parseFloat(String(produto.valor_compra ?? '0')) || 0;

    const subPurchases: SubPurchase[] = produto.sub_compras && produto.sub_compras.length > 0
      ? produto.sub_compras.map(sp => ({ ...sp, status: sp.status as ItemStatus }))
      : savedPurchaseValue > 0 ? [{
          id: crypto.randomUUID(),
          selectedQuantity: produto.quantidade,
          supplier: produto.fornecedor ?? '',
          buyer: '',
          purchaseDate: produto.data_compra ?? undefined,
          productDeliveryDate: produto.prazo_entrega ?? undefined,
          receiptDate: produto.data_recebimento ?? undefined,
          purchaseValue: savedPurchaseValue,
          paymentMethod: '',
          status: produto.status as ItemStatus,
        }] : [];

    const item: OrderItem = {
      id: produto.id,
      name: produto.descricao,
      quantity: produto.quantidade,
      status: produto.status as ItemStatus,
      projectedValue: parseFloat(String(produto.valor_projetado)) || 0,
      purchaseValue: savedPurchaseValue,
      subPurchases,
    };
    setProductModalCtx({ order, item });
    setProductModalOpen(true);
  };

  const SortArrow = ({ field }: { field: string }) => {
    const active = filters.sort_by === field;
    const Icon = active && filters.sort_dir === 'desc' ? ArrowDown : ArrowUp;
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
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold text-secondary">
                    Total - {formatBRL(filteredQuotes.reduce((s, qt) => s + getCotacaoDisplayValue(qt), 0))}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <SearchBar value={quoteSearch} onChange={setQuoteSearch} placeholder="Cliente, Req, Empresa, Vendedor..." />
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
                    <DateFilter
                      field={quoteDateField}
                      onFieldChange={v => {
                        setQuoteDateField(v as any);
                        setQuoteRange({});
                        setQuoteApiFilters(f => ({ ...f, data_inicio: undefined, data_fim: undefined, page: 1 }));
                      }}
                      fieldOptions={[
                        { value: 'requestDate', label: 'Data Requisição' },
                        { value: 'phaseDate',   label: 'Data Validade' },
                      ]}
                      range={quoteRange}
                      onRangeChange={range => {
                        setQuoteRange(range);
                        if (quoteDateField === 'requestDate') {
                          setQuoteApiFilters(f => ({
                            ...f,
                            data_inicio: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
                            data_fim: range.to ? format(range.to, 'yyyy-MM-dd') : (range.from ? format(range.from, 'yyyy-MM-dd') : undefined),
                            page: 1,
                          }));
                        }
                      }}
                    />
                    {(quoteSearch || quoteStatusFilter !== 'all' || quoteRange.from) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => {
                          setQuoteSearch('');
                          setQuoteStatusFilter('all');
                          setQuoteRange({});
                          setQuoteApiFilters(f => ({ ...f, data_inicio: undefined, data_fim: undefined, page: 1 }));
                        }}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={() => { setEditQuote(null); setQuoteModalOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                      <Plus className="h-4 w-4 mr-1" /> Nova Cotação
                    </Button>
                  </div>
                </div>
                {quotesError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription className="flex items-center justify-between">
                      <span>Falha ao carregar cotações.</span>
                      <Button variant="outline" size="sm" onClick={() => quotesRefetch()}>Tentar novamente</Button>
                    </AlertDescription>
                  </Alert>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/10">
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data Requisição</TableHead>
                        <TableHead>Nº Requisição</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotesLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredQuotes.map(qt => {
                        const highest = getCotacaoPhase(qt);
                        return (
                          <TableRow key={qt.id} className="cursor-pointer hover:bg-muted/50"
                            onClick={() => { setEditQuote(cotacaoToQuote(qt)); setQuoteModalOpen(true); }}>
                            <TableCell className="font-medium">{qt.b2b_company?.trim() || qt.cliente}</TableCell>
                            <TableCell>{fmtDate(qt.data_cotacao)}</TableCell>
                            <TableCell>{qt.numero_requisicao || '—'}</TableCell>
                            <TableCell>{LOJA_BY_ID[qt.id_loja] || '—'}</TableCell>
                            <TableCell>{VENDEDOR_BY_ID[qt.id_vendedor] || '—'}</TableCell>
                            <TableCell>
                              {highest ? (
                                <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', QUOTE_PHASE_COLORS[highest])}>
                                  {QUOTE_PHASE_LABELS[highest]}
                                </span>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>{qt.itens?.length ?? 0}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {qt.valor_total ? formatBRL(parseFloat(qt.valor_total)) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!quotesLoading && filteredQuotes.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma cotação encontrada</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  page={quoteApiFilters.page ?? 1}
                  pageCount={quotesData?.pages ?? 1}
                  total={quotesData?.total ?? 0}
                  pageSize={quoteApiFilters.limit ?? 20}
                  onPageChange={p => setQuoteApiFilters(f => ({ ...f, page: p }))}
                />
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
                        onClick={() => { setOrderView(opt.v); setFilters(f => ({ ...f, status: undefined, page: 1 })); }}
                        className={cn(
                          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                          orderView === opt.v ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >{opt.l}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {orderView === 'rma' ? (
                      <>
                        <SearchBar value={rmaSearch} onChange={setRmaSearch} placeholder="Nº RMA, Pedido origem..." />
                        <Select
                          value={rmaApiFilters.status ?? 'all'}
                          onValueChange={v => setRmaApiFilters(f => ({ ...f, status: v === 'all' ? undefined : v as RmaStatus, page: 1 }))}
                        >
                          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Status</SelectItem>
                            {RMA_STATUS_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', opt.color)}>{opt.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <DateFilter
                          field="data_registro"
                          onFieldChange={() => {}}
                          fieldOptions={[{ value: 'data_registro', label: 'Data de Registro' }]}
                          range={rmaDateRange}
                          onRangeChange={range => {
                            setRmaDateRange(range);
                            setRmaApiFilters(f => ({
                              ...f,
                              data_inicio: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
                              data_fim: range.to ? format(range.to, 'yyyy-MM-dd') : (range.from ? format(range.from, 'yyyy-MM-dd') : undefined),
                              page: 1,
                            }));
                          }}
                        />
                        {(rmaSearch || rmaApiFilters.status || rmaDateRange.from) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setRmaSearch('');
                            setRmaDateRange({});
                            setRmaApiFilters(f => ({ ...f, status: undefined, data_inicio: undefined, data_fim: undefined, page: 1 }));
                          }}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <SearchBar value={orderSearch} onChange={setOrderSearch} placeholder="OS, Cliente, CPF/CNPJ, Empresa, Vendedor..." />
                        <Button
                          variant={orderAlertsOnly ? 'default' : 'outline'}
                          onClick={() => setOrderAlertsOnly(v => !v)}
                          className={cn('gap-1.5', orderAlertsOnly ? 'bg-[hsl(var(--st-invoiced-pending))] text-white hover:bg-[hsl(var(--st-invoiced-pending))]/90' : 'bg-white')}
                        >
                          <AlertTriangle className="h-4 w-4" /> Alertas
                        </Button>
                        <DateFilter
                          field={orderDateField}
                          onFieldChange={v => {
                            setOrderDateField(v as any);
                            setOrderRange({});
                            setFilters(f => ({ ...f, data_inicio: undefined, data_fim: undefined, page: 1 }));
                          }}
                          fieldOptions={[{ value: 'orderDate', label: 'Data do Pedido' }, { value: 'deliveryDate', label: 'Data de Entrega' }]}
                          range={orderRange}
                          onRangeChange={range => {
                            setOrderRange(range);
                            if (orderDateField === 'orderDate') {
                              setFilters(f => ({
                                ...f,
                                data_inicio: range.from ? format(range.from, 'yyyy-MM-dd') : undefined,
                                data_fim: range.to ? format(range.to, 'yyyy-MM-dd') : (range.from ? format(range.from, 'yyyy-MM-dd') : undefined),
                                page: 1,
                              }));
                            }
                          }}
                        />
                        {(orderSearch || orderRange.from || orderAlertsOnly || filters.status) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setOrderSearch(''); setOrderRange({}); setOrderAlertsOnly(false);
                            setFilters(f => ({ ...f, status: undefined, data_inicio: undefined, data_fim: undefined, page: 1 }));
                          }}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mb-4">
                  {orderView !== 'rma' && (
                    <Select value={filters.status ?? 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v, page: 1 }))}>
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
                  )}
                  <div className={cn('flex items-center gap-2', orderView === 'rma' && 'ml-auto')}>
                    <Button onClick={() => { setEditRma(null); setRmaModalOpen(true); }} variant="outline" className="border-secondary text-secondary hover:bg-secondary/10">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar RMA
                    </Button>
                    {orderView !== 'rma' && (
                      <Button onClick={() => { setEditOrder(null); setOrderPrefill(null); setChooserOpen(true); }} className="bg-secondary hover:bg-secondary/90">
                        <Plus className="h-4 w-4 mr-1" /> Adicionar Pedido
                      </Button>
                    )}
                  </div>
                </div>

                {orderView === 'rma' ? (
                  <>
                    {rmasError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription className="flex items-center justify-between">
                          <span>Falha ao carregar RMAs.</span>
                          <Button variant="outline" size="sm" onClick={() => rmasRefetch()}>Tentar novamente</Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-secondary/10">
                            <TableHead>Nº RMA</TableHead>
                            <TableHead>Pedido Origem</TableHead>
                            <TableHead>Data Registro</TableHead>
                            <TableHead>Prazo Entrega</TableHead>
                            <TableHead>Itens</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rmasLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                {Array.from({ length: 6 }).map((_, j) => (
                                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : filteredRmas.map(rma => (
                            <TableRow
                              key={rma.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => { setEditingRma(rma); setRmaEditModalOpen(true); }}
                            >
                              <TableCell className="font-medium">{rma.numero_rma}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {rma.numero_os_origem ?? rma.id_pedido_origem}
                              </TableCell>
                              <TableCell>{fmtDate(rma.data_registro)}</TableCell>
                              <TableCell>{fmtDate(rma.prazo_entrega ?? undefined)}</TableCell>
                              <TableCell>{rma.itens?.length ?? 0}</TableCell>
                              <TableCell>
                                {(() => {
                                  const s = getRmaDisplayStatus(rma);
                                  return s
                                    ? <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', ITEM_RMA_STATUS_COLORS[s])}>{ITEM_RMA_STATUS_LABELS[s]}</span>
                                    : <span className="text-muted-foreground text-xs">—</span>;
                                })()}
                              </TableCell>
                            </TableRow>
                          ))}
                          {!rmasLoading && filteredRmas.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum RMA encontrado</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination
                      page={rmaApiFilters.page ?? 1}
                      pageCount={rmasData?.pages ?? 1}
                      total={rmasData?.total ?? 0}
                      pageSize={rmaApiFilters.limit ?? 20}
                      onPageChange={p => setRmaApiFilters(f => ({ ...f, page: p }))}
                    />
                  </>
                ) : (
                  <>
                    {isError && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertDescription className="flex items-center justify-between">
                          <span>Falha ao carregar pedidos.</span>
                          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-secondary/10">
                            <TableHead><div className="flex items-center gap-1">OS <SortArrow field="numero_os" /></div></TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Loja</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead><div className="flex items-center gap-1">Data de Entrega <SortArrow field="data_entrega" /></div></TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <TableRow key={i}>
                                {Array.from({ length: 7 }).map((_, j) => (
                                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : displayedOrders.map(item => {
                            const warn = WARN_STATUSES.includes(item.status as OrderStatus) &&
                              differenceInCalendarDays(new Date(item.data_entrega + 'T12:00:00'), new Date()) <= 3;
                            return (
                              <TableRow
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => { setEditOrder(pedidoListToOrder(item)); setModalOpen(true); }}
                              >
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
                                    {item.numero_os}
                                    {item.is_rma && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">RMA</span>}
                                  </div>
                                </TableCell>
                                <TableCell>{item.nome_cliente || '—'}</TableCell>
                                <TableCell>{item.nome_loja || '—'}</TableCell>
                                <TableCell>{item.nome_vendedor || '—'}</TableCell>
                                <TableCell>{fmtDate(item.data_entrega)}</TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                  <Select
                                    value={item.status}
                                    onValueChange={v =>
                                      updateOrderStatusInline({ id: item.id, new_status: v as PedidoStatus })
                                    }
                                  >
                                    <SelectTrigger className={cn(
                                      'w-44 h-7 text-xs font-semibold border py-0',
                                      ORDER_STATUS_COLORS[item.status as OrderStatus] ?? 'bg-muted',
                                    )}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_STATUSES.map(s => (
                                        <SelectItem key={s} value={s}>
                                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ORDER_STATUS_COLORS[s])}>
                                            {ORDER_STATUS_LABELS[s]}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {item.is_rma || item.valor_venda == null
                                    ? <span className="text-muted-foreground">—</span>
                                    : formatBRL(item.valor_venda)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {!isLoading && displayedOrders.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <Pagination page={filters.page} pageCount={data?.pages ?? 1} total={data?.total ?? 0} pageSize={20} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============== PRODUCTS TAB ============== */}
          <TabsContent value="products">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold text-secondary">Produtos</h2>
                    <div className="flex items-center gap-1 bg-muted rounded-full p-1">
                      {([
                        { v: 'all', l: 'Todos os Produtos' },
                        { v: 'open', l: 'Pedidos em Aberto' },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setProdView(opt.v)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-all',
                            prodView === opt.v ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>
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
                              <Select value={p.status} onValueChange={v => updateItemStatusApi({ pedidoId: p.orderId, itemId: p.id, newStatus: v })}>
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

        <AddOrderChooser
          open={chooserOpen}
          onClose={() => setChooserOpen(false)}
          onChooseNew={() => { setOrderPrefill(null); setEditOrder(null); setModalOpen(true); }}
          onChooseFromQuote={prefill => { setOrderPrefill(prefill); setEditOrder(null); setModalOpen(true); }}
        />
        <OrderModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setOrderPrefill(null); }}
          order={editOrder}
          onSave={o => editOrder ? updateOrder(o) : addOrder(o)}
          onDelete={deleteOrder}
          nextOS={nextOS}
          prefill={orderPrefill}
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
          onSave={() => {}}
          onDelete={id => deleteQuoteMutation(id)}
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
        <RmaEditModal
          open={rmaEditModalOpen}
          onClose={() => { setRmaEditModalOpen(false); setEditingRma(null); }}
          rma={editingRma}
        />
      </div>
    </TooltipProvider>
  );
}
