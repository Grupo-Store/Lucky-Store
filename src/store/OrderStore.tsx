import React, { createContext, useContext, useState, useCallback } from 'react';

export type OrderStatus =
  | 'Quote'
  | 'To Buy'
  | 'Bought'
  | 'Received'
  | 'To Invoice'
  | 'Invoiced and Received'
  | 'Invoiced and Awaiting Receipt'
  | 'To Pack'
  | 'Ready for Delivery'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Delayed'
  | 'Cancelled';

export type ItemStatus = 'To Buy' | 'Bought' | 'In Stock';
export type PaymentMethod = 'Credit Card' | 'Debit Card' | 'Boleto' | 'Pix' | 'TED' | 'Cash';
export type Company = '' | 'Lucky Store' | 'BTech' | 'AJJ';
export type Seller = '' | 'Alcides' | 'Lucas' | 'Pedro';

export const SELLERS: Exclude<Seller, ''>[] = ['Alcides', 'Lucas', 'Pedro'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Credit Card', 'Debit Card', 'Boleto', 'Pix', 'TED', 'Cash'];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'Credit Card': 'Cartão de Crédito',
  'Debit Card': 'Cartão de Débito',
  'Boleto': 'Boleto',
  'Pix': 'Pix',
  'TED': 'TED',
  'Cash': 'Dinheiro',
};

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  status: ItemStatus;
  projectedValue: number;
  purchaseValue: number;
  /** Optional product-level delivery date (ISO yyyy-mm-dd) */
  productDeliveryDate?: string;
}

export interface Order {
  id: string;
  os: string;
  orderDate: string;
  customer: string;
  cnpj: string;
  company: Company;
  seller: Seller;
  ocAfPed: string;
  /** Direct (triangulated) billing — supplier invoices client directly */
  directBilling: boolean;
  supplier: string;
  invoice: string;
  paymentMethods: PaymentMethod[];
  installments: number;
  deliveryDate: string;
  status: OrderStatus;
  isRMA: boolean;
  cancelled: boolean;
  observations: string;
  /** Financial section */
  initialProductCost: number;
  finalProductCost: number;
  creditCostPercent: number;
  creditCostValue: number;
  debitCostPercent: number;
  debitCostValue: number;
  purchaseTaxPercent: number;
  purchaseTaxValue: number;
  salesTaxPercent: number;
  salesTaxValue: number;
  /** Final sales value entered by user */
  salesValue: number;
  items: OrderItem[];
}

/** Tailwind classes using HSL status tokens defined in index.css */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  'Quote':                          'bg-[hsl(var(--st-quote)/0.18)] text-[hsl(var(--st-quote))] border-[hsl(var(--st-quote)/0.5)]',
  'To Buy':                         'bg-[hsl(var(--st-tobuy)/0.18)] text-[hsl(var(--st-tobuy))] border-[hsl(var(--st-tobuy)/0.5)]',
  'Bought':                         'bg-[hsl(var(--st-bought)/0.18)] text-[hsl(var(--st-bought))] border-[hsl(var(--st-bought)/0.5)]',
  'Received':                       'bg-[hsl(var(--st-received)/0.18)] text-[hsl(var(--st-received))] border-[hsl(var(--st-received)/0.5)]',
  'To Invoice':                     'bg-[hsl(var(--st-toinvoice)/0.22)] text-[hsl(45_85%_28%)] border-[hsl(var(--st-toinvoice)/0.6)]',
  'Invoiced and Received':          'bg-[hsl(var(--st-invoiced-received)/0.4)] text-[hsl(22_85%_30%)] border-[hsl(var(--st-invoiced-received))]',
  'Invoiced and Awaiting Receipt':  'bg-[hsl(var(--st-invoiced-pending)/0.18)] text-[hsl(var(--st-invoiced-pending))] border-[hsl(var(--st-invoiced-pending)/0.6)]',
  'To Pack':                        'bg-[hsl(var(--st-topack)/0.35)] text-[hsl(220_70%_30%)] border-[hsl(var(--st-topack))]',
  'Ready for Delivery':             'bg-[hsl(var(--st-ready)/0.18)] text-[hsl(var(--st-ready))] border-[hsl(var(--st-ready)/0.6)]',
  'Out for Delivery':               'bg-[hsl(var(--st-delivering)/0.4)] text-[hsl(140_70%_22%)] border-[hsl(var(--st-delivering))]',
  'Delivered':                      'bg-[hsl(var(--st-delivered)/0.18)] text-[hsl(var(--st-delivered))] border-[hsl(var(--st-delivered)/0.6)]',
  'Delayed':                        'bg-[hsl(var(--st-delayed)/0.18)] text-[hsl(var(--st-delayed))] border-[hsl(var(--st-delayed)/0.6)]',
  'Cancelled':                      'bg-[hsl(var(--st-cancelled)/0.18)] text-[hsl(var(--st-cancelled))] border-[hsl(var(--st-cancelled)/0.6)]',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'Quote': 'Cotação',
  'To Buy': 'A Comprar',
  'Bought': 'Comprado',
  'Received': 'Recebido',
  'To Invoice': 'A Faturar',
  'Invoiced and Received': 'Faturado e Recebido',
  'Invoiced and Awaiting Receipt': 'Faturado e Aguardando Recebimento',
  'To Pack': 'A Embalar',
  'Ready for Delivery': 'Pronto p/ Entrega',
  'Out for Delivery': 'Em Entrega',
  'Delivered': 'Entregue',
  'Delayed': 'Atrasado',
  'Cancelled': 'Cancelado',
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  'To Buy': 'bg-[hsl(var(--st-tobuy)/0.18)] text-[hsl(var(--st-tobuy))] border-[hsl(var(--st-tobuy)/0.5)]',
  'Bought': 'bg-[hsl(var(--st-bought)/0.18)] text-[hsl(var(--st-bought))] border-[hsl(var(--st-bought)/0.5)]',
  'In Stock': 'bg-[hsl(var(--st-delivered)/0.18)] text-[hsl(var(--st-delivered))] border-[hsl(var(--st-delivered)/0.6)]',
};

const OPEN_STATUSES: OrderStatus[] = [
  'To Buy', 'Bought', 'Received', 'To Invoice',
  'Invoiced and Received', 'Invoiced and Awaiting Receipt',
  'To Pack', 'Ready for Delivery', 'Out for Delivery', 'Delayed',
];

/** Statuses that trigger the "delivery soon" warning when ≤ 3 days away */
export const WARN_STATUSES: OrderStatus[] = ['To Buy', 'Bought', 'Invoiced and Awaiting Receipt'];

export function isOpenOrder(status: OrderStatus) {
  return OPEN_STATUSES.includes(status);
}

/** Final cost = sum of all monetary R$ values from the Financial Section */
export function calcFinalCost(o: Partial<Order>): number {
  return (o.finalProductCost || 0)
    + (o.creditCostValue || 0)
    + (o.debitCostValue || 0)
    + (o.purchaseTaxValue || 0)
    + (o.salesTaxValue || 0);
}

export function calcProfit(o: Partial<Order>): number {
  return (o.salesValue || 0) - calcFinalCost(o);
}

/** Backwards-compat: the table's "Valor" column shows the Sales Value */
export function calcTotal(o: Partial<Order>): number {
  return o.salesValue || 0;
}

const baseOrder = (over: Partial<Order>): Order => ({
  id: '', os: '', orderDate: '', customer: '', cnpj: '', company: '', seller: '',
  ocAfPed: '', directBilling: false, supplier: '', invoice: '',
  paymentMethods: [], installments: 1, deliveryDate: '', status: 'To Buy',
  isRMA: false, cancelled: false, observations: '',
  initialProductCost: 0, finalProductCost: 0,
  creditCostPercent: 0, creditCostValue: 0, debitCostPercent: 0, debitCostValue: 0,
  purchaseTaxPercent: 0, purchaseTaxValue: 0, salesTaxPercent: 0, salesTaxValue: 0,
  salesValue: 0, items: [],
  ...over,
});

const sampleOrders: Order[] = [
  baseOrder({
    id: '1', os: '1001', orderDate: '2026-04-01', customer: 'Tech Solutions Ltda', cnpj: '12.345.678/0001-90',
    company: 'Lucky Store', seller: 'Alcides', ocAfPed: 'OC-9982', invoice: 'NF-001',
    paymentMethods: ['Credit Card'], installments: 3, deliveryDate: '2026-04-15', status: 'Bought',
    initialProductCost: 1500, finalProductCost: 1500,
    creditCostPercent: 2, creditCostValue: 60, salesTaxPercent: 5, salesTaxValue: 150, salesValue: 3000,
    items: [
      { id: 'i1', name: 'Notebook Dell Inspiron', quantity: 2, status: 'Bought', projectedValue: 1400, purchaseValue: 1350, productDeliveryDate: '2026-04-14' },
      { id: 'i2', name: 'Mouse Logitech MX Master', quantity: 5, status: 'In Stock', projectedValue: 100, purchaseValue: 90, productDeliveryDate: '2026-04-20' },
    ],
  }),
  baseOrder({
    id: '2', os: '1002', orderDate: '2026-04-05', customer: 'Escritório Digital', cnpj: '98.765.432/0001-10',
    company: 'BTech', seller: 'Lucas', ocAfPed: 'AF-221', invoice: 'NF-002',
    paymentMethods: ['Boleto'], deliveryDate: '2026-04-20', status: 'To Buy',
    initialProductCost: 3200, finalProductCost: 3200, salesTaxPercent: 8, salesTaxValue: 480, salesValue: 6000,
    items: [
      { id: 'i3', name: 'Monitor LG 27" 4K', quantity: 3, status: 'To Buy', projectedValue: 2000, purchaseValue: 0, productDeliveryDate: '2026-04-19' },
      { id: 'i4', name: 'Teclado Mecânico Redragon', quantity: 3, status: 'To Buy', projectedValue: 400, purchaseValue: 0, productDeliveryDate: '2026-04-19' },
    ],
  }),
  baseOrder({
    id: '3', os: '1003', orderDate: '2026-03-20', customer: 'InfoShop Comércio', cnpj: '45.678.912/0001-55',
    company: 'AJJ', seller: 'Pedro', ocAfPed: 'PED-7710', invoice: 'NF-003',
    paymentMethods: ['Pix'], deliveryDate: '2026-04-10', status: 'Delivered',
    initialProductCost: 800, finalProductCost: 800, salesValue: 1500,
    items: [
      { id: 'i5', name: 'Impressora HP LaserJet', quantity: 1, status: 'In Stock', projectedValue: 1500, purchaseValue: 800, productDeliveryDate: '2026-04-09' },
    ],
  }),
  baseOrder({
    id: '4', os: '1004', orderDate: '2026-04-10', customer: 'StartUp Hub', cnpj: '11.222.333/0001-44',
    company: 'BTech', seller: 'Alcides', deliveryDate: '2026-05-01', status: 'Quote',
    paymentMethods: ['Credit Card'], installments: 6,
    initialProductCost: 5000, finalProductCost: 0, salesValue: 9500,
    items: [{ id: 'i6', name: 'Servidor Dell PowerEdge', quantity: 1, status: 'To Buy', projectedValue: 9500, purchaseValue: 0 }],
  }),
  baseOrder({
    id: '5', os: '1005', orderDate: '2026-04-12', customer: 'RMA Cliente Antigo', cnpj: '22.333.444/0001-55',
    company: 'Lucky Store', seller: 'Lucas', ocAfPed: 'PED-RMA-005', invoice: 'NF-RMA-005',
    paymentMethods: ['Boleto'], deliveryDate: '2026-04-25', status: 'Received', isRMA: true,
    salesValue: 0,
    items: [{ id: 'i7', name: 'Notebook em garantia', quantity: 1, status: 'In Stock', projectedValue: 0, purchaseValue: 0, productDeliveryDate: '2026-04-26' }],
  }),
];

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  deleteOrder: (id: string) => void;
  updateItemStatus: (orderId: string, itemId: string, status: ItemStatus) => void;
  /** Returns the next OS number as a string (auto-increment) */
  nextOS: () => string;
}

const OrderContext = createContext<OrderContextType | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

const applyDelayCheck = (o: Order): Order => {
  if (o.cancelled) return { ...o, status: 'Cancelled' };
  if (o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'Quote') return o;
  if (o.status !== 'Delayed' && o.deliveryDate && o.deliveryDate < today()) {
    return { ...o, status: 'Delayed' };
  }
  return o;
};

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => sampleOrders.map(applyDelayCheck));

  const nextOS = useCallback(() => {
    const max = orders.reduce((m, o) => {
      const n = parseInt(o.os, 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 1000);
    return String(max + 1);
  }, [orders]);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, applyDelayCheck(order)]);
  }, []);

  const updateOrder = useCallback((order: Order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? applyDelayCheck(order) : o));
  }, []);

  const deleteOrder = useCallback((id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  }, []);

  const updateItemStatus = useCallback((orderId: string, itemId: string, status: ItemStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, items: o.items.map(item => item.id === itemId ? { ...item, status } : item) };
    }));
  }, []);

  return (
    <OrderContext.Provider value={{ orders, addOrder, updateOrder, deleteOrder, updateItemStatus, nextOS }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used within OrderProvider');
  return ctx;
}
