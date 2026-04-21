import React, { createContext, useContext, useState, useCallback } from 'react';
import { PaymentMethod, Order } from './OrderStore';

export type ExpenseKind = 'PREVISAO' | 'PAGO';
export type ExpenseStatus = 'Não Pago' | 'Pago';

export interface InstallmentPlan {
  /** ISO yyyy-mm-dd date for this installment */
  date: string;
  /** Monetary value in BRL */
  value: number;
}

export interface Expense {
  id: string;
  kind: ExpenseKind;
  service: string;
  destination: string;
  predictedValue?: number;
  predictedDate?: string;
  status?: ExpenseStatus;
  paidValue?: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod | '';
  installments?: number;
  installmentPlan?: InstallmentPlan[];
  observations?: string;
}

export function expenseSavings(e: Expense): number {
  if (e.kind !== 'PREVISAO') return 0;
  const previsto = e.predictedValue || 0;
  const pago = e.status === 'Pago' ? (e.paidValue ?? previsto) : previsto;
  return previsto - pago;
}

/** Calendar entry rendered on the Financial Manager calendar */
export interface CalendarEntry {
  id: string;
  date: string;
  value: number;
  type: 'MULTA' | 'JUROS' | 'PREVISAO' | 'PAGO' | 'ORDER';
  title: string;
  refId: string;
  refKind: 'expense' | 'order' | 'order-penalty' | 'order-interest';
  /** Optional sub-index for installments */
  subIndex?: number;
}

export function expandExpense(e: Expense): CalendarEntry[] {
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
        subIndex: i,
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

/**
 * Derive Multa (penalty) and Juros (interest) calendar entries from an Order's
 * Pagamento section. Penalty -> single Blue card on paymentDate.
 * Interest paid via Credit -> per-installment Green cards proportional to plan.
 * Interest paid otherwise -> single Green card on paymentDate.
 */
export function expandOrderFinancial(o: Order): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  const payDate = o.paymentDate || o.deliveryDate;

  if ((o.penaltyValue || 0) > 0 && payDate) {
    out.push({
      id: `op-${o.id}`,
      date: payDate,
      value: o.penaltyValue || 0,
      type: 'MULTA',
      title: `OS ${o.os}`,
      refId: o.id,
      refKind: 'order-penalty',
    });
  }

  const interest = o.interestValue || 0;
  if (interest > 0) {
    if (o.paymentMethod === 'Credit Card' && o.paymentInstallmentPlan && o.paymentInstallmentPlan.length > 0) {
      const totalPlanValue = o.paymentInstallmentPlan.reduce((s, p) => s + (p.value || 0), 0) || 1;
      o.paymentInstallmentPlan.filter(p => p.date).forEach((p, i) => {
        // distribute interest proportionally to installment value
        const share = (p.value / totalPlanValue) * interest;
        out.push({
          id: `oi-${o.id}-i${i}`,
          date: p.date,
          value: +share.toFixed(2),
          type: 'JUROS',
          title: `OS ${o.os} (${i + 1}ª)`,
          refId: o.id,
          refKind: 'order-interest',
          subIndex: i,
        });
      });
    } else if (payDate) {
      out.push({
        id: `oi-${o.id}`,
        date: payDate,
        value: interest,
        type: 'JUROS',
        title: `OS ${o.os}`,
        refId: o.id,
        refKind: 'order-interest',
      });
    }
  }

  return out;
}

interface FinanceContextType {
  expenses: Expense[];
  addExpense: (e: Expense) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;
  /** Monthly goals (KPI configuration) */
  goals: Goal[];
  upsertGoal: (g: Goal) => void;
  deleteGoal: (key: string) => void;
}

export interface Goal {
  /** key = `${year}-${month}` (month 1-12) */
  key: string;
  year: number;
  month: number;
  target: number;
  floor: number;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

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
  const [expenses, setExpenses] = useState<Expense[]>(sampleExpenses);
  const [goals, setGoals] = useState<Goal[]>([]);

  const addExpense = useCallback((e: Expense) => setExpenses(p => [...p, e]), []);
  const updateExpense = useCallback((e: Expense) => setExpenses(p => p.map(x => x.id === e.id ? e : x)), []);
  const deleteExpense = useCallback((id: string) => setExpenses(p => p.filter(x => x.id !== id)), []);

  const upsertGoal = useCallback((g: Goal) => {
    setGoals(p => {
      const exists = p.some(x => x.key === g.key);
      return exists ? p.map(x => x.key === g.key ? g : x) : [...p, g];
    });
  }, []);
  const deleteGoal = useCallback((key: string) => setGoals(p => p.filter(x => x.key !== key)), []);

  return (
    <FinanceContext.Provider value={{ expenses, addExpense, updateExpense, deleteExpense, goals, upsertGoal, deleteGoal }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
