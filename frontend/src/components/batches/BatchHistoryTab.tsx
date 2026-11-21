import { useQuery } from '@tanstack/react-query';
import { fetchBatchHistory } from '@/src/lib/api';
import { formatDateTime, formatRoleLabel } from '@/src/lib/utils';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

export function BatchHistoryTab({ batchId }: { batchId: string }) {
  const historyQuery = useQuery({
    queryKey: ['batch-history', batchId],
    queryFn: () => fetchBatchHistory(batchId),
  });

  if (historyQuery.isLoading) {
    return <LoadingState rows={4} message="Loading decisions and audit trail..." />;
  }

  if (historyQuery.isError) {
    return (
      <ErrorState
        error={historyQuery.error}
        title="Unable to load batch history"
        onRetry={() => historyQuery.refetch()}
      />
    );
  }

  const decisions = historyQuery.data?.decisions || [];
  const audit = historyQuery.data?.audit || [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Reviewer Decisions</CardTitle>
          <CardDescription>
            Formal approval, return, and rejection actions recorded across revisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <EmptyState
              title="No reviewer decisions yet"
              description="Decisions recorded during district, quality, or state review will appear here."
            />
          ) : (
            <ol className="space-y-3">
              {decisions.map((item, idx) => (
                <li
                  key={item._id || idx}
                  className="rounded-md border border-border bg-muted/25 p-3.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge
                      status={
                        item.action === 'approve'
                          ? 'approved'
                          : item.action === 'return'
                            ? 'returned'
                            : item.action === 'reject'
                              ? 'rejected'
                              : item.action
                      }
                      labelOverride={item.action}
                    />
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {typeof item.revision === 'number' ? `Rev ${item.revision} · ` : ''}
                      {formatDateTime(item.decidedAt || item.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {item.actorName || item.officerName || item.actorEmail || 'Reviewer'}
                    {item.actorRole ? (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({formatRoleLabel(item.actorRole)})
                      </span>
                    ) : null}
                  </p>
                  {item.stage && (
                    <p className="text-xs text-muted-foreground">
                      Stage: <span className="capitalize">{item.stage.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                  {item.reason && (
                    <p className="rounded bg-card px-2.5 py-2 text-xs text-foreground border border-border">
                      Reason: {item.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            System-recorded submissions, state transitions, and workflow events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <EmptyState
              title="No audit events recorded"
              description="Batch creation, submission, and issuance milestones will appear here."
            />
          ) : (
            <ol className="space-y-3">
              {audit.map((entry, idx) => (
                <li
                  key={entry._id || idx}
                  className="rounded-md border border-border bg-muted/25 p-3.5 space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground capitalize">
                      {(entry.event || entry.action || 'Event').replace(/[._]/g, ' ')}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatDateTime(entry.createdAt || entry.timestamp)}
                    </span>
                  </div>
                  {(entry.actorName || entry.actorEmail) && (
                    <p className="text-xs text-muted-foreground">
                      Actor: {entry.actorName || entry.actorEmail}
                      {entry.actorRole ? ` (${formatRoleLabel(entry.actorRole)})` : ''}
                    </p>
                  )}
                  {entry.message && (
                    <p className="text-xs text-foreground">{entry.message}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
