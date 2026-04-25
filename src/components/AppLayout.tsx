import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UserCircle, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/store/AuthStore';
import { useDashboardFilters } from '@/store/DashboardFilterStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function DashboardHeaderControls() {
  const { filters, setFilters, mode, setMode } = useDashboardFilters();
  const [rangeOpen, setRangeOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={String(filters.month)} onValueChange={v => setFilters(f => ({ ...f, month: +v, rangeFrom: undefined, rangeTo: undefined }))}>
        <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="number"
        className="w-[90px] h-9"
        value={filters.year}
        onChange={e => setFilters(f => ({ ...f, year: +e.target.value || f.year }))}
      />
      <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 justify-start font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.rangeFrom && filters.rangeTo
              ? `${format(filters.rangeFrom, 'dd/MM')} – ${format(filters.rangeTo, 'dd/MM/yy')}`
              : 'Período'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range"
            selected={{ from: filters.rangeFrom, to: filters.rangeTo }}
            onSelect={(r: any) => setFilters(f => ({ ...f, rangeFrom: r?.from, rangeTo: r?.to }))}
            locale={ptBR} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <div className="flex bg-muted rounded-md p-0.5">
        <button onClick={() => setMode('company')}
          className={cn('px-3 py-1 text-sm rounded', mode === 'company' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
          Empresa
        </button>
        <button onClick={() => setMode('seller')}
          className={cn('px-3 py-1 text-sm rounded', mode === 'seller' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
          Vendedor
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { username } = useAuth();
  const { pathname } = useLocation();
  const showDashFilters = pathname.startsWith('/dashboard');

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 gap-3">
            <SidebarTrigger />
            <div className="flex-1 flex justify-center">
              {showDashFilters && <DashboardHeaderControls />}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserCircle className="h-7 w-7 text-secondary" />
              <span>{username}</span>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
