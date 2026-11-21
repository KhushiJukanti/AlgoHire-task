import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { fetchBatchRevisions } from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/utils';
import type { RevisionSnapshot } from '@/src/types/certiflow';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';

const PAGE_LIMIT = 20;

export function BatchRevisionsTab({ batchId }: { batchId: string }) {
  const [page, setPage] = useState(1);
  const [selectedSnapshot, setSelectedSnapshot] = useState<RevisionSnapshot | null>(null);

  const revisionsQuery = useQuery({
    queryKey: ['batch-revisions', batchId, page],
    queryFn: () => fetchBatchRevisions(batchId, { page, limit: PAGE_LIMIT }),
  });

  if (revisionsQuery.isLoading) {
    return <LoadingState rows={3} message="Loading submitted revisions..." />;
  }

  if (revisionsQuery.isError) {
    return (
      <ErrorState
        error={revisionsQuery.error}
        title="Unable to load submitted revisions"
        onRetry={() => revisionsQuery.refetch()}
      />
    );
  }

  const revisions = revisionsQuery.data?.revisions || [];

  if (revisions.length === 0) {
    return (
      <EmptyState
        title="No submitted revisions yet"
        description="Revision snapshots are captured each time a batch is submitted for review."
      />
    );
  }

  const columns: DataColumn<RevisionSnapshot>[] = [
    {
      key: 'revision',
      header: 'Revision',
      render: (r) => <span className="font-mono text-xs font-semibold">Rev {r.revision}</span>,
    },
    {
      key: 'title',
      header: 'Title & Course',
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.title || '—'}</p>
          {r.course && <p className="text-xs text-muted-foreground">{r.course}</p>}
        </div>
      ),
    },
    {
      key: 'candidateCount',
      header: 'Candidates',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs tabular-nums">
          {r.candidateCount ?? r.candidates?.length ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Snapshot Status',
      render: (r) => (r.status ? <StatusBadge status={r.status} /> : '—'),
    },
    {
      key: 'submittedAt',
      header: 'Submitted At',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs tabular-nums">
          {formatDateTime(r.submittedAt || r.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Snapshot',
      align: 'right',
      render: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSnapshot(r);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={revisions}
        columns={columns}
        getRowKey={(r, i) => r._id || String(r.revision ?? i)}
        page={revisionsQuery.data?.page ?? page}
        limit={PAGE_LIMIT}
        total={revisionsQuery.data?.total}
        onPageChange={setPage}
        isFetching={revisionsQuery.isFetching}
      />

      <Dialog open={Boolean(selectedSnapshot)} onOpenChange={(o) => !o && setSelectedSnapshot(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revision {selectedSnapshot?.revision} Snapshot</DialogTitle>
            <DialogDescription>
              Submitted {formatDateTime(selectedSnapshot?.submittedAt || selectedSnapshot?.createdAt)}
              {selectedSnapshot?.actorName ? ` by ${selectedSnapshot.actorName}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedSnapshot && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Title</span>
                  <p className="font-medium text-foreground mt-0.5">{selectedSnapshot.title || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Course</span>
                  <p className="font-medium text-foreground mt-0.5">{selectedSnapshot.course || '—'}</p>
                </div>
              </div>

              {selectedSnapshot.candidates && selectedSnapshot.candidates.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Candidate ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Completed On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedSnapshot.candidates.map((c, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 font-mono">{c.candidateId}</td>
                          <td className="px-3 py-2">{c.name}</td>
                          <td className="px-3 py-2 font-mono">{c.phone}</td>
                          <td className="px-3 py-2 font-mono">
                            {c.courseCompletedOn ? String(c.courseCompletedOn).slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Candidate count recorded: {selectedSnapshot.candidateCount ?? '—'}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
