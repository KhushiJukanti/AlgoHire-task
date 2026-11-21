import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchStateJobs,
  retryBatchIssuance,
  retryCertificateDelivery,
} from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/utils';
import type { FailedJobItem } from '@/src/types/certiflow';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

export function JobsPage() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ['state-jobs'],
    queryFn: fetchStateJobs,
    refetchInterval: 15000,
  });

  const retryIssuanceMutation = useMutation({
    mutationFn: (batchId: string) => retryBatchIssuance(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      toast.success('Batch certificate issuance retry queued.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to retry batch issuance');
    },
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: (certificateId: string) => retryCertificateDelivery(certificateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['state-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      toast.success('Certificate delivery retry queued.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to retry delivery');
    },
  });

  const data = jobsQuery.data;
  const queues = data?.queues || {};
  const failedJobs = data?.failedJobs || data?.jobs || [];

  const getJobType = (job: FailedJobItem) =>
    (job.type || job.jobType || job.queue || 'unknown').toLowerCase();

  const columns: DataColumn<FailedJobItem>[] = [
    {
      key: 'type',
      header: 'Job Type',
      render: (j) => (
        <span className="font-mono text-xs font-semibold">
          {j.type || j.jobType || j.queue || 'job'}
        </span>
      ),
    },
    {
      key: 'target',
      header: 'Linked Record',
      render: (j) => (
        <div className="space-y-0.5 text-xs">
          {j.batchId && (
            <div>
              Batch:{' '}
              <Link to={`/batches/${j.batchId}`} className="font-mono text-primary hover:underline">
                {j.batchId}
              </Link>
            </div>
          )}
          {j.certificateId && (
            <div>
              Cert:{' '}
              <Link
                to={`/certificates/${j.certificateId}`}
                className="font-mono text-primary hover:underline"
              >
                {j.certificateId}
              </Link>
            </div>
          )}
          {!j.batchId && !j.certificateId && <span className="text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      render: (j) => (
        <span className="font-mono text-xs tabular-nums">
          {j.attempts ?? 0}
          {typeof j.maxAttempts === 'number' ? ` / ${j.maxAttempts}` : ''}
        </span>
      ),
    },
    {
      key: 'error',
      header: 'Backend Error',
      render: (j) => (
        <p className="max-w-md text-xs text-destructive break-words">
          {j.errorMessage || j.lastError || j.error || 'No error message provided'}
        </p>
      ),
    },
    {
      key: 'failedAt',
      header: 'Failed At',
      align: 'right',
      render: (j) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDateTime(j.failedAt || j.updatedAt || j.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Retry',
      align: 'right',
      render: (j) => {
        const typeStr = getJobType(j);
        const isIssuance = typeStr.includes('issu') && Boolean(j.batchId);
        const isDelivery = typeStr.includes('deliver') && Boolean(j.certificateId);
        const statusStr = (j.status || 'failed').toLowerCase();
        const isRetryableState = statusStr === 'failed' || !j.status;

        if (!isRetryableState) {
          return <StatusBadge status={statusStr} />;
        }

        if (isIssuance && j.batchId) {
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={retryIssuanceMutation.isPending}
              onClick={() => retryIssuanceMutation.mutate(j.batchId!)}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry Issuance
            </Button>
          );
        }

        if (isDelivery && j.certificateId) {
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={retryDeliveryMutation.isPending}
              onClick={() => retryDeliveryMutation.mutate(j.certificateId!)}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry Delivery
            </Button>
          );
        }

        return <span className="text-xs text-muted-foreground">No retry target</span>;
      },
    },
  ];

  return (
    <AppLayout
      title="Queues & Failed Jobs"
      subtitle="Monitor asynchronous certificate issuance and WhatsApp delivery queues."
      actions={
        <Button variant="outline" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching}>
          <RefreshCw className={`h-4 w-4 ${jobsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      {jobsQuery.isLoading ? (
        <LoadingState rows={5} message="Loading queue status..." />
      ) : jobsQuery.isError ? (
        <ErrorState
          error={jobsQuery.error}
          title="Unable to load queue status"
          onRetry={() => jobsQuery.refetch()}
        />
      ) : (
        <div className="space-y-6">
          {Object.keys(queues).length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(queues).map(([queueName, metrics]) => (
                <Card key={queueName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">
                      {queueName.replace(/[_-]/g, ' ')} Queue
                    </CardTitle>
                    <CardDescription>Live worker counts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {typeof metrics === 'number' ? (
                      <p className="font-mono text-2xl font-bold tabular-nums">{metrics}</p>
                    ) : (
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(metrics).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between rounded bg-muted/40 px-2.5 py-1.5">
                            <dt className="text-muted-foreground capitalize">{k}</dt>
                            <dd className="font-mono font-semibold tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Failed Jobs</h2>
            {failedJobs.length === 0 ? (
              <EmptyState
                title="No failed jobs"
                description="All certificate issuance and delivery background jobs completed without unresolved failures."
              />
            ) : (
              <DataTable
                data={failedJobs}
                columns={columns}
                getRowKey={(j, idx) => j._id || `${getJobType(j)}-${idx}`}
              />
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
