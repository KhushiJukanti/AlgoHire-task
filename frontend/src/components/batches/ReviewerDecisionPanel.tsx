import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, submitBatchDecision } from '@/src/lib/api';
import { useAuth } from '@/src/contexts/AuthContext';
import type { Batch, DecisionRecord } from '@/src/types/certiflow';
import { ConfirmDialog } from '@/src/components/shared/ConfirmDialog';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

type PendingDecision = 'approve' | 'return' | 'reject' | null;

export function ReviewerDecisionPanel({
  batch,
  decisions,
}: {
  batch: Batch;
  decisions: DecisionRecord[];
}) {
  const { user, canonicalRole } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingDecision>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  const canReviewThisStage =
    (canonicalRole === 'district_officer' && batch.status === 'district_review') ||
    (canonicalRole === 'quality_reviewer' && batch.status === 'quality_review') ||
    (canonicalRole === 'state_officer' && batch.status === 'state_review');

  const alreadyApprovedCurrentRevision = decisions.some((d) => {
    if (d.action !== 'approve') return false;
    if (typeof d.revision === 'number' && d.revision !== batch.revision) return false;
    if (d.stage && d.stage !== batch.status) return false;
    if (user?.id && d.actorId && d.actorId === user.id) return true;
    if (user?.email && d.actorEmail && d.actorEmail.toLowerCase() === user.email.toLowerCase()) {
      return true;
    }
    return false;
  });

  const refreshBatchData = () => {
    queryClient.invalidateQueries({ queryKey: ['batch', batch._id] });
    queryClient.invalidateQueries({ queryKey: ['batch-history', batch._id] });
    queryClient.invalidateQueries({ queryKey: ['batch-revisions', batch._id] });
    queryClient.invalidateQueries({ queryKey: ['inbox'] });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
  };

  const decisionMutation = useMutation({
    mutationFn: (args: { action: 'approve' | 'return' | 'reject'; reason?: string }) =>
      submitBatchDecision(batch._id, {
        action: args.action,
        revision: batch.revision,
        reason: args.reason,
      }),
    onSuccess: (_updated, variables) => {
      setPendingAction(null);
      setConflictNotice(null);
      refreshBatchData();
      const verb =
        variables.action === 'approve'
          ? 'approved'
          : variables.action === 'return'
            ? 'returned for correction'
            : 'rejected';
      toast.success(`Batch ${verb} on revision ${batch.revision}.`);
    },
    onError: (err) => {
      setPendingAction(null);
      if (err instanceof ApiError && err.status === 409) {
        setConflictNotice(err.message);
        refreshBatchData();
        toast.error('Batch state or revision changed. Refreshed latest data.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Unable to record decision');
      }
    },
  });

  if (!canReviewThisStage) {
    return null;
  }

  return (
    <Card className="border-indigo-200 dark:border-indigo-900/70">
      <CardHeader>
        <CardTitle>Review Decision — Revision {batch.revision}</CardTitle>
        <CardDescription>
          {canonicalRole === 'district_officer'
            ? 'Two distinct district officers must approve. A single officer may return or reject.'
            : canonicalRole === 'quality_reviewer'
              ? 'Quality review is required because this batch has more than 50 candidates.'
              : 'Final state approval queues asynchronous certificate generation and delivery.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conflictNotice && (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {conflictNotice}
          </div>
        )}

        {alreadyApprovedCurrentRevision && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/60 p-3 text-xs text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              You have already recorded an approval for revision {batch.revision} at this stage. A second distinct officer must provide the remaining approval.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="teal"
            disabled={decisionMutation.isPending || alreadyApprovedCurrentRevision}
            onClick={() => setPendingAction('approve')}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve Batch
          </Button>
          <Button
            variant="outline"
            disabled={decisionMutation.isPending}
            onClick={() => setPendingAction('return')}
          >
            <RotateCcw className="h-4 w-4" />
            Return for Correction
          </Button>
          <Button
            variant="destructive"
            disabled={decisionMutation.isPending}
            onClick={() => setPendingAction('reject')}
          >
            <XCircle className="h-4 w-4" />
            Reject Batch
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={pendingAction === 'approve'}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={`Approve Revision ${batch.revision}?`}
        description={
          canonicalRole === 'state_officer'
            ? 'Final state approval marks this batch approved and queues certificate issuance asynchronously.'
            : 'Confirm your approval for this batch at the current review stage.'
        }
        confirmLabel="Confirm Approval"
        isLoading={decisionMutation.isPending}
        onConfirm={() => decisionMutation.mutate({ action: 'approve' })}
      />

      <ConfirmDialog
        open={pendingAction === 'return'}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={`Return Revision ${batch.revision} for Correction?`}
        description="Returning this batch sends it back to the Training Centre. Resubmitting later will clear previous approvals and create a new revision."
        confirmLabel="Return Batch"
        requireReason
        reasonLabel="Return Reason"
        reasonPlaceholder="Explain what the Training Centre must correct..."
        isLoading={decisionMutation.isPending}
        onConfirm={(reason) => decisionMutation.mutate({ action: 'return', reason })}
      />

      <ConfirmDialog
        open={pendingAction === 'reject'}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={`Reject Revision ${batch.revision}?`}
        description="Rejecting a batch permanently halts certification for this submission."
        confirmLabel="Reject Batch"
        variant="destructive"
        requireReason
        reasonLabel="Rejection Reason"
        reasonPlaceholder="Provide the reason for rejecting this batch..."
        isLoading={decisionMutation.isPending}
        onConfirm={(reason) => decisionMutation.mutate({ action: 'reject', reason })}
      />
    </Card>
  );
}
