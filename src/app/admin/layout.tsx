'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Wallet,
  Mail,
  Settings,
  Sliders,
  BarChart3,
  LogOut,
  ChevronsUpDown,
  KeyRound,
  Activity,
  FolderOpen,
  UsersRound,
  Layers,
  HelpCircle,
  LockKeyhole,
  HeartPulse,
} from 'lucide-react';

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  adminOnly?: boolean;
};

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Partners', url: '/admin/partners', icon: Users },
  { title: 'Leads', url: '/admin/customers', icon: UserCheck },
  { title: 'Payouts', url: '/admin/payouts', icon: Wallet, adminOnly: true },
  { title: 'Emails', url: '/admin/emails', icon: Mail, adminOnly: true },
];

const marketingNavItems: NavItem[] = [
  { title: 'Resources', url: '/admin/resources', icon: FolderOpen, adminOnly: true },
  { title: 'Lead Sources', url: '/admin/programs', icon: Layers, adminOnly: true },
];

const configNavItems: NavItem[] = [
  { title: 'Integration Health', url: '/admin/integrations', icon: HeartPulse, adminOnly: true },
  { title: 'Portal FAQ', url: '/admin/faqs', icon: HelpCircle, adminOnly: true },
  { title: 'Portal Settings', url: '/admin/program-settings', icon: Sliders, adminOnly: true },
  { title: 'Team Members', url: '/admin/team', icon: UsersRound, adminOnly: true },
  { title: 'Settings', url: '/admin/settings', icon: Settings, adminOnly: true },
  { title: 'Reports', url: '/admin/reports', icon: BarChart3, adminOnly: true },
  { title: 'API Keys', url: '/admin/api-keys', icon: KeyRound, adminOnly: true },
  { title: 'API Analytics', url: '/admin/api-analytics', icon: Activity, adminOnly: true },
];

function NavGroup({
  label,
  items,
  isActive,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  isActive: (url: string) => boolean;
  onNavigate: (url: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive(item.url)}
                onClick={() => onNavigate(item.url)}
                tooltip={item.title}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (url: string) => {
    if (url === '/admin') return pathname === '/admin';
    return pathname.startsWith(url);
  };

  const visibleMainNavItems = mainNavItems.filter((item) => !item.adminOnly || isAdmin);
  const visibleMarketingNavItems = marketingNavItems.filter((item) => !item.adminOnly || isAdmin);
  const visibleConfigNavItems = configNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <span className="text-lg font-bold">R</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">ReferConnect</span>
                <span className="text-xs text-muted-foreground">
                  {isAdmin ? 'Admin Dashboard' : 'Staff Workspace'}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Main Menu" items={visibleMainNavItems} isActive={isActive} onNavigate={(url) => router.push(url)} />
        <NavGroup label="Partner Tools" items={visibleMarketingNavItems} isActive={isActive} onNavigate={(url) => router.push(url)} />
        <NavGroup label="Configure" items={visibleConfigNavItems} isActive={isActive} onNavigate={(url) => router.push(url)} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.profilePicture} alt={user?.name} />
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                {isAdmin && (
                  <>
                    <DropdownMenuItem onClick={() => router.push('/admin/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-muted" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <LockKeyhole className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">You need admin or staff access to view this page</p>
          <Button asChild>
            <a href="/login">Go to Login</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user.name?.split(' ')[0]}
              </p>
            </div>
            <NotificationCenter />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
