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
export type PaymentMethod = 'Card' | 'Boleto';
export type OcAfPed = '' | 'Purchase Order' | 'AF' | 'Pedido';
export type Company = '' | 'Lucky Store' | 'BTech' | 'AJJ';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  status: ItemStatus;
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
  seller: string;
  invoice: string;
  ocAfPed: OcAfPed;
  paymentMethod: PaymentMethod;
  deliveryDate: string;
  status: OrderStatus;
  isRMA: boolean;
  productCost: number;
  serviceCost: number;
  cardFinanceCost: number;
  boletoCost: number;
  giftCost: number;
  shippingCost: number;
  purchaseTaxPercent: number;
  purchaseTaxValue: number;
  salesTaxPercent: number;
  salesTaxValue: number;
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

export function calcTotal(o: Partial<Order>): number {
  return (o.productCost || 0) + (o.serviceCost || 0) + (o.purchaseTaxValue || 0) + (o.salesTaxValue || 0) + (o.cardFinanceCost || 0) + (o.boletoCost || 0) + (o.giftCost || 0) + (o.shippingCost || 0);
}

const sampleOrders: Order[] = [
  {
    id: '1', os: '1001', orderDate: '2026-04-01', customer: 'Tech Solutions Ltda', cnpj: '12.345.678/0001-90',
    company: 'Lucky Store', seller: 'Ana Silva', invoice: 'NF-001',
    ocAfPed: 'Purchase Order', paymentMethod: 'Card', deliveryDate: '2026-04-15', status: 'Bought', isRMA: false,
    productCost: 1500, serviceCost: 200, cardFinanceCost: 50, boletoCost: 0, giftCost: 0, shippingCost: 80,
    purchaseTaxPercent: 10, purchaseTaxValue: 150, salesTaxPercent: 5, salesTaxValue: 75,
    items: [
      { id: 'i1', name: 'Notebook Dell Inspiron', quantity: 2, status: 'Bought', productDeliveryDate: '2026-04-14' },
      { id: 'i2', name: 'Mouse Logitech MX Master', quantity: 5, status: 'In Stock', productDeliveryDate: '2026-04-20' },
    ]
  },
  {
    id: '2', os: '1002', orderDate: '2026-04-05', customer: 'Escritório Digital', cnpj: '98.765.432/0001-10',
    company: 'BTech', seller: 'Carlos Mendes', invoice: 'NF-002',
    ocAfPed: 'AF', paymentMethod: 'Boleto', deliveryDate: '2026-04-20', status: 'To Buy', isRMA: false,
    productCost: 3200, serviceCost: 0, cardFinanceCost: 0, boletoCost: 30, giftCost: 50, shippingCost: 120,
    purchaseTaxPercent: 12, purchaseTaxValue: 384, salesTaxPercent: 8, salesTaxValue: 256,
    items: [
      { id: 'i3', name: 'Monitor LG 27" 4K', quantity: 3, status: 'To Buy', productDeliveryDate: '2026-04-19' },
      { id: 'i4', name: 'Teclado Mecânico Redragon', quantity: 3, status: 'To Buy', productDeliveryDate: '2026-04-19' },
    ]
  },
  {
    id: '3', os: '1003', orderDate: '2026-03-20', customer: 'InfoShop Comércio', cnpj: '45.678.912/0001-55',
    company: 'AJJ', seller: 'Mariana Costa', invoice: 'NF-003',
    ocAfPed: 'Pedido', paymentMethod: 'Card', deliveryDate: '2026-04-10', status: 'Delivered', isRMA: false,
    productCost: 800, serviceCost: 100, cardFinanceCost: 25, boletoCost: 0, giftCost: 0, shippingCost: 40,
    purchaseTaxPercent: 10, purchaseTaxValue: 80, salesTaxPercent: 5, salesTaxValue: 40,
    items: [
      { id: 'i5', name: 'Impressora HP LaserJet', quantity: 1, status: 'In Stock', productDeliveryDate: '2026-04-09' },
    ]
  },
  {
    id: '4', os: '1004', orderDate: '2026-04-10', customer: 'StartUp Hub', cnpj: '11.222.333/0001-44',
    company: 'BTech', seller: 'Ana Silva', invoice: '',
    ocAfPed: '', paymentMethod: 'Card', deliveryDate: '2026-05-01', status: 'Quote', isRMA: false,
    productCost: 5000, serviceCost: 300, cardFinanceCost: 0, boletoCost: 0, giftCost: 0, shippingCost: 100,
    purchaseTaxPercent: 0, purchaseTaxValue: 0, salesTaxPercent: 0, salesTaxValue: 0,
    items: [
      { id: 'i6', name: 'Servidor Dell PowerEdge', quantity: 1, status: 'To Buy' },
    ]
  },
  {
    id: '5', os: '1005', orderDate: '2026-04-12', customer: 'RMA Cliente Antigo', cnpj: '22.333.444/0001-55',
    company: 'Lucky Store', seller: 'Carlos Mendes', invoice: 'NF-RMA-005',
    ocAfPed: 'Pedido', paymentMethod: 'Boleto', deliveryDate: '2026-04-25', status: 'Received', isRMA: true,
    productCost: 0, serviceCost: 150, cardFinanceCost: 0, boletoCost: 0, giftCost: 0, shippingCost: 30,
    purchaseTaxPercent: 0, purchaseTaxValue: 0, salesTaxPercent: 0, salesTaxValue: 0,
    items: [
      { id: 'i7', name: 'Notebook em garantia', quantity: 1, status: 'In Stock', productDeliveryDate: '2026-04-26' },
    ]
  },
];

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  deleteOrder: (id: string) => void;
  updateItemStatus: (orderId: string, itemId: string, status: ItemStatus) => void;
}

const OrderContext = createContext<OrderContextType | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

const applyDelayCheck = (o: Order): Order => {
  if (o.status === 'Delivered' || o.status === 'Cancelled' || o.status === 'Quote') return o;
  if (o.status !== 'Delayed' && o.deliveryDate < today()) {
    return { ...o, status: 'Delayed' };
  }
  return o;
};

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(() => sampleOrders.map(applyDelayCheck));

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
    <OrderContext.Provider value={{ orders, addOrder, updateOrder, deleteOrder, updateItemStatus }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrders must be used within OrderProvider');
  return ctx;
}
