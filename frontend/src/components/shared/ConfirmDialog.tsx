import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Textarea } from '@/src/components/ui/textarea';
import { FormField } from '@/src/components/shared/FormField';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  isLoading?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Provide a clear reason for this decision...',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError(`${reasonLabel} is required before continuing.`);
      return;
    }
    setError(null);
    await onConfirm(requireReason ? reason.trim() : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!isLoading ? onOpenChange(next) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireReason && (
          <div className="mt-4">
            <FormField
              id="confirm-dialog-reason"
              label={reasonLabel}
              required
              error={error}
            >
              <Textarea
                id="confirm-dialog-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error && e.target.value.trim()) setError(null);
                }}
                placeholder={reasonPlaceholder}
                disabled={isLoading}
                rows={3}
              />
            </FormField>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
