import React, { createContext, useContext, useState, useCallback } from 'react';

export type OrderStatus = 'To Buy' | 'Bought' | 'Received' | 'Ready for Delivery' | 'Out for Delivery' | 'Delivered' | 'Delayed';
export type ItemStatus = 'To Buy' | 'Bought' | 'In Stock';
export type PaymentMethod = 'Card' | 'Boleto';
export type OcAfPed = '' | 'Purchase Order' | 'AF' | 'Pedido';
export type Company = '' | 'Lucky Store' | 'BTech' | 'AJJ';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  status: ItemStatus;
}

export interface Order {
  id: string;
  os: string;
  orderDate: string;
  customer: string;
  company: Company;
  invoice: string;
  ocAfPed: OcAfPed;
  paymentMethod: PaymentMethod;
  deliveryDate: string;
  status: OrderStatus;
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

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  'To Buy': 'bg-amber-100 text-amber-900 border-amber-400',
  'Bought': 'bg-sky-100 text-sky-900 border-sky-400',
  'Received': 'bg-violet-100 text-violet-900 border-violet-400',
  'Ready for Delivery': 'bg-emerald-100 text-emerald-900 border-emerald-400',
  'Out for Delivery': 'bg-orange-100 text-orange-900 border-orange-400',
  'Delivered': 'bg-green-200 text-green-900 border-green-500',
  'Delayed': 'bg-red-100 text-red-900 border-red-400',
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  'To Buy': 'bg-amber-100 text-amber-900 border-amber-400',
  'Bought': 'bg-sky-100 text-sky-900 border-sky-400',
  'In Stock': 'bg-teal-100 text-teal-900 border-teal-400',
};

const OPEN_STATUSES: OrderStatus[] = ['To Buy', 'Bought', 'Received', 'Ready for Delivery', 'Out for Delivery', 'Delayed'];

export function isOpenOrder(status: OrderStatus) {
  return OPEN_STATUSES.includes(status);
}

export function calcTotal(o: Partial<Order>): number {
  return (o.productCost || 0) + (o.serviceCost || 0) + (o.purchaseTaxValue || 0) + (o.salesTaxValue || 0) + (o.cardFinanceCost || 0) + (o.boletoCost || 0) + (o.giftCost || 0) + (o.shippingCost || 0);
}

const sampleOrders: Order[] = [
  {
    id: '1', os: '1001', orderDate: '2026-04-01', customer: 'Tech Solutions Ltda', company: 'Lucky Store', invoice: 'NF-001',
    ocAfPed: 'Purchase Order', paymentMethod: 'Card', deliveryDate: '2026-04-15', status: 'Bought',
    productCost: 1500, serviceCost: 200, cardFinanceCost: 50, boletoCost: 0, giftCost: 0, shippingCost: 80,
    purchaseTaxPercent: 10, purchaseTaxValue: 150, salesTaxPercent: 5, salesTaxValue: 75,
    items: [
      { id: 'i1', name: 'Notebook Dell Inspiron', quantity: 2, status: 'Bought' },
      { id: 'i2', name: 'Mouse Logitech MX Master', quantity: 5, status: 'In Stock' },
    ]
  },
  {
    id: '2', os: '1002', orderDate: '2026-04-05', customer: 'Escritório Digital', company: 'BTech', invoice: 'NF-002',
    ocAfPed: 'AF', paymentMethod: 'Boleto', deliveryDate: '2026-04-20', status: 'To Buy',
    productCost: 3200, serviceCost: 0, cardFinanceCost: 0, boletoCost: 30, giftCost: 50, shippingCost: 120,
    purchaseTaxPercent: 12, purchaseTaxValue: 384, salesTaxPercent: 8, salesTaxValue: 256,
    items: [
      { id: 'i3', name: 'Monitor LG 27" 4K', quantity: 3, status: 'To Buy' },
      { id: 'i4', name: 'Teclado Mecânico Redragon', quantity: 3, status: 'To Buy' },
    ]
  },
  {
    id: '3', os: '1003', orderDate: '2026-03-20', customer: 'InfoShop Comércio', company: 'AJJ', invoice: 'NF-003',
    ocAfPed: 'Pedido', paymentMethod: 'Card', deliveryDate: '2026-04-10', status: 'Delivered',
    productCost: 800, serviceCost: 100, cardFinanceCost: 25, boletoCost: 0, giftCost: 0, shippingCost: 40,
    purchaseTaxPercent: 10, purchaseTaxValue: 80, salesTaxPercent: 5, salesTaxValue: 40,
    items: [
      { id: 'i5', name: 'Impressora HP LaserJet', quantity: 1, status: 'In Stock' },
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

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, order]);
  }, []);

  const updateOrder = useCallback((order: Order) => {
    setOrders(prev => prev.map(o => o.id === order.id ? order : o));
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
