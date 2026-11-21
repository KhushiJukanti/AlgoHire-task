import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Batch, CanonicalRole } from '@/src/types/certiflow';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeRole(role?: string | null): CanonicalRole | null {
  if (!role) return null;
  const r = role.toLowerCase().trim();
  if (r.includes('centre') || r.includes('center') || r === 'tc') {
    return 'training_centre';
  }
  if (r.includes('district')) {
    return 'district_officer';
  }
  if (r.includes('quality')) {
    return 'quality_reviewer';
  }
  if (r.includes('state')) {
    return 'state_officer';
  }
  return null;
}

export function formatRoleLabel(role?: string | null): string {
  const canonical = normalizeRole(role);
  switch (canonical) {
    case 'training_centre':
      return 'Training Centre';
    case 'district_officer':
      return 'District Officer';
    case 'quality_reviewer':
      return 'Quality Reviewer';
    case 'state_officer':
      return 'State Officer';
    default:
      return role ? role.replace(/_/g, ' ') : 'User';
  }
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isBatchOverdue(batch: Pick<Batch, 'isOverdue' | 'overdue' | 'deadlineAt' | 'deadline' | 'status'>): boolean {
  if (typeof batch.isOverdue === 'boolean') return batch.isOverdue;
  if (typeof batch.overdue === 'boolean') return batch.overdue;
  if (batch.status === 'approved' || batch.status === 'rejected' || batch.status === 'draft') {
    return false;
  }
  const deadline = batch.deadlineAt || batch.deadline;
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

export function getBatchCentreName(batch: Batch): string {
  if (batch.centreName) return batch.centreName;
  if (batch.centre?.name) return batch.centre.name;
  if (typeof batch.centreId === 'object' && batch.centreId !== null) {
    return batch.centreId.name;
  }
  return '—';
}

export function getBatchDistrict(batch: Batch): string {
  if (batch.district) return batch.district;
  if (batch.centre?.district) return batch.centre.district;
  if (typeof batch.centreId === 'object' && batch.centreId !== null && batch.centreId.district) {
    return batch.centreId.district;
  }
  return '—';
}

/**
 * Safely extracts only the token segment from a verification token or pasted URL.
 * Never returns or fetches an arbitrary external URL.
 */
export function extractVerificationToken(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : '';
    } catch {
      return '';
    }
  }

  // Handle relative paths like /verify/abc123 or verify/abc123
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/').filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : '';
  }

  return trimmed;
}

export function getDefaultHomePath(role?: string | null): string {
  const canonical = normalizeRole(role);
  if (canonical === 'district_officer' || canonical === 'quality_reviewer') {
    return '/inbox';
  }
  return '/dashboard';
}

export function validatePhoneFormat(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

export function validateIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
  const d = new Date(`${dateStr.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === dateStr.trim();
}
