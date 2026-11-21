import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Copy,
  Download,
  ExternalLink,
  Info,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createSignedDownloadLink,
  downloadCertificatePdfAuthenticated,
  fetchBatchCertificates,
  revokeCertificate,
  triggerBlobDownload,
} from '@/src/lib/api';
import { formatDate } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch, Certificate } from '@/src/types/certiflow';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { ConfirmDialog } from '@/src/components/shared/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';

const PAGE_LIMIT = 20;

export function BatchCertificatesTab({ batch }: { batch: Batch }) {
  const { canonicalRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);

  const isStateOfficer = canonicalRole === 'state_officer';
  const canManageDelivery = isStateOfficer || canonicalRole === 'training_centre';

  const certificatesQuery = useQuery({
    queryKey: ['batch-certificates', batch._id, page],
    queryFn: () => fetchBatchCertificates(batch._id, { page, limit: PAGE_LIMIT }),
    refetchInterval: batch.status === 'approved' ? 12000 : false,
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => revokeCertificate(id, reason),
    onSuccess: () => {
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ['batch-certificates', batch._id] });
      queryClient.invalidateQueries({ queryKey: ['batch-deliveries', batch._id] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      toast.success('Certificate revoked.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to revoke certificate');
    },
  });

  const handleDownloadPdf = async (cert: Certificate) => {
    setBusyId(cert._id);
    try {
      const { blob, filename } = await downloadCertificatePdfAuthenticated(cert._id);
      triggerBlobDownload(blob, filename);
      toast.success('Certificate PDF downloaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download PDF');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAndCopyLink = async (cert: Certificate) => {
    setBusyId(cert._id);
    try {
      const res = await createSignedDownloadLink(cert._id);
      const urlToCopy = res.url;
      if (navigator.clipboard && urlToCopy) {
        await navigator.clipboard.writeText(urlToCopy);
        toast.success('Signed candidate download link copied to clipboard.');
      } else {
        toast.success(`Signed link created: ${urlToCopy}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate download link');
    } finally {
      setBusyId(null);
    }
  };

  if (certificatesQuery.isLoading) {
    return <LoadingState rows={4} message="Loading certificates..." />;
  }

  if (certificatesQuery.isError) {
    return (
      <ErrorState
        error={certificatesQuery.error}
        title="Unable to load batch certificates"
        onRetry={() => certificatesQuery.refetch()}
      />
    );
  }

  const certificates = certificatesQuery.data?.certificates || [];

  const infoNotice = canManageDelivery ? (
    <div className="mb-4 flex items-start gap-2.5 rounded-md border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="text-foreground font-medium">
          Asynchronous Issuance &amp; Revocation Rules
        </p>
        <p>
          Final approval queues certificate generation asynchronously—approval does not guarantee immediate delivery. Revoked certificates cannot be downloaded, and CertiFlow does not support replacing or reissuing a revoked certificate.
        </p>
      </div>
    </div>
  ) : null;

  if (certificates.length === 0) {
    return (
      <div>
        {infoNotice}
        <EmptyState
          title="No certificates issued yet"
          description={
            batch.status === 'approved'
              ? isStateOfficer
                ? 'Certificates are being generated. If processing fails, check Queues & Jobs.'
                : 'Certificates are being generated following state approval. Check back shortly.'
              : 'Certificates are generated only after final State Officer approval.'
          }
        />
      </div>
    );
  }

  const columns: DataColumn<Certificate>[] = [
    {
      key: 'certificateNumber',
      header: 'Certificate No.',
      render: (c) => (
        <Link
          to={`/certificates/${c._id}`}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {c.certificateNumber || c.serialNumber || c._id}
        </Link>
      ),
    },
    {
      key: 'candidate',
      header: 'Candidate',
      render: (c) => (
        <div>
          <p className="font-medium text-foreground">
            {c.candidateName || c.holderName || '—'}
          </p>
          {c.candidateId && (
            <p className="font-mono text-[11px] text-muted-foreground">{c.candidateId}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'issuedAt',
      header: 'Issued Date',
      render: (c) => (
        <span className="font-mono text-xs tabular-nums">
          {formatDate(c.issuedAt || c.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => {
        const isRevoked = c.status === 'revoked';
        const isBusy = busyId === c._id;
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isRevoked || isBusy}
              title={isRevoked ? 'Revoked certificates cannot be downloaded' : 'Download PDF'}
              onClick={() => handleDownloadPdf(c)}
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
            {canManageDelivery && <Button
              variant="outline"
              size="sm"
              disabled={isRevoked || isBusy}
              title="Create and copy signed candidate download link"
              onClick={() => handleCreateAndCopyLink(c)}
            >
              <Link2 className="h-3.5 w-3.5" />
              <Copy className="h-3 w-3" />
            </Button>}
            {c.verificationToken && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/verify/${encodeURIComponent(c.verificationToken)}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Verify
                </Link>
              </Button>
            )}
            {isStateOfficer && !isRevoked && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRevokeTarget(c)}
              >
                <Ban className="h-3.5 w-3.5" />
                Revoke
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {infoNotice}
      <DataTable
        data={certificates}
        columns={columns}
        getRowKey={(c) => c._id}
        page={certificatesQuery.data?.page ?? page}
        limit={PAGE_LIMIT}
        total={certificatesQuery.data?.total}
        onPageChange={setPage}
        isFetching={certificatesQuery.isFetching}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={`Revoke Certificate ${revokeTarget?.certificateNumber || ''}?`}
        description="Revoking a certificate invalidates public verification and blocks PDF downloads permanently. There is no reissue or replacement action."
        confirmLabel="Revoke Certificate"
        variant="destructive"
        requireReason
        reasonLabel="Revocation Reason"
        reasonPlaceholder="Specify why this certificate is being revoked..."
        isLoading={revokeMutation.isPending}
        onConfirm={(reason) => {
          if (revokeTarget && reason) {
            revokeMutation.mutate({ id: revokeTarget._id, reason });
          }
        }}
      />
    </div>
  );
}
