import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchStateEscalations } from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/utils';
import type { EscalationItem } from '@/src/types/certiflow';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';

const PAGE_LIMIT = 20;

export function EscalationsPage() {
  const [page, setPage] = useState(1);
  const [includeResolved, setIncludeResolved] = useState(false);

  const escalationsQuery = useQuery({
    queryKey: ['state-escalations', { page, includeResolved }],
    queryFn: () =>
      fetchStateEscalations({ page, limit: PAGE_LIMIT, includeResolved }),
  });

  const getBatchLink = (item: EscalationItem): { id?: string; title: string } => {
    if (typeof item.batchId === 'object' && item.batchId !== null) {
      return { id: item.batchId._id, title: item.batchId.title || item.batchId._id };
    }
    return {
      id: typeof item.batchId === 'string' ? item.batchId : undefined,
      title: item.batchTitle || (typeof item.batchId === 'string' ? item.batchId : 'Batch'),
    };
  };

  const columns: DataColumn<EscalationItem>[] = [
    {
      key: 'batch',
      header: 'Batch',
      render: (item) => {
        const b = getBatchLink(item);
        return b.id ? (
          <Link to={`/batches/${b.id}`} className="font-semibold text-primary hover:underline">
            {b.title}
          </Link>
        ) : (
          <span className="font-semibold">{b.title}</span>
        );
      },
    },
    {
      key: 'stage',
      header: 'Stage / Reason',
      render: (item) => (
        <div>
          {item.stage && (
            <p className="text-xs font-medium capitalize">
              {item.stage.replace(/_/g, ' ')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{item.reason || item.type || 'SLA deadline exceeded'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Escalation Status',
      render: (item) => {
        const resolved = Boolean(item.resolved || item.resolvedAt || item.status === 'resolved');
        return <StatusBadge status={resolved ? 'resolved' : 'unresolved'} />;
      },
    },
    {
      key: 'createdAt',
      header: 'Raised At',
      align: 'right',
      render: (item) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDateTime(item.createdAt)}
        </span>
      ),
    },
  ];

  const escalations = escalationsQuery.data?.escalations || [];

  return (
    <AppLayout
      title="SLA Escalations"
      subtitle="Batches that exceeded review stage deadlines across district, quality, or state stages."
      actions={
        <Button
          variant={includeResolved ? 'default' : 'outline'}
          onClick={() => {
            setIncludeResolved((prev) => !prev);
            setPage(1);
          }}
        >
          {includeResolved ? 'Showing Resolved + Open' : 'Include Resolved Items'}
        </Button>
      }
    >
      {escalationsQuery.isLoading ? (
        <LoadingState rows={5} message="Loading escalations..." />
      ) : escalationsQuery.isError ? (
        <ErrorState
          error={escalationsQuery.error}
          title="Unable to load escalations"
          onRetry={() => escalationsQuery.refetch()}
        />
      ) : escalations.length === 0 ? (
        <EmptyState
          title="No escalations found"
          description={
            includeResolved
              ? 'No escalation records exist.'
              : 'There are no unresolved escalations right now.'
          }
        />
      ) : (
        <DataTable
          data={escalations}
          columns={columns}
          getRowKey={(item) => item._id}
          page={escalationsQuery.data?.page ?? page}
          limit={PAGE_LIMIT}
          total={escalationsQuery.data?.total}
          onPageChange={setPage}
          isFetching={escalationsQuery.isFetching}
        />
      )}
    </AppLayout>
  );
}
