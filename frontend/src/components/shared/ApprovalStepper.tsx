import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { BatchStatus } from '@/src/types/certiflow';

interface ApprovalStepperProps {
  status: BatchStatus | string;
  candidateCount?: number;
  requiresQualityReview?: boolean;
  districtApprovals?: number;
  requiredDistrictApprovals?: number;
}

export function ApprovalStepper({
  status,
  candidateCount = 0,
  requiresQualityReview,
  districtApprovals,
  requiredDistrictApprovals = 2,
}: ApprovalStepperProps) {
  const needsQuality =
    typeof requiresQualityReview === 'boolean'
      ? requiresQualityReview
      : candidateCount > 50 || status === 'quality_review';

  const steps = [
    { key: 'draft', label: 'Draft & Roster', subtitle: 'Training Centre' },
    {
      key: 'district_review',
      label: 'District Review',
      subtitle:
        typeof districtApprovals === 'number'
          ? `${districtApprovals}/${requiredDistrictApprovals} approvals`
          : '2 officer approvals',
    },
    ...(needsQuality
      ? [
          {
            key: 'quality_review',
            label: 'Quality Review',
            subtitle: 'Batches > 50 candidates',
          },
        ]
      : []),
    { key: 'state_review', label: 'State Review', subtitle: 'Final sign-off' },
    { key: 'approved', label: 'Approved', subtitle: 'Issuance queued' },
  ];

  const orderMap: Record<string, number> = {};
  steps.forEach((s, idx) => {
    orderMap[s.key] = idx;
  });

  const isReturned = status === 'returned';
  const isRejected = status === 'rejected';
  const currentIndex =
    isReturned || isRejected ? -1 : (orderMap[status] ?? 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">Approval Progress</h2>
        <span className="text-xs text-muted-foreground">
          {needsQuality
            ? 'Quality review required (> 50 candidates)'
            : 'Standard route (<= 50 candidates)'}
        </span>
      </div>

      {isReturned && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>Returned to Training Centre for correction. Resubmission creates a new revision.</span>
        </div>
      )}

      {isRejected && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <X className="h-4 w-4 shrink-0" />
          <span>This batch was rejected and cannot be advanced further.</span>
        </div>
      )}

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => {
          const isCompleted =
            status === 'approved' ? true : currentIndex > index;
          const isCurrent =
            status !== 'approved' && currentIndex === index;

          return (
            <li
              key={step.key}
              className={cn(
                'flex items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
                isCompleted &&
                  'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/25',
                isCurrent &&
                  'border-primary/50 bg-indigo-50/60 dark:border-indigo-700 dark:bg-indigo-950/35',
                !isCompleted &&
                  !isCurrent &&
                  'border-border bg-muted/30 text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  isCompleted && 'bg-emerald-600 text-white dark:bg-emerald-500',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground border border-border'
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight">
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {step.subtitle}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
