import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut, Menu, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { checkHealth } from '@/src/lib/api';
import { formatRoleLabel } from '@/src/lib/utils';
import { useLiveUpdates } from '@/src/hooks/useLiveUpdates';
import { Sidebar } from '@/src/components/shared/Sidebar';
import { BackendStatusBanner } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Connect fetch-based SSE live updates when authenticated
  useLiveUpdates();

  const healthQuery = useQuery({
    queryKey: ['backend-health'],
    queryFn: checkHealth,
    retry: false,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/95 px-4 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-28 truncate">{user.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="text-sm font-semibold text-foreground">{user.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                    <div className="text-xs font-medium text-accent mt-1">
                      {formatRoleLabel(user.role)}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Header Banner */}
        <div className="header-gradient border-b border-border px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>

        {/* Main Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <BackendStatusBanner
            reachable={!healthQuery.isError}
            onRetry={() => healthQuery.refetch()}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
