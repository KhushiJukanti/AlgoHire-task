import { MockMessagePreview } from '@/src/components/batches/MockMessagePreview';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MessageSquareText,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createSignedDownloadLink,
  downloadCertificatePdfAuthenticated,
  fetchCertificateById,
  fetchMockWhatsAppMessage,
  retryCertificateDelivery,
  revokeCertificate,
  triggerBlobDownload,
} from '@/src/lib/api';
import { formatDateTime } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { ConfirmDialog } from '@/src/components/shared/ConfirmDialog';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

export function CertificateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canonicalRole } = useAuth();
  const queryClient = useQueryClient();

  const [signedLink, setSignedLink] = useState<{ url: string; expiresIn?: number | string } | null>(
    null
  );
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const isStateOfficer = canonicalRole === 'state_officer';
  const canRetryDelivery =
    canonicalRole === 'state_officer' || canonicalRole === 'training_centre';

  const certQuery = useQuery({
    queryKey: ['certificate', id],
    queryFn: () => fetchCertificateById(id!),
    enabled: Boolean(id),
  });

  const mockMsgQuery = useQuery({
    queryKey: ['certificate-mock-message', id],
    queryFn: () => fetchMockWhatsAppMessage(id!),
    enabled: Boolean(id),
    retry: false,
  });

  const revokeMutation = useMutation({
    mutationFn: (reason: string) => revokeCertificate(id!, reason),
    onSuccess: () => {
      setRevokeOpen(false);
      queryClient.invalidateQueries({ queryKey: ['certificate', id] });
      queryClient.invalidateQueries({ queryKey: ['batch-certificates'] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      toast.success('Certificate revoked.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to revoke certificate');
    },
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: () => retryCertificateDelivery(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificate', id] });
      queryClient.invalidateQueries({ queryKey: ['certificate-mock-message', id] });
      queryClient.invalidateQueries({ queryKey: ['batch-deliveries'] });
      toast.success('Delivery retry queued.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to retry delivery');
    },
  });

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const { blob, filename } = await downloadCertificatePdfAuthenticated(id);
      triggerBlobDownload(blob, filename);
      toast.success('Certificate PDF downloaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCreateLink = async () => {
    if (!id) return;
    setCreatingLink(true);
    try {
      const res = await createSignedDownloadLink(id);
      setSignedLink(res);
      if (navigator.clipboard && res.url) {
        await navigator.clipboard.writeText(res.url);
        toast.success('Signed download link created and copied.');
      } else {
        toast.success('Signed download link created.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to generate download link');
    } finally {
      setCreatingLink(false);
    }
  };

  if (certQuery.isLoading) {
    return (
      <AppLayout title="Certificate Details">
        <LoadingState rows={4} message="Loading certificate details..." />
      </AppLayout>
    );
  }

  if (certQuery.isError || !certQuery.data) {
    return (
      <AppLayout title="Certificate Details">
        <ErrorState
          error={certQuery.error}
          title="Unable to load certificate"
          onRetry={() => certQuery.refetch()}
        />
      </AppLayout>
    );
  }

  const cert = certQuery.data;
  const isRevoked = cert.status === 'revoked';

  return (
    <AppLayout
      title={`Certificate ${cert.certificateNumber || cert.serialNumber || cert._id}`}
      subtitle={cert.candidateName || cert.holderName || 'Issued Skilling Certificate'}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {cert.batchId && (
            <Button variant="outline" asChild>
              <Link to={`/batches/${cert.batchId}`}>
                <ArrowLeft className="h-4 w-4" />
                Back to Batch
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            disabled={isRevoked || downloadingPdf}
            onClick={handleDownloadPdf}
          >
            <Download className="h-4 w-4" />
            {downloadingPdf ? 'Downloading...' : 'Download PDF'}
          </Button>
          <Button
            variant="outline"
            disabled={isRevoked || creatingLink}
            onClick={handleCreateLink}
          >
            <Link2 className="h-4 w-4" />
            {creatingLink ? 'Generating...' : 'Signed Link'}
          </Button>
          {cert.verificationToken && (
            <Button variant="outline" asChild>
              <Link to={`/verify/${encodeURIComponent(cert.verificationToken)}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
                Public Verify
              </Link>
            </Button>
          )}
          {isStateOfficer && !isRevoked && (
            <Button variant="destructive" onClick={() => setRevokeOpen(true)}>
              <Ban className="h-4 w-4" />
              Revoke
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {isRevoked && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/35 dark:text-red-100"
          >
            <p className="font-semibold">This certificate has been revoked.</p>
            {(cert.revocationReason || cert.revokeReason) && (
              <p className="mt-1">Reason: {cert.revocationReason || cert.revokeReason}</p>
            )}
            <p className="mt-1 text-xs opacity-90">
              Revoked certificates cannot be downloaded, and there is no replacement or reissue capability.
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Certificate Record</CardTitle>
                <CardDescription>Issuance metadata and holder details.</CardDescription>
              </div>
              <StatusBadge status={cert.status} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Certificate Number</dt>
                <dd className="mt-1 font-mono text-xs font-semibold">
                  {cert.certificateNumber || cert.serialNumber || cert._id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Candidate Name</dt>
                <dd className="mt-1 font-medium">
                  {cert.candidateName || cert.holderName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Candidate ID</dt>
                <dd className="mt-1 font-mono text-xs">{cert.candidateId || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Course</dt>
                <dd className="mt-1">{cert.course || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Training Centre</dt>
                <dd className="mt-1">{cert.centreName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Issued At</dt>
                <dd className="mt-1 font-mono text-xs tabular-nums">
                  {formatDateTime(cert.issuedAt || cert.createdAt)}
                </dd>
              </div>
              {cert.revokedAt && (
                <div>
                  <dt className="text-xs text-muted-foreground">Revoked At</dt>
                  <dd className="mt-1 font-mono text-xs tabular-nums text-destructive">
                    {formatDateTime(cert.revokedAt)}
                  </dd>
                </div>
              )}
            </dl>

            {signedLink && (
              <div className="mt-5 rounded-md border border-border bg-muted/40 p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    Signed Candidate Download Link
                    {signedLink.expiresIn ? ` (Expires in ${signedLink.expiresIn})` : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(signedLink.url);
                      toast.success('Copied signed link.');
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <p className="font-mono break-all text-muted-foreground">{signedLink.url}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-accent" />
                <CardTitle>Delivery &amp; Mock WhatsApp Record</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {cert.deliveryStatus && <StatusBadge status={cert.deliveryStatus} />}
                {canRetryDelivery && cert.deliveryStatus === 'failed' && !isRevoked && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retryDeliveryMutation.isPending}
                    onClick={() => retryDeliveryMutation.mutate()}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Retry Delivery
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              Preview the simulated certificate notification and download the certificate below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mockMsgQuery.isLoading ? (
              <LoadingState rows={2} message="Loading mock WhatsApp record..." />
            ) : mockMsgQuery.data ? (
              <MockMessagePreview message={mockMsgQuery.data} revoked={isRevoked} />
            ) : (
              <p className="text-xs text-muted-foreground">
                No mock WhatsApp message has been recorded for this certificate yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke This Certificate?"
        description="Revocation permanently marks this certificate invalid on public verification and disables PDF downloads."
        confirmLabel="Revoke Certificate"
        variant="destructive"
        requireReason
        reasonLabel="Revocation Reason"
        reasonPlaceholder="Enter the reason for revoking this certificate..."
        isLoading={revokeMutation.isPending}
        onConfirm={(reason) => {
          if (reason) revokeMutation.mutate(reason);
        }}
      />
    </AppLayout>
  );
}
