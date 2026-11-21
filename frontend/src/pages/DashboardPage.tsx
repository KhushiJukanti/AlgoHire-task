import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Cpu,
  FolderKanban,
  Inbox,
  PlusCircle,
} from 'lucide-react';
import { fetchBatches, fetchStateDashboard } from '@/src/lib/api';
import { formatDate, getBatchCentreName, isBatchOverdue } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch } from '@/src/types/certiflow';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'district_review', label: 'District Review' },
  { value: 'quality_review', label: 'Quality Review' },
  { value: 'state_review', label: 'State Review' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
];

export function DashboardPage() {
  const { canonicalRole, user } = useAuth();

  if (canonicalRole === 'district_officer' || canonicalRole === 'quality_reviewer') {
    return <Navigate to="/inbox" replace />;
  }

  if (canonicalRole === 'state_officer') {
    return <StateDashboardView userName={user?.name} />;
  }

  return <TrainingCentreDashboardView centreName={user?.centreName} />;
}

function TrainingCentreDashboardView({ centreName }: { centreName?: string }) {
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
      key: 'candidateCount',
      header: 'Candidates',
      align: 'right',
      render: (b) => (
        <span className="font-mono text-xs tabular-nums">
          {typeof b.candidateCount === 'number' ? b.candidateCount : '—'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      align: 'right',
      render: (b) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDate(b.updatedAt || b.createdAt)}
        </span>
      ),
    },
  ];

  const batches = batchesQuery.data?.batches || [];

  return (
    <AppLayout
      title="Training Centre Dashboard"
      subtitle={
        centreName
          ? `${centreName} — Prepare candidate rosters, submit batches, and track certificate issuance.`
          : 'Prepare candidate rosters, submit batches, and track certificate issuance.'
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/batches">
              <FolderKanban className="h-4 w-4" />
              All Batches
            </Link>
          </Button>
          <Button asChild>
            <Link to="/batches/new">
              <PlusCircle className="h-4 w-4" />
              Create Batch
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {batchesQuery.isLoading ? (
          <LoadingState rows={5} message="Loading centre batches..." />
        ) : batchesQuery.isError ? (
          <ErrorState
            error={batchesQuery.error}
            title="Unable to load batches"
            onRetry={() => batchesQuery.refetch()}
          />
        ) : batches.length === 0 ? (
          <EmptyState
            title="No batches match this filter"
            description="Create a new skilling batch or switch the status filter above."
            action={
              <Button asChild>
                <Link to="/batches/new">
                  <PlusCircle className="h-4 w-4" />
                  Create New Batch
                </Link>
              </Button>
            }
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

function StateDashboardView({ userName }: { userName?: string }) {
  const navigate = useNavigate();
  const dashboardQuery = useQuery({
    queryKey: ['state-dashboard'],
    queryFn: fetchStateDashboard,
  });

  const data = dashboardQuery.data;
  const batchCounts = data?.batchesByStatus || data?.batchCounts || {};
  const certCounts = data?.certificatesByStatus || data?.certificateCounts || {};
  const unresolvedEscalations =
    data?.unresolvedEscalations ?? data?.unresolvedEscalationCount;
  const failedDeliveries =
    data?.failedDeliveries ?? data?.failedDeliveryCount;

  return (
    <AppLayout
      title="State Programme Overview"
      subtitle={
        userName
          ? `Signed in as ${userName}. Monitor statewide batch progression, escalations, issuance queues, and deliveries.`
          : 'Monitor statewide batch progression, escalations, issuance queues, and deliveries.'
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/escalations">
              <AlertTriangle className="h-4 w-4" />
              Escalations
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/jobs">
              <Cpu className="h-4 w-4" />
              Queues &amp; Jobs
            </Link>
          </Button>
          <Button asChild>
            <Link to="/inbox">
              <Inbox className="h-4 w-4" />
              Final Review Inbox
            </Link>
          </Button>
        </>
      }
    >
      {dashboardQuery.isLoading ? (
        <LoadingState rows={5} message="Loading state programme metrics..." />
      ) : dashboardQuery.isError ? (
        <ErrorState
          error={dashboardQuery.error}
          title="Unable to load State Dashboard"
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : (
        <div className="space-y-6">
          {/* Key Operational Alerts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending State Review</CardDescription>
                <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                  {batchCounts.state_review ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="px-0 text-primary" onClick={() => navigate('/inbox')}>
                  Open Final Inbox
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unresolved Escalations</CardDescription>
                <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                  {typeof unresolvedEscalations === 'number' ? unresolvedEscalations : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="px-0 text-primary" onClick={() => navigate('/escalations')}>
                  Inspect Escalations
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Failed Deliveries</CardDescription>
                <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                  {typeof failedDeliveries === 'number' ? failedDeliveries : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" className="px-0 text-primary" onClick={() => navigate('/jobs')}>
                  View Failed Jobs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Valid Certificates</CardDescription>
                <CardTitle className="text-3xl font-bold font-mono tabular-nums">
                  {certCounts.valid ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Revoked: {certCounts.revoked ?? 0}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Batches by Status</CardTitle>
                <CardDescription>Live batch distribution returned by the state dashboard API.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Workflow Status</th>
                        <th className="px-4 py-2.5 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(batchCounts).map(([statusKey, count]) => (
                        <tr key={statusKey}>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={statusKey} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                            {count}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(batchCounts).length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-center text-xs text-muted-foreground">
                            No batch counts reported.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certificates by Status</CardTitle>
                <CardDescription>Issued and revoked certificate counts across the programme.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Certificate Status</th>
                        <th className="px-4 py-2.5 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.entries(certCounts).map(([statusKey, count]) => (
                        <tr key={statusKey}>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={statusKey} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">
                            {count}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(certCounts).length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-center text-xs text-muted-foreground">
                            No certificate counts reported.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
