import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDefaultHomePath } from '@/src/lib/utils';
import { LoadingState } from '@/src/components/shared/StateViews';
import type { CanonicalRole } from '@/src/types/certiflow';

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: CanonicalRole[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, isInitializing, canonicalRole, user } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <LoadingState rows={4} message="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!canonicalRole || !allowedRoles.includes(canonicalRole)) {
      return <Navigate to={getDefaultHomePath(user?.role)} replace />;
    }
  }

  return <>{children}</>;
}
