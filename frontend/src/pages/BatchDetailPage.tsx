import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Pencil,
  RotateCw,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiError,
  fetchBatchById,
  fetchBatchHistory,
  retryBatchIssuance,
  submitBatch,
  updateBatch,
} from '@/src/lib/api';
import {
  formatDateTime,
  getBatchCentreName,
  getBatchDistrict,
  isBatchOverdue,
} from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { ApprovalStepper } from '@/src/components/shared/ApprovalStepper';
import { ConfirmDialog } from '@/src/components/shared/ConfirmDialog';
import { FormField } from '@/src/components/shared/FormField';
import { StatusBadge } from '@/src/components/shared/StatusBadge';
import { ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { CandidateManager } from '@/src/components/batches/CandidateManager';
import { ReviewerDecisionPanel } from '@/src/components/batches/ReviewerDecisionPanel';
import { BatchHistoryTab } from '@/src/components/batches/BatchHistoryTab';
import { BatchRevisionsTab } from '@/src/components/batches/BatchRevisionsTab';
import { BatchCertificatesTab } from '@/src/components/batches/BatchCertificatesTab';
import { BatchDeliveriesTab } from '@/src/components/batches/BatchDeliveriesTab';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canonicalRole } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaCourse, setMetaCourse] = useState('');
  const [metaError, setMetaError] = useState<string | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const batchQuery = useQuery({
    queryKey: ['batch', id],
    queryFn: () => fetchBatchById(id!),
    enabled: Boolean(id),
  });

  const historyQuery = useQuery({
    queryKey: ['batch-history', id],
    queryFn: () => fetchBatchHistory(id!),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { title: string; course: string }) => updateBatch(id!, payload),
    onSuccess: () => {
      setEditingMeta(false);
      setMetaError(null);
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Batch details updated.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to update batch details');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitBatch(id!),
    onSuccess: () => {
      setConfirmSubmitOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      queryClient.invalidateQueries({ queryKey: ['batch-history', id] });
      queryClient.invalidateQueries({ queryKey: ['batch-revisions', id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      toast.success('Batch submitted for review.');
    },
    onError: (err) => {
      setConfirmSubmitOpen(false);
      toast.error(err instanceof Error ? err.message : 'Unable to submit batch');
    },
  });

  const retryIssuanceMutation = useMutation({
    mutationFn: () => retryBatchIssuance(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] });
      queryClient.invalidateQueries({ queryKey: ['batch-certificates', id] });
      queryClient.invalidateQueries({ queryKey: ['state-jobs'] });
      toast.success('Certificate issuance retry queued.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to retry issuance');
    },
  });

  if (batchQuery.isLoading) {
    return (
      <AppLayout title="Batch Details">
        <LoadingState rows={6} message="Loading batch details..." />
      </AppLayout>
    );
  }

  if (batchQuery.isError || !batchQuery.data) {
    const qualityReviewNotRequired =
      canonicalRole === 'quality_reviewer' &&
      batchQuery.error instanceof ApiError &&
      batchQuery.error.status === 403 &&
      batchQuery.error.message === 'Batch does not require quality review';

    if (qualityReviewNotRequired) {
      return (
        <AppLayout title="Batch Details">
          <Card>
            <CardHeader>
              <CardTitle>No quality review needed for this batch</CardTitle>
              <CardDescription>
                Quality reviewers handle batches with more than 50 candidates. Batches with
                50 or fewer candidates go directly to state review after two district approvals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No action is needed from you for this batch. Open your Review Inbox to see batches
                awaiting your quality review.
              </p>
              <Button asChild>
                <Link to="/inbox">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Review Inbox
                </Link>
              </Button>
            </CardContent>
          </Card>
        </AppLayout>
      );
    }

    return (
      <AppLayout
        title="Batch Details"
        actions={
          <Button variant="outline" asChild>
            <Link to="/batches">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      >
        <ErrorState
          error={batchQuery.error}
          title="Unable to load batch"
          onRetry={() => batchQuery.refetch()}
        />
      </AppLayout>
    );
  }

  const batch = batchQuery.data;
  const decisions = historyQuery.data?.decisions || [];
  const isTrainingCentre = canonicalRole === 'training_centre';
  const isStateOfficer = canonicalRole === 'state_officer';
  const isEditableDraft =
    isTrainingCentre && (batch.status === 'draft' || batch.status === 'returned');
  const candidateCount = batch.candidateCount ?? 0;
  const canSubmit = isEditableDraft && candidateCount > 0;
  const overdue = isBatchOverdue(batch);
  const returnReason =
    batch.returnReason ||
    (batch.status === 'returned' ? batch.reason : undefined) ||
    decisions.find((d) => d.action === 'return' && d.revision === batch.revision)?.reason;
  const rejectReason =
    batch.rejectReason ||
    (batch.status === 'rejected' ? batch.reason : undefined) ||
    decisions.find((d) => d.action === 'reject' && d.revision === batch.revision)?.reason;

  const startEditMeta = () => {
    setMetaTitle(batch.title);
    setMetaCourse(batch.course);
    setMetaError(null);
    setEditingMeta(true);
  };

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaTitle.trim() || !metaCourse.trim()) {
      setMetaError('Both batch title and course are required.');
      return;
    }
    updateMutation.mutate({ title: metaTitle.trim(), course: metaCourse.trim() });
  };

  return (
    <AppLayout
      title={batch.title}
      subtitle={`${batch.course} · Revision ${batch.revision}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={canonicalRole === 'district_officer' || canonicalRole === 'quality_reviewer' ? '/inbox' : '/batches'}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          {isEditableDraft && (
            <Button
              disabled={!canSubmit || submitMutation.isPending}
              title={
                candidateCount === 0
                  ? 'Add at least one candidate before submitting'
                  : 'Submit batch for review'
              }
              onClick={() => setConfirmSubmitOpen(true)}
            >
              <Send className="h-4 w-4" />
              {batch.status === 'returned' ? 'Resubmit Batch' : 'Submit Batch'}
            </Button>
          )}
          {isStateOfficer && batch.status === 'approved' && (
            <Button
              variant="outline"
              disabled={retryIssuanceMutation.isPending}
              onClick={() => retryIssuanceMutation.mutate()}
            >
              <RotateCw className="h-4 w-4" />
              {retryIssuanceMutation.isPending ? 'Queueing...' : 'Retry Issuance'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Prominent Return / Reject Banner */}
        {batch.status === 'returned' && returnReason && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Returned for Correction</p>
              <p>{returnReason}</p>
              {isTrainingCentre && (
                <p className="text-xs opacity-90 pt-1">
                  Correct the batch details or candidate roster, then click Resubmit Batch. Resubmission clears prior approvals and increments the revision number.
                </p>
              )}
            </div>
          </div>
        )}

        {batch.status === 'rejected' && rejectReason && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/35 dark:text-red-100"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">Batch Rejected</p>
              <p>{rejectReason}</p>
            </div>
          </div>
        )}

        {/* Summary Strip */}
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <span className="text-xs text-muted-foreground">Status</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={batch.status} />
              {overdue && <StatusBadge status="overdue" />}
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Revision</span>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              Rev {batch.revision}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Candidates</span>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              {candidateCount}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Centre / District</span>
            <p className="mt-1 text-sm font-medium truncate">
              {getBatchCentreName(batch)}
            </p>
            {getBatchDistrict(batch) !== '—' && (
              <p className="text-xs text-muted-foreground truncate">
                {getBatchDistrict(batch)}
              </p>
            )}
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Submitted / Stage Date</span>
            <p className="mt-1 font-mono text-xs tabular-nums">
              {formatDateTime(batch.submittedAt || batch.stageStartedAt || batch.createdAt)}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Stage Deadline</span>
            <p className={`mt-1 font-mono text-xs tabular-nums ${overdue ? 'font-semibold text-destructive' : ''}`}>
              {formatDateTime(batch.deadlineAt || batch.deadline)}
            </p>
          </div>
        </div>

        {/* Approval Progress Stepper */}
        <ApprovalStepper
          status={batch.status}
          candidateCount={candidateCount}
          requiresQualityReview={batch.requiresQualityReview}
          districtApprovals={batch.districtApprovals}
          requiredDistrictApprovals={batch.requiredDistrictApprovals}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="candidates">
              Candidates ({candidateCount})
            </TabsTrigger>
            <TabsTrigger value="history">Decisions &amp; Audit</TabsTrigger>
            <TabsTrigger value="revisions">Submitted Revisions</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="deliveries">Delivery Status</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <ReviewerDecisionPanel batch={batch} decisions={decisions} />

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Batch Information</CardTitle>
                    <CardDescription>
                      Core cohort metadata and stage timestamps.
                    </CardDescription>
                  </div>
                  {isEditableDraft && !editingMeta && (
                    <Button variant="outline" size="sm" onClick={startEditMeta}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Details
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editingMeta ? (
                  <form onSubmit={handleSaveMeta} className="max-w-xl space-y-4">
                    <FormField id="edit-batch-title" label="Batch Title" required>
                      <Input
                        id="edit-batch-title"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        disabled={updateMutation.isPending}
                      />
                    </FormField>
                    <FormField id="edit-batch-course" label="Course" required>
                      <Input
                        id="edit-batch-course"
                        value={metaCourse}
                        onChange={(e) => setMetaCourse(e.target.value)}
                        disabled={updateMutation.isPending}
                      />
                    </FormField>
                    {metaError && (
                      <p role="alert" className="text-xs font-medium text-destructive">
                        {metaError}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => setEditingMeta(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">Batch ID</dt>
                      <dd className="mt-1 font-mono text-xs">{batch._id}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Title</dt>
                      <dd className="mt-1 font-medium">{batch.title}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Course</dt>
                      <dd className="mt-1 font-medium">{batch.course}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Created At</dt>
                      <dd className="mt-1 font-mono text-xs tabular-nums">
                        {formatDateTime(batch.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Last Updated</dt>
                      <dd className="mt-1 font-mono text-xs tabular-nums">
                        {formatDateTime(batch.updatedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Approved At</dt>
                      <dd className="mt-1 font-mono text-xs tabular-nums">
                        {formatDateTime(batch.approvedAt)}
                      </dd>
                    </div>
                  </dl>
                )}

                {isEditableDraft && candidateCount === 0 && (
                  <div className="mt-5 rounded-md border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground">
                    This batch currently has 0 candidates. Switch to the{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('candidates')}
                      className="font-semibold text-primary underline cursor-pointer"
                    >
                      Candidates tab
                    </button>{' '}
                    to upload a spreadsheet or enter candidates before submitting.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidates">
            <CandidateManager batch={batch} canEdit={isEditableDraft} />
          </TabsContent>

          <TabsContent value="history">
            <BatchHistoryTab batchId={batch._id} />
          </TabsContent>

          <TabsContent value="revisions">
            <BatchRevisionsTab batchId={batch._id} />
          </TabsContent>

          <TabsContent value="certificates">
            <BatchCertificatesTab batch={batch} />
          </TabsContent>

          <TabsContent value="deliveries">
            <BatchDeliveriesTab batch={batch} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={confirmSubmitOpen}
        onOpenChange={setConfirmSubmitOpen}
        title={batch.status === 'returned' ? 'Resubmit Corrected Batch?' : 'Submit Batch for Review?'}
        description={
          batch.status === 'returned'
            ? `Resubmitting "${batch.title}" clears all previous approvals, creates a new revision, and locks candidate editing during review.`
            : `Submitting "${batch.title}" (${candidateCount} candidates) locks candidate editing and routes the batch to District Review.`
        }
        confirmLabel={batch.status === 'returned' ? 'Resubmit Batch' : 'Submit Batch'}
        isLoading={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
      />
    </AppLayout>
  );
}
