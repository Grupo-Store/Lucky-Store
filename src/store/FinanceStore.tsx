import React, { createContext, useContext, useState, useCallback } from 'react';
import { PaymentMethod } from './OrderStore';

export type GainKind = 'MULTA' | 'JUROS';
export type ExpenseKind = 'PREVISAO' | 'PAGO';
export type ExpenseStatus = 'Não Pago' | 'Pago';

export interface InstallmentPlan {
  /** ISO yyyy-mm-dd date for this installment */
  date: string;
  /** Monetary value in BRL */
  value: number;
}

export interface Gain {
  id: string;
  kind: GainKind;
  customer: string;
  cnpj: string;
  value: number;
  os: string;
  registrationDate: string;
  paidDate: string;
  paymentMethod: PaymentMethod | '';
  installments?: number;
  installmentPlan?: InstallmentPlan[];
  creditCost: number;
  debitCost: number;
  boletoCost: number;
}

export interface Expense {
  id: string;
  kind: ExpenseKind;
  service: string;
  destination: string;
  /** Predicted value (used by PREVISAO) */
  predictedValue?: number;
  /** Predicted date (used by PREVISAO) */
  predictedDate?: string;
  /** Status (PREVISAO only) — when 'Pago', payment fields apply */
  status?: ExpenseStatus;
  /** Paid value */
  paidValue?: number;
  /** Payment date */
  paymentDate?: string;
  paymentMethod?: PaymentMethod | '';
  installments?: number;
  installmentPlan?: InstallmentPlan[];
  observations?: string;
}

export function gainNet(g: Gain): number {
  return g.value - (g.creditCost + g.debitCost + g.boletoCost);
}

export function expenseSavings(e: Expense): number {
  if (e.kind !== 'PREVISAO') return 0;
  const previsto = e.predictedValue || 0;
  const pago = e.status === 'Pago' ? (e.paidValue ?? previsto) : previsto;
  return previsto - pago;
}

/** Resolve all calendar occurrences for a Gain */
export interface CalendarEntry {
  id: string;
  /** ISO date yyyy-mm-dd */
  date: string;
  /** value to display on this card */
  value: number;
  /** Card classification for color */
  type: 'MULTA' | 'JUROS' | 'PREVISAO' | 'PAGO' | 'ORDER';
  title: string;
  /** Original record id */
  refId: string;
  refKind: 'gain' | 'expense' | 'order';
}

export function expandGain(g: Gain): CalendarEntry[] {
  // If credit + installmentPlan with dates, render per installment
  if (g.paymentMethod === 'Credit Card' && g.installmentPlan && g.installmentPlan.length > 0) {
    return g.installmentPlan
      .filter(p => p.date)
      .map((p, i) => ({
        id: `${g.id}-i${i}`,
        date: p.date,
        value: p.value,
        type: g.kind,
        title: g.customer || g.kind,
        refId: g.id,
        refKind: 'gain',
      }));
  }
  // Otherwise on paidDate (or registrationDate fallback)
  const date = g.paidDate || g.registrationDate;
  if (!date) return [];
  return [{
    id: g.id,
    date,
    value: g.value,
    type: g.kind,
    title: g.customer || g.kind,
    refId: g.id,
    refKind: 'gain',
  }];
}

export function expandExpense(e: Expense): CalendarEntry[] {
  // PAGO or PREVISAO that's been marked as Pago
  const isPaid = e.kind === 'PAGO' || e.status === 'Pago';

  if (isPaid && e.paymentMethod === 'Credit Card' && e.installmentPlan && e.installmentPlan.length > 0) {
    return e.installmentPlan
      .filter(p => p.date)
      .map((p, i) => ({
        id: `${e.id}-i${i}`,
        date: p.date,
        value: p.value,
        type: 'PAGO',
        title: e.service || 'Despesa',
        refId: e.id,
        refKind: 'expense',
      }));
  }

  if (isPaid) {
    const date = e.paymentDate;
    if (!date) return [];
    return [{
      id: e.id,
      date,
      value: e.paidValue ?? e.predictedValue ?? 0,
      type: 'PAGO',
      title: e.service || 'Despesa',
      refId: e.id,
      refKind: 'expense',
    }];
  }

  // PREVISAO not yet paid
  const date = e.predictedDate;
  if (!date) return [];
  return [{
    id: e.id,
    date,
    value: e.predictedValue || 0,
    type: 'PREVISAO',
    title: e.service || 'Despesa',
    refId: e.id,
    refKind: 'expense',
  }];
}

interface FinanceContextType {
  gains: Gain[];
  expenses: Expense[];
  addGain: (g: Gain) => void;
  updateGain: (g: Gain) => void;
  deleteGain: (id: string) => void;
  addExpense: (e: Expense) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

const sampleGains: Gain[] = [
  {
    id: 'g1', kind: 'MULTA', customer: 'Tech Solutions Ltda', cnpj: '12.345.678/0001-90',
    value: 250, os: '1001', registrationDate: '2026-04-05', paidDate: '2026-04-10',
    paymentMethod: 'Pix', creditCost: 0, debitCost: 0, boletoCost: 0,
  },
  {
    id: 'g2', kind: 'JUROS', customer: 'Escritório Digital', cnpj: '98.765.432/0001-10',
    value: 120, os: '1002', registrationDate: '2026-04-08', paidDate: '2026-04-15',
    paymentMethod: 'Credit Card', installments: 2,
    installmentPlan: [
      { date: '2026-04-15', value: 60 },
      { date: '2026-05-15', value: 60 },
    ],
    creditCost: 5, debitCost: 0, boletoCost: 0,
  },
];

const sampleExpenses: Expense[] = [
  {
    id: 'e1', kind: 'PREVISAO', service: 'Aluguel', destination: 'Imobiliária X',
    predictedValue: 4500, predictedDate: '2026-04-20', status: 'Não Pago',
  },
  {
    id: 'e2', kind: 'PAGO', service: 'Energia Elétrica', destination: 'Enel',
    paidValue: 820, paymentDate: '2026-04-12', paymentMethod: 'Boleto',
  },
];

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [gains, setGains] = useState<Gain[]>(sampleGains);
  const [expenses, setExpenses] = useState<Expense[]>(sampleExpenses);

  const addGain = useCallback((g: Gain) => setGains(p => [...p, g]), []);
  const updateGain = useCallback((g: Gain) => setGains(p => p.map(x => x.id === g.id ? g : x)), []);
  const deleteGain = useCallback((id: string) => setGains(p => p.filter(x => x.id !== id)), []);

  const addExpense = useCallback((e: Expense) => setExpenses(p => [...p, e]), []);
  const updateExpense = useCallback((e: Expense) => setExpenses(p => p.map(x => x.id === e.id ? e : x)), []);
  const deleteExpense = useCallback((id: string) => setExpenses(p => p.filter(x => x.id !== id)), []);

  return (
    <FinanceContext.Provider value={{ gains, expenses, addGain, updateGain, deleteGain, addExpense, updateExpense, deleteExpense }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
