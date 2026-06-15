import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PanelLeft } from 'lucide-react';
import { useAuth } from '@/store/AuthStore';
import { useDashboardFilters, DashboardSection } from '@/store/DashboardFilterStore';
import { cn } from '@/lib/utils';

const SECTIONS: { key: DashboardSection; label: string }[] = [
  { key: 'geral',  label: 'GERAL'  },
  { key: 'vendas', label: 'VENDAS' },
  { key: 'ticket', label: 'TICKET' },
  { key: 'meta',   label: 'META'   },
];

// ── Dashboard-only controls (unchanged logic) ─────────────────────────────────

function ModeToggle() {
  const { mode, setMode } = useDashboardFilters();
  return (
    <div
      style={{
        display: 'flex', background: '#EDF1F7',
        border: '1px solid #E2E8F1', borderRadius: 10, padding: 3,
      }}
    >
      <button
        onClick={() => setMode('company')}
        style={{
          padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: 'none', cursor: 'pointer', transition: 'all .15s',
          background: mode === 'company' ? '#fff' : 'transparent',
          color: mode === 'company' ? '#1E4FD8' : '#5B6B82',
          boxShadow: mode === 'company' ? '0 1px 4px rgba(13,33,66,.12)' : 'none',
        }}
      >
        Empresa
      </button>
      <button
        onClick={() => setMode('seller')}
        style={{
          padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: 'none', cursor: 'pointer', transition: 'all .15s',
          background: mode === 'seller' ? '#fff' : 'transparent',
          color: mode === 'seller' ? '#1E4FD8' : '#5B6B82',
          boxShadow: mode === 'seller' ? '0 1px 4px rgba(13,33,66,.12)' : 'none',
        }}
      >
        Vendedor
      </button>
    </div>
  );
}

function SectionTabs() {
  const { section, setSection } = useDashboardFilters();
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: '#EDF1F7', border: '1px solid #E2E8F1',
        borderRadius: 12, padding: 4,
      }}
    >
      {SECTIONS.map(s => (
        <button
          key={s.key}
          onClick={() => setSection(s.key)}
          style={{
            padding: '5px 16px', borderRadius: 9,
            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em',
            border: 'none', cursor: 'pointer', transition: 'all .15s',
            background: section === s.key ? '#fff' : 'transparent',
            color: section === s.key ? '#1E4FD8' : '#5B6B82',
            boxShadow: section === s.key ? '0 1px 4px rgba(13,33,66,.12)' : 'none',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { email } = useAuth();
  const { pathname } = useLocation();
  const { mode } = useDashboardFilters();
  const showDashHeader  = pathname.startsWith('/dashboard');
  const showSectionTabs = showDashHeader && mode === 'company';

  const avatarLetter = email?.[0]?.toUpperCase() ?? '?';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Top bar ─────────────────────────────────────────────────────── */}
          <header
            style={{
              position: 'sticky', top: 0, zIndex: 40, height: 64, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,.85)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: '1px solid #E2E8F1',
              padding: '0 20px', gap: 12,
            }}
          >
            {/* Left: sidebar trigger + optional dashboard controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Styled wrapper around shadcn SidebarTrigger */}
              <div
                style={{
                  width: 38, height: 38, border: '1px solid #E2E8F1',
                  borderRadius: 10, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <SidebarTrigger
                  style={{ width: 20, height: 20, color: '#5B6B82' }}
                />
              </div>
              {showDashHeader && <ModeToggle />}
            </div>

            {/* Centre: dashboard section tabs (absolute so they're truly centred) */}
            {showSectionTabs && (
              <div
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                }}
              >
                <SectionTabs />
              </div>
            )}

            {/* Right: user chip */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px',
                border: '1px solid #E2E8F1',
                borderRadius: 99,
                background: '#fff',
                flexShrink: 0,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #2F6BFF 0%, #7AA6FF 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {avatarLetter}
              </div>
              {/* Email (hidden on narrow screens) */}
              <span
                className="hidden sm:block"
                style={{
                  maxWidth: 180, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 13, color: '#16273F', fontWeight: 500,
                }}
              >
                {email}
              </span>
            </div>
          </header>

          {/* ── Page content ────────────────────────────────────────────────── */}
          <main
            className="flex-1 p-4 md:p-6 overflow-auto"
            style={{ background: '#F4F7FB' }}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
