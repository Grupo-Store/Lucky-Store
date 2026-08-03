import { ShoppingCart, LayoutDashboard, LogOut, Wallet, Settings, UserCircle, History } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/store/AuthStore';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarFooter,
} from '@/components/ui/sidebar';
import logo from '@/assets/logo.png';

const SIDEBAR_CSS = `
  .gl-sidebar > div,
  .gl-sidebar [data-sidebar="sidebar"] {
    background: linear-gradient(170deg, #0B1626 0%, #0E1C31 65%, #0A1422 100%) !important;
  }
  .gl-sb-corners {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 55% 35% at 0% 0%, rgba(26,58,107,.5) 0%, transparent 70%),
      radial-gradient(ellipse 45% 30% at 100% 100%, rgba(20,48,90,.4) 0%, transparent 70%);
  }
  .gl-sb-grid {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      repeating-linear-gradient(rgba(255,255,255,.04) 0px, rgba(255,255,255,.04) 1px, transparent 1px, transparent 48px),
      repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0px, rgba(255,255,255,.04) 1px, transparent 1px, transparent 48px);
    -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%);
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, #000 40%, transparent 100%);
  }
  .gl-nav-item {
    display: flex; align-items: center;
    padding: 11px 13px; border-radius: 11px;
    color: #A9BCD9; text-decoration: none; font-size: 14px; font-weight: 500;
    transition: background 0.15s, color 0.15s;
    position: relative; width: 100%; border: none; background: transparent;
    cursor: pointer; font-family: inherit; box-sizing: border-box;
  }
  .gl-nav-item:hover {
    background: rgba(255,255,255,.06) !important;
    color: #EAF1FB !important;
  }
  .gl-nav-item:focus-visible {
    outline: 2px solid #2F6BFF; outline-offset: 2px;
  }
  .gl-nav-active {
    background: linear-gradient(90deg, rgba(47,107,255,.28) 0%, rgba(47,107,255,.10) 100%) !important;
    color: #FFFFFF !important;
  }
  .gl-nav-active::before {
    content: '';
    position: absolute; left: 0; top: 15%; bottom: 15%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg, #6FA0FF 0%, #2F6BFF 100%);
    box-shadow: 0 0 8px rgba(111,160,255,.45);
  }
  .gl-sidebar[data-state="collapsed"] .gl-nav-item {
    padding: 10px !important;
    justify-content: center !important;
  }
  .gl-logout:hover {
    background: rgba(255,99,99,.12) !important;
    color: #FFB4B4 !important;
  }
`;

const SG = "'Space Grotesk', sans-serif";

const navItems = [
  { title: 'Vendas',      url: '/',          icon: ShoppingCart    },
  { title: 'Financeiro',  url: '/financial', icon: Wallet          },
  { title: 'Dashboard',   url: '/dashboard', icon: LayoutDashboard },
  { title: 'Histórico',   url: '/history',   icon: History         },
  { title: 'Admin',       url: '/admin',     icon: Settings        },
  { title: 'Minha Conta', url: '/account',   icon: UserCircle      },
];

export function AppSidebar() {
  const { logout } = useAuth();

  return (
    <>
      <style>{SIDEBAR_CSS}</style>
      <Sidebar collapsible="icon" className="border-r-0 gl-sidebar">
        <SidebarContent style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="gl-sb-corners" />
          <div className="gl-sb-grid" />

          {/* Brand header */}
          <div
            className="relative z-10 group-data-[collapsible=icon]:px-2"
            style={{ padding: '20px 16px 12px' }}
          >
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #2F6BFF 0%, #7AA6FF 100%)',
                boxShadow: '0 4px 14px rgba(47,107,255,.4)',
              }}>
                <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p style={{ color: '#EAF1FB', fontFamily: SG, fontWeight: 600, fontSize: 14, lineHeight: 1.2, margin: 0 }}>
                  Grupo Store
                </p>
                <p style={{ color: '#8FB1E8', fontSize: 11.5, margin: 0 }}>Portal de gestão</p>
              </div>
            </div>
          </div>

          {/* MENU label */}
          <p
            className="relative z-10 group-data-[collapsible=icon]:hidden"
            style={{
              color: '#5F7699', fontSize: 10.5, fontWeight: 700,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              padding: '0 16px', marginBottom: 4,
            }}
          >
            Menu
          </p>

          {/* Nav items */}
          <SidebarGroup className="relative z-10 px-2">
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="gl-nav-item"
                      activeClassName="gl-nav-active"
                    >
                      <item.icon style={{ width: 19, height: 19, flexShrink: 0, strokeWidth: 1.7 }} />
                      <span className="ml-2.5 group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter
          className="relative z-10 px-2"
          style={{ borderTop: '1px solid rgba(143,177,232,.16)', paddingTop: 8, paddingBottom: 8 }}
        >
          <SidebarMenu>
            <SidebarMenuItem>
              <button onClick={logout} className="gl-nav-item gl-logout" style={{ width: '100%' }}>
                <LogOut style={{ width: 19, height: 19, flexShrink: 0, strokeWidth: 1.7 }} />
                <span className="ml-2.5 group-data-[collapsible=icon]:hidden">Sair</span>
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}
