import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle } from 'lucide-react';
import { fetchBatches } from '@/src/lib/api';
import { formatDate, getBatchCentreName, getBatchDistrict, isBatchOverdue } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch } from '@/src/types/certiflow';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'district_review', label: 'District Review' },
  { value: 'quality_review', label: 'Quality Review' },
  { value: 'state_review', label: 'State Review' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
];

export function BatchesPage() {
  const { canonicalRole } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const batchesQuery = useQuery({
    queryKey: ['batches', { page, limit: 20, status: statusFilter }],
    queryFn: () => fetchBatches({ page, limit: 20, status: statusFilter }),
  });

  const columns: DataColumn<Batch>[] = [
    {
      key: 'title',
      header: 'Batch Title & Course',
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
      header: 'Status',
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={b.status} />
          {isBatchOverdue(b) && <StatusBadge status="overdue" />}
        </div>
      ),
    },
    {
      key: 'revision',
      header: 'Revision',
      align: 'right',
      render: (b) => <span className="font-mono text-xs tabular-nums">Rev {b.revision}</span>,
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
      key: 'deadline',
      header: 'Deadline',
      align: 'right',
      render: (b) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDate(b.deadlineAt || b.deadline)}
        </span>
      ),
    },
  ];

  const batches = batchesQuery.data?.batches || [];

  return (
    <AppLayout
      title={canonicalRole === 'state_officer' ? 'Programme Batch Browser' : 'Batches'}
      subtitle="Browse skilling batches filtered by workflow stage."
      actions={
        canonicalRole === 'training_centre' ? (
          <Button asChild>
            <Link to="/batches/new">
              <PlusCircle className="h-4 w-4" />
              Create Batch
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {batchesQuery.isLoading ? (
          <LoadingState rows={6} message="Loading batches..." />
        ) : batchesQuery.isError ? (
          <ErrorState
            error={batchesQuery.error}
            title="Unable to load batches"
            onRetry={() => batchesQuery.refetch()}
          />
        ) : batches.length === 0 ? (
          <EmptyState
            title="No batches found"
            description="There are no batches matching the selected status filter."
          />
        ) : (
          <DataTable
            data={batches}
            columns={columns}
            getRowKey={(b) => b._id}
            onRowClick={(b) => navigate(`/batches/${b._id}`)}
            page={batchesQuery.data?.page ?? page}
            limit={20}
            total={batchesQuery.data?.total}
            onPageChange={setPage}
            isFetching={batchesQuery.isFetching}
          />
        )}
      </div>
    </AppLayout>
  );
}
