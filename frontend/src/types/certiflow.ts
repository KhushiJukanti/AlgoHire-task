export type CanonicalRole =
  | 'training_centre'
  | 'district_officer'
  | 'quality_reviewer'
  | 'state_officer';

export type BatchStatus =
  | 'draft'
  | 'district_review'
  | 'quality_review'
  | 'state_review'
  | 'returned'
  | 'rejected'
  | 'approved';

export type DeliveryStatus =
  | 'pending'
  | 'retrying'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type CertificateStatus = 'valid' | 'revoked';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  district?: string;
  centreId?: string;
  centreName?: string;
}

export interface DemoUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  district?: string;
  centreName?: string;
  description?: string;
}

export interface Centre {
  _id: string;
  name: string;
  code?: string;
  district?: string;
  state?: string;
}

export interface Batch {
  _id: string;
  title: string;
  course: string;
  status: BatchStatus;
  revision: number;
  candidateCount?: number;
  centreId?: string | Centre;
  centre?: Centre;
  centreName?: string;
  district?: string;
  submittedAt?: string;
  deadlineAt?: string;
  deadline?: string;
  stageStartedAt?: string;
  approvedAt?: string;
  returnedAt?: string;
  rejectedAt?: string;
  returnReason?: string;
  rejectReason?: string;
  reason?: string;
  isOverdue?: boolean;
  overdue?: boolean;
  districtApprovals?: number;
  requiredDistrictApprovals?: number;
  requiresQualityReview?: boolean;
  issuanceStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Candidate {
  _id?: string;
  candidateId: string;
  name: string;
  phone: string;
  courseCompletedOn: string;
}

export interface RowValidationError {
  row?: number;
  rowNumber?: number;
  line?: number;
  field?: string;
  column?: string;
  message?: string;
  error?: string;
}

export interface DecisionRecord {
  _id?: string;
  action: 'approve' | 'return' | 'reject' | string;
  stage?: string;
  revision?: number;
  reason?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  officerName?: string;
  decidedAt?: string;
  createdAt?: string;
}

export interface AuditRecord {
  _id?: string;
  event?: string;
  action?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  message?: string;
  details?: Record<string, unknown>;
  createdAt?: string;
  timestamp?: string;
}

export interface RevisionSnapshot {
  _id: string;
  revision: number;
  submittedAt?: string;
  createdAt?: string;
  submittedBy?: string;
  actorName?: string;
  candidateCount?: number;
  title?: string;
  course?: string;
  status?: string;
  candidates?: Candidate[];
}

export interface Certificate {
  _id: string;
  certificateNumber?: string;
  serialNumber?: string;
  batchId?: string;
  candidateId?: string;
  candidateName?: string;
  holderName?: string;
  maskedName?: string;
  phone?: string;
  course?: string;
  centreName?: string;
  status: CertificateStatus;
  issuedAt?: string;
  revokedAt?: string;
  revocationReason?: string;
  revokeReason?: string;
  verificationToken?: string;
  deliveryStatus?: DeliveryStatus;
  createdAt?: string;
}

export interface DeliveryRecord {
  _id: string;
  certificateId?: string;
  certificateNumber?: string;
  batchId?: string;
  candidateId?: string;
  candidateName?: string;
  phone?: string;
  recipient?: string;
  status: DeliveryStatus;
  attempts?: number;
  provider?: string;
  lastError?: string;
  error?: string;
  sentAt?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface MockWhatsAppMessage {
  _id?: string;
  certificateId?: string;
  to?: string;
  phone?: string;
  provider?: string;
  status?: string;
  acceptedAt?: string;
  createdAt?: string;
  body?: string;
  text?: string;
  message?: string;
  downloadUrl?: string;
  payload?: Record<string, unknown>;
}

export interface PublicVerificationResult {
  valid?: boolean;
  status: CertificateStatus | string;
  certificateNumber?: string;
  maskedName?: string;
  maskedHolderName?: string;
  holderName?: string;
  course?: string;
  centreName?: string;
  centre?: string;
  issuedAt?: string;
  revokedAt?: string;
}

export interface StateDashboardData {
  batchesByStatus?: Record<string, number>;
  batchCounts?: Record<string, number>;
  certificatesByStatus?: Record<string, number>;
  certificateCounts?: Record<string, number>;
  unresolvedEscalations?: number;
  unresolvedEscalationCount?: number;
  failedDeliveries?: number;
  failedDeliveryCount?: number;
}

export interface EscalationItem {
  _id: string;
  batchId?: string | { _id: string; title?: string; course?: string; status?: string };
  batchTitle?: string;
  stage?: string;
  reason?: string;
  type?: string;
  resolved?: boolean;
  status?: string;
  deadlineAt?: string;
  createdAt?: string;
  resolvedAt?: string;
}

export interface FailedJobItem {
  _id: string;
  type?: string;
  jobType?: string;
  queue?: string;
  status?: string;
  attempts?: number;
  maxAttempts?: number;
  error?: string;
  errorMessage?: string;
  lastError?: string;
  batchId?: string;
  certificateId?: string;
  failedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StateJobsResponse {
  queues?: Record<string, Record<string, number> | number>;
  stats?: Record<string, unknown>;
  failedJobs?: FailedJobItem[];
  jobs?: FailedJobItem[];
}
