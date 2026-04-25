import React, { createContext, useContext, useState } from 'react';

export type DashboardViewMode = 'company' | 'seller';

export interface DashboardFilters {
  year: number;
  month: number; // 0-11
  rangeFrom?: Date;
  rangeTo?: Date;
}

interface Ctx {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  mode: DashboardViewMode;
  setMode: React.Dispatch<React.SetStateAction<DashboardViewMode>>;
}

const DashboardFilterCtx = createContext<Ctx | null>(null);

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const today = new Date();
  const [filters, setFilters] = useState<DashboardFilters>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [mode, setMode] = useState<DashboardViewMode>('company');

  return (
    <DashboardFilterCtx.Provider value={{ filters, setFilters, mode, setMode }}>
      {children}
    </DashboardFilterCtx.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFilterCtx);
  if (!ctx) throw new Error('useDashboardFilters must be used inside DashboardFilterProvider');
  return ctx;
}
