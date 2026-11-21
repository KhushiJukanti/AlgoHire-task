import * as React from 'react';
import { Label } from '@/src/components/ui/label';
import { cn } from '@/src/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required,
  helperText,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="flex items-center gap-1 text-sm font-medium text-foreground">
        <span>{label}</span>
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
