import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  Hourglass,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

type BadgeTone = 'neutral' | 'indigo' | 'teal' | 'amber' | 'green' | 'red';

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  // Batch workflow statuses
  draft: { label: 'Draft', tone: 'neutral', Icon: FileEdit },
  district_review: { label: 'District Review', tone: 'indigo', Icon: Clock },
  quality_review: { label: 'Quality Review', tone: 'indigo', Icon: ShieldCheck },
  state_review: { label: 'State Review', tone: 'teal', Icon: Hourglass },
  returned: { label: 'Returned', tone: 'amber', Icon: RotateCcw },
  rejected: { label: 'Rejected', tone: 'red', Icon: XCircle },
  approved: { label: 'Approved', tone: 'green', Icon: CheckCircle2 },

  // Delivery statuses
  pending: { label: 'Pending', tone: 'neutral', Icon: Hourglass },
  retrying: { label: 'Retrying', tone: 'amber', Icon: RotateCcw },
  sent: { label: 'Sent', tone: 'green', Icon: Send },
  failed: { label: 'Failed', tone: 'red', Icon: AlertTriangle },
  cancelled: { label: 'Cancelled', tone: 'neutral', Icon: Ban },

  // Certificate statuses
  valid: { label: 'Valid', tone: 'green', Icon: CheckCircle2 },
  revoked: { label: 'Revoked', tone: 'red', Icon: Ban },

  // Escalations & indicators
  overdue: { label: 'Overdue', tone: 'red', Icon: AlertTriangle },
  resolved: { label: 'Resolved', tone: 'green', Icon: CheckCircle2 },
  unresolved: { label: 'Unresolved', tone: 'amber', Icon: AlertTriangle },
  open: { label: 'Open', tone: 'amber', Icon: AlertTriangle },
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
  indigo:
    'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800/80 dark:bg-indigo-950/70 dark:text-indigo-200',
  teal:
    'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800/80 dark:bg-teal-950/70 dark:text-teal-200',
  amber:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/70 dark:text-amber-200',
  green:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/80 dark:bg-emerald-950/70 dark:text-emerald-200',
  red:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-800/80 dark:bg-red-950/70 dark:text-red-200',
};

export function StatusBadge({
  status,
  labelOverride,
  className,
}: {
  status?: string | null;
  labelOverride?: string;
  className?: string;
}) {
  const key = (status || '').toLowerCase().trim();
  const meta = STATUS_MAP[key] || {
    label: key ? key.replace(/_/g, ' ') : 'Unknown',
    tone: 'neutral' as BadgeTone,
    Icon: Clock,
  };
  const Icon = meta.Icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 capitalize',
        TONE_CLASSES[meta.tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden={true} />
      <span>{labelOverride || meta.label}</span>
    </span>
  );
}
