import { MockMessagePreview } from '@/src/components/batches/MockMessagePreview';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, MessageSquareText, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchBatchDeliveries,
  fetchMockWhatsAppMessage,
  retryCertificateDelivery,
} from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch, DeliveryRecord, MockWhatsAppMessage } from '@/src/types/certiflow';
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

export function BatchDeliveriesTab({ batch }: { batch: Batch }) {
  const { canonicalRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [messageModal, setMessageModal] = useState<{
    open: boolean;
    loading: boolean;
    error: string | null;
    data: MockWhatsAppMessage | null;
  }>({ open: false, loading: false, error: null, data: null });

  const canRetry = canonicalRole === 'state_officer' || canonicalRole === 'training_centre';

  const deliveriesQuery = useQuery({
    queryKey: ['batch-deliveries', batch._id, page],
    queryFn: () => fetchBatchDeliveries(batch._id, { page, limit: PAGE_LIMIT }),
    refetchInterval: batch.status === 'approved' ? 12000 : false,
  });

  const retryMutation = useMutation({
    mutationFn: (certificateId: string) => retryCertificateDelivery(certificateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-deliveries', batch._id] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['state-jobs'] });
      toast.success('Delivery retry queued.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to retry delivery');
    },
  });

  const handleOpenMockMessage = async (certificateId: string) => {
    setMessageModal({ open: true, loading: true, error: null, data: null });
    try {
      const msg = await fetchMockWhatsAppMessage(certificateId);
      setMessageModal({ open: true, loading: false, error: null, data: msg });
    } catch (err) {
      setMessageModal({
        open: true,
        loading: false,
        error: err instanceof Error ? err.message : 'Unable to load mock WhatsApp record',
        data: null,
      });
    }
  };

  if (deliveriesQuery.isLoading) {
    return <LoadingState rows={4} message="Loading delivery statuses..." />;
  }

  if (deliveriesQuery.isError) {
    return (
      <ErrorState
        error={deliveriesQuery.error}
        title="Unable to load delivery statuses"
        onRetry={() => deliveriesQuery.refetch()}
      />
    );
  }

  const deliveries = deliveriesQuery.data?.deliveries || [];

  const mockNotice = (
    <div className="mb-4 flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          Mock WhatsApp Provider &amp; Asynchronous Delivery
        </p>
        <p>
          In demo mode, WhatsApp notifications are recorded by a mock provider rather than sent via a live telecom gateway. Deliveries may temporarily fail or time out before succeeding.
        </p>
      </div>
    </div>
  );

  if (deliveries.length === 0) {
    return (
      <div>
        {mockNotice}
        <EmptyState
          title="No delivery records yet"
          description="Delivery jobs are created asynchronously after certificates are generated."
        />
      </div>
    );
  }

  const columns: DataColumn<DeliveryRecord>[] = [
    {
      key: 'candidate',
      header: 'Candidate & Recipient',
      render: (d) => (
        <div>
          <p className="font-medium text-foreground">
            {d.candidateName || d.certificateNumber || 'Candidate'}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{d.phone || d.recipient || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Delivery Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      render: (d) => <span className="font-mono text-xs tabular-nums">{d.attempts ?? 0}</span>,
    },
    {
      key: 'error',
      header: 'Error / Updated',
      render: (d) => (
        <div className="max-w-xs">
          {d.lastError || d.error ? (
            <p className="text-xs text-destructive break-words">{d.lastError || d.error}</p>
          ) : (
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatDateTime(d.sentAt || d.updatedAt || d.createdAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {d.certificateId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenMockMessage(d.certificateId!)}
            >
              <MessageSquareText className="h-3.5 w-3.5" />
              Mock Message
            </Button>
          )}
          {canRetry && d.status === 'failed' && d.certificateId && (
            <Button
              variant="default"
              size="sm"
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate(d.certificateId!)}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry Delivery
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {mockNotice}
      <DataTable
        data={deliveries}
        columns={columns}
        getRowKey={(d) => d._id}
        page={deliveriesQuery.data?.page ?? page}
        limit={PAGE_LIMIT}
        total={deliveriesQuery.data?.total}
        onPageChange={setPage}
        isFetching={deliveriesQuery.isFetching}
      />

      <Dialog
        open={messageModal.open}
        onOpenChange={(open) => !open && setMessageModal((s) => ({ ...s, open: false }))}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Certificate Message Preview</DialogTitle>
            <DialogDescription>
              A preview of the certificate notification for this candidate.
            </DialogDescription>
          </DialogHeader>
          {messageModal.loading ? (
            <LoadingState rows={2} message="Loading mock message..." />
          ) : messageModal.error ? (
            <p role="alert" className="text-sm text-destructive mt-2">
              {messageModal.error}
            </p>
          ) : messageModal.data ? (
            <MockMessagePreview message={messageModal.data} />
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No mock WhatsApp message record exists yet for this certificate.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
