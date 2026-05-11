import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UserCircle } from 'lucide-react';
import { useAuth } from '@/store/AuthStore';
import { useDashboardFilters, DashboardSection } from '@/store/DashboardFilterStore';
import { cn } from '@/lib/utils';

const SECTIONS: { key: DashboardSection; label: string }[] = [
  { key: 'geral', label: 'GERAL' },
  { key: 'vendas', label: 'VENDAS' },
  { key: 'ticket', label: 'TICKET' },
  { key: 'meta', label: 'META' },
];

function ModeToggle() {
  const { mode, setMode } = useDashboardFilters();
  return (
    <div className="flex bg-muted rounded-md p-0.5">
      <button onClick={() => setMode('company')}
        className={cn('px-3 py-1 text-sm rounded transition', mode === 'company' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
        Empresa
      </button>
      <button onClick={() => setMode('seller')}
        className={cn('px-3 py-1 text-sm rounded transition', mode === 'seller' ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}>
        Vendedor
      </button>
    </div>
  );
}

function useMode() {
  return useDashboardFilters().mode;
}

function SectionTabs() {
  const { section, setSection } = useDashboardFilters();
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
      {SECTIONS.map(s => (
        <button
          key={s.key}
          onClick={() => setSection(s.key)}
          className={cn(
            'px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all',
            section === s.key
              ? 'bg-secondary text-secondary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  const { email } = useAuth();
  const { pathname } = useLocation();
  const { mode } = useDashboardFilters();
  const showDashHeader = pathname.startsWith('/dashboard');
  const showSectionTabs = showDashHeader && mode === 'company';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="relative h-14 flex items-center justify-between border-b border-border bg-card px-4 gap-3">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {showDashHeader && <ModeToggle />}
            </div>
            {showSectionTabs && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                <SectionTabs />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserCircle className="h-7 w-7 text-secondary" />
              <span>{email}</span>
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
