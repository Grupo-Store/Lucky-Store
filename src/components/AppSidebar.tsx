import { useState } from 'react';
import { ShoppingCart, LayoutDashboard, LogOut, Wallet, Settings, UserCircle, Trash2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/store/AuthStore';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from '@/components/ui/sidebar';
import { DeleteAccountModal } from '@/components/DeleteAccountModal';
import logo from '@/assets/logo.png';

const navItems = [
  { title: 'Vendas', url: '/', icon: ShoppingCart },
  { title: 'Financeiro', url: '/financial', icon: Wallet },
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Admin', url: '/admin', icon: Settings },
  { title: 'Minha Conta', url: '/account', icon: UserCircle },
];

export function AppSidebar() {
  const { logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar text-sidebar-foreground">
        <div className="p-4 flex justify-center">
          <img src={logo} alt="Logo" className="h-12 object-contain" />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="text-sidebar-foreground hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent font-semibold"
                    >
                      <item.icon className="mr-2 h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-sidebar">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setDeleteOpen(true)}
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              <span>Deletar conta</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="mr-2 h-5 w-5" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <DeleteAccountModal open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Sidebar>
  );
}
