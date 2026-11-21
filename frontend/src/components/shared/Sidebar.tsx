import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Cpu,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  PlusCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn, formatRoleLabel } from '@/src/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function useRoleNavigation(): NavItem[] {
  const { canonicalRole } = useAuth();

  if (canonicalRole === 'training_centre') {
    return [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/batches', label: 'Batches', icon: FolderKanban },
      { to: '/batches/new', label: 'New Batch', icon: PlusCircle },
      { to: '/verify', label: 'Public Verify', icon: ShieldCheck },
    ];
  }

  if (canonicalRole === 'district_officer' || canonicalRole === 'quality_reviewer') {
    return [
      { to: '/inbox', label: 'Review Inbox', icon: Inbox },
      { to: '/batches', label: 'All Batches', icon: FolderKanban },
      { to: '/verify', label: 'Public Verify', icon: ShieldCheck },
    ];
  }

  if (canonicalRole === 'state_officer') {
    return [
      { to: '/dashboard', label: 'State Overview', icon: LayoutDashboard },
      { to: '/inbox', label: 'Final Inbox', icon: Inbox },
      { to: '/batches', label: 'Programme Batches', icon: FolderKanban },
      { to: '/escalations', label: 'Escalations', icon: AlertTriangle },
      { to: '/jobs', label: 'Queues & Jobs', icon: Cpu },
      { to: '/verify', label: 'Public Verify', icon: ShieldCheck },
    ];
  }

  return [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/verify', label: 'Public Verify', icon: ShieldCheck },
  ];
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { user } = useAuth();
  const navItems = useRoleNavigation();

  const content = (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Award className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-foreground">
              CertiFlow
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Primary navigation" className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {user && (
        <div className="border-t border-border p-4">
          <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {formatRoleLabel(user.role)}
          </p>
          {(user.centreName || user.district) && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {user.centreName || user.district}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:border-r lg:border-border">
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
