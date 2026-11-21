import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchReviewInbox } from '@/src/lib/api';
import { formatDateTime, getBatchCentreName, getBatchDistrict, isBatchOverdue } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch } from '@/src/types/certiflow';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';

const PAGE_LIMIT = 20;

export function InboxPage() {
  const { canonicalRole } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const inboxQuery = useQuery({
    queryKey: ['inbox', page],
    queryFn: () => fetchReviewInbox({ page, limit: PAGE_LIMIT }),
  });

  const subtitle =
    canonicalRole === 'district_officer'
      ? 'Batches awaiting District Review. Two distinct district officers must approve before advancing.'
      : canonicalRole === 'quality_reviewer'
        ? 'Large batches (more than 50 candidates) awaiting Quality Review before State Review.'
        : 'Batches awaiting final state approval after two district approvals and, for batches over 50 candidates, quality approval.';

  const columns: DataColumn<Batch>[] = [
    {
      key: 'title',
      header: 'Batch & Course',
      render: (b) => (
        <div>
          <p className="font-semibold text-foreground">{b.title}</p>
          <p className="text-xs text-muted-foreground">{b.course}</p>
        </div>
      ),
    },
    {
      key: 'centre',
      header: 'Centre / District',
      render: (b) => (
        <div className="text-xs">
          <p className="font-medium text-foreground">{getBatchCentreName(b)}</p>
          <p className="text-muted-foreground">{getBatchDistrict(b)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Stage & Status',
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={b.status} />
          {isBatchOverdue(b) && <StatusBadge status="overdue" />}
        </div>
      ),
    },
    {
      key: 'candidates',
      header: 'Candidates',
      align: 'right',
      render: (b) => (
        <span className="font-mono text-xs tabular-nums">
          {typeof b.candidateCount === 'number' ? b.candidateCount : '—'}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      align: 'right',
      render: (b) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDateTime(b.submittedAt || b.createdAt)}
        </span>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      align: 'right',
      render: (b) => {
        const overdue = isBatchOverdue(b);
        return (
          <span
            className={`font-mono text-xs tabular-nums ${
              overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'
            }`}
          >
            {formatDateTime(b.deadlineAt || b.deadline)}
          </span>
        );
      },
    },
  ];

  const batches = inboxQuery.data?.batches || [];

  return (
    <AppLayout
      title={
        canonicalRole === 'state_officer'
          ? 'Final State Review Inbox'
          : canonicalRole === 'quality_reviewer'
            ? 'Quality Review Inbox'
            : 'District Review Inbox'
      }
      subtitle={subtitle}
    >
      {inboxQuery.isLoading ? (
        <LoadingState rows={5} message="Loading review inbox..." />
      ) : inboxQuery.isError ? (
        <ErrorState
          error={inboxQuery.error}
          title="Unable to load review inbox"
          onRetry={() => inboxQuery.refetch()}
        />
      ) : batches.length === 0 ? (
        <EmptyState
          title={canonicalRole === 'state_officer' ? 'No batches ready for final approval' : 'Review inbox is clear'}
          description={
            canonicalRole === 'state_officer'
              ? 'Batches appear here after two different district officers approve. Batches with more than 50 candidates also need quality approval. Check Programme Batches to see the current stage of each batch.'
              : 'There are currently no pending batches assigned to your review stage.'
          }
        />
      ) : (
        <DataTable
          data={batches}
          columns={columns}
          getRowKey={(b) => b._id}
          onRowClick={(b) => navigate(`/batches/${b._id}`)}
          page={inboxQuery.data?.page ?? page}
          limit={PAGE_LIMIT}
          total={inboxQuery.data?.total}
          onPageChange={setPage}
          isFetching={inboxQuery.isFetching}
        />
      )}
    </AppLayout>
  );
}
