import { AlertCircle, Inbox, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Skeleton } from '@/src/components/ui/skeleton';
import { API_BASE_URL, ApiError } from '@/src/lib/api';

export function LoadingState({
  rows = 5,
  message = 'Loading records...',
}: {
  rows?: number;
  message?: string;
}) {
  return (
    <div className="space-y-3" role="status" aria-label={message}>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/70 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  title = 'Unable to load data',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  const apiErr = error instanceof ApiError ? error : null;
  const isNetwork = Boolean(apiErr?.isNetworkError);
  const message =
    error instanceof Error
      ? error.message
      : 'An unexpected error occurred while communicating with the server.';

  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50/70 p-5 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        {isNetwork ? (
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
        )}
        <div>
          <h3 className="text-sm font-semibold">{isNetwork ? 'Backend Connection Unavailable' : title}</h3>
          <p className="mt-1 text-sm opacity-90">{message}</p>
          {isNetwork && (
            <p className="mt-1.5 text-xs opacity-80">
              Configured API URL: <span className="font-mono">{API_BASE_URL}</span>. If you are viewing a hosted preview, export and run locally with the CertiFlow backend active.
            </p>
          )}
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 bg-card">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function BackendStatusBanner({
  reachable,
  onRetry,
}: {
  reachable: boolean;
  onRetry?: () => void;
}) {
  if (reachable) return null;

  return (
    <div
      role="status"
      className="mb-5 flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2.5 text-sm">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div>
          <span className="font-semibold">Backend server unreachable at </span>
          <span className="font-mono text-xs">{API_BASE_URL}</span>
          <span className="block text-xs opacity-90 mt-0.5">
            Live data and authentication require the CertiFlow backend running locally. Hosted previews cannot access localhost.
          </span>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 bg-card">
          <RefreshCw className="h-3.5 w-3.5" />
          Check Connection
        </Button>
      )}
    </div>
  );
}
