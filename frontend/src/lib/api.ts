import type {
  AuditRecord,
  Batch,
  Candidate,
  Centre,
  Certificate,
  DecisionRecord,
  DeliveryRecord,
  DemoUser,
  EscalationItem,
  MockWhatsAppMessage,
  PublicVerificationResult,
  RevisionSnapshot,
  RowValidationError,
  StateDashboardData,
  StateJobsResponse,
  User,
} from '@/src/types/certiflow';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:7000'
  // import.meta.env.VITE_API_BASE_URL || 'http://172.29.160.1:7000'
).replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'certiflow_token';
const USER_STORAGE_KEY = 'certiflow_user';

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: User): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  isNetworkError: boolean;
  rowErrors: RowValidationError[];

  constructor(
    message: string,
    status: number,
    options?: {
      details?: unknown;
      isNetworkError?: boolean;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = options?.details;
    this.isNetworkError = Boolean(options?.isNetworkError);
    this.rowErrors = extractRowErrors(options?.details);
  }
}

function extractRowErrors(details: unknown): RowValidationError[] {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        row: typeof item.row === 'number' ? item.row : typeof item.rowNumber === 'number' ? item.rowNumber : typeof item.line === 'number' ? item.line : undefined,
        field: typeof item.field === 'string' ? item.field : typeof item.column === 'string' ? item.column : undefined,
        message:
          typeof item.error === 'string'
            ? item.error
            : typeof item.message === 'string'
              ? item.message
              : JSON.stringify(item),
      }));
  }
  if (typeof details === 'object' && details !== null) {
    const obj = details as Record<string, unknown>;
    if (Array.isArray(obj.errors)) return extractRowErrors(obj.errors);
    if (Array.isArray(obj.rowErrors)) return extractRowErrors(obj.rowErrors);
    if (Array.isArray(obj.rows)) return extractRowErrors(obj.rows);
  }
  return [];
}

let onUnauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): () => void {
  onUnauthorizedHandler = handler;
  return () => {
    if (onUnauthorizedHandler === handler) {
      onUnauthorizedHandler = null;
    }
  };
}

function mapStatusMessage(status: number, fallback: string): string {
  switch (status) {
    case 401:
      return fallback || 'Your session has expired. Please sign in again.';
    case 403:
      return fallback || 'You do not have permission to perform this action at the current stage.';
    case 409:
      return fallback || 'This record was modified or its stage changed. Data has been refreshed.';
    case 410:
      return fallback || 'This certificate has been revoked or the download link is no longer available.';
    case 413:
      return fallback || 'The uploaded file exceeds the 2 MB size limit.';
    case 422:
      return fallback || 'Validation failed. Please review the highlighted fields or rows.';
    case 503:
      return fallback || 'The service or background queue is temporarily unavailable. Please try again shortly.';
    default:
      return fallback || `Request failed with status ${status}.`;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  skipUnauthorizedRedirect?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, skipUnauthorizedRedirect = false, body, headers: customHeaders, ...rest } = options;

  const headers = new Headers(customHeaders);
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let finalBody: BodyInit | undefined;
  if (body instanceof FormData) {
    // Let the browser set multipart Content-Type with boundary
    finalBody = body;
  } else if (body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    finalBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers,
      body: finalBody,
    });
  } catch {
    throw new ApiError(
      `Unable to connect to the CertiFlow backend at ${API_BASE_URL}. Confirm the backend server is running.`,
      0,
      { isNetworkError: true }
    );
  }

  const contentType = response.headers.get('content-type') || '';
  let parsed: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { error: text };
        }
      }
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errObj = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>;
    const serverMsg =
      (typeof errObj.error === 'string' && errObj.error) ||
      (typeof errObj.message === 'string' && errObj.message) ||
      '';
    const message = mapStatusMessage(response.status, serverMsg);

    if (response.status === 401 && !skipUnauthorizedRedirect && onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }

    throw new ApiError(message, response.status, {
      details: errObj.details ?? errObj.errors ?? errObj,
    });
  }

  return parsed as T;
}

async function requestBlob(
  path: string,
  options: { auth?: boolean } = {}
): Promise<{ blob: Blob; filename: string }> {
  const { auth = true } = options;
  const headers = new Headers();
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers });
  } catch {
    throw new ApiError(
      `Unable to connect to the CertiFlow backend at ${API_BASE_URL}.`,
      0,
      { isNetworkError: true }
    );
  }

  if (!response.ok) {
    let serverMsg = '';
    let details: unknown;
    try {
      const data = (await response.json()) as Record<string, unknown>;
      serverMsg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        '';
      details = data.details;
    } catch {
      // ignore non-json error body
    }

    if (response.status === 401 && auth && onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }

    throw new ApiError(mapStatusMessage(response.status, serverMsg), response.status, {
      details,
    });
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i.exec(disposition);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : 'certificate.pdf';
  const blob = await response.blob();
  return { blob, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// Health
export async function checkHealth(): Promise<{ ok: boolean; status?: string }> {
  return request<{ ok: boolean; status?: string }>('/health', { auth: false });
}

// Auth
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  return request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    auth: false,
    skipUnauthorizedRedirect: true,
    body: { email, password },
  });
}

export async function fetchDemoUsers(): Promise<DemoUser[]> {
  const data = await request<DemoUser[] | { users?: DemoUser[]; demoUsers?: DemoUser[] }>(
    '/api/auth/demo-users',
    { auth: false, skipUnauthorizedRedirect: true }
  );
  if (Array.isArray(data)) return data;
  return data?.users || data?.demoUsers || [];
}

export async function demoLogin(email: string): Promise<{ token: string; user: User }> {
  return request<{ token: string; user: User }>('/api/auth/demo-login', {
    method: 'POST',
    auth: false,
    skipUnauthorizedRedirect: true,
    body: { email },
  });
}

export async function fetchCurrentUser(): Promise<User> {
  const data = await request<User | { user: User }>('/api/auth/me');
  if ('user' in data && data.user) return data.user;
  return data as User;
}

// Centres
export async function fetchCentres(): Promise<Centre[]> {
  const data = await request<Centre[] | { centres: Centre[] }>('/api/centres');
  if (Array.isArray(data)) return data;
  return data?.centres || [];
}

// Batches
export async function fetchBatches(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ batches: Batch[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  if (params.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  return request<{ batches: Batch[]; page: number; total?: number }>(
    `/api/batches?${query.toString()}`
  );
}

export async function fetchReviewInbox(params: {
  page?: number;
  limit?: number;
}): Promise<{ batches: Batch[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  return request<{ batches: Batch[]; page: number; total?: number }>(
    `/api/batches/inbox?${query.toString()}`
  );
}

export async function fetchBatchById(id: string): Promise<Batch> {
  const data = await request<{ batch: Batch } | Batch>(`/api/batches/${id}`);
  if ('batch' in data && data.batch) return data.batch;
  return data as Batch;
}

export async function createBatch(payload: {
  title: string;
  course: string;
}): Promise<Batch> {
  const data = await request<{ batch: Batch } | Batch>('/api/batches', {
    method: 'POST',
    body: payload,
  });
  if ('batch' in data && data.batch) return data.batch;
  return data as Batch;
}

export async function updateBatch(
  id: string,
  payload: { title: string; course: string }
): Promise<Batch> {
  const data = await request<{ batch: Batch } | Batch>(`/api/batches/${id}`, {
    method: 'PATCH',
    body: payload,
  });
  if ('batch' in data && data.batch) return data.batch;
  return data as Batch;
}

// Candidates
export async function fetchBatchCandidates(
  batchId: string,
  params: { page?: number; limit?: number } = {}
): Promise<{ candidates: Candidate[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 100));
  return request<{ candidates: Candidate[]; page: number; total?: number }>(
    `/api/batches/${batchId}/candidates?${query.toString()}`
  );
}

export async function fetchAllBatchCandidates(batchId: string): Promise<Candidate[]> {
  const limit = 100;
  let page = 1;
  const all: Candidate[] = [];
  // Load every page sequentially so editing/saving never truncates existing candidates
  while (true) {
    const res = await fetchBatchCandidates(batchId, { page, limit });
    const rows = res.candidates || [];
    all.push(...rows);
    if (rows.length < limit) break;
    if (typeof res.total === 'number' && all.length >= res.total) break;
    page += 1;
    if (page > 50) break; // safety guard for 500-candidate max
  }
  return all;
}

export async function replaceBatchCandidates(
  batchId: string,
  candidates: Candidate[]
): Promise<{ candidates?: Candidate[]; batch?: Batch; count?: number }> {
  return request(`/api/batches/${batchId}/candidates`, {
    method: 'PUT',
    body: {
      candidates: candidates.map((c) => ({
        candidateId: c.candidateId.trim(),
        name: c.name.trim(),
        phone: c.phone.trim(),
        courseCompletedOn: c.courseCompletedOn.trim(),
      })),
    },
  });
}

export async function importBatchCandidates(
  batchId: string,
  file: File,
  options: { validateOnly?: boolean } = {}
): Promise<{
  valid?: boolean;
  count?: number;
  candidateCount?: number;
  candidates?: Candidate[];
  message?: string;
  errors?: RowValidationError[];
}> {
  const formData = new FormData();
  formData.append('file', file);
  const qs = options.validateOnly ? '?validateOnly=true' : '';
  return request(`/api/batches/${batchId}/candidates/import${qs}`, {
    method: 'POST',
    body: formData,
  });
}

// Workflow
export async function submitBatch(batchId: string): Promise<Batch> {
  const data = await request<{ batch: Batch } | Batch>(
    `/api/batches/${batchId}/submit`,
    { method: 'POST' }
  );
  if ('batch' in data && data.batch) return data.batch;
  return data as Batch;
}

export async function submitBatchDecision(
  batchId: string,
  payload: {
    action: 'approve' | 'return' | 'reject';
    revision: number;
    reason?: string;
  }
): Promise<Batch> {
  const body: Record<string, unknown> = {
    action: payload.action,
    revision: payload.revision,
  };
  if (payload.reason && payload.reason.trim()) {
    body.reason = payload.reason.trim();
  }
  const data = await request<{ batch: Batch } | Batch>(
    `/api/batches/${batchId}/decisions`,
    {
      method: 'POST',
      body,
    }
  );
  if ('batch' in data && data.batch) return data.batch;
  return data as Batch;
}

// History & Revisions
export async function fetchBatchHistory(
  batchId: string
): Promise<{ decisions: DecisionRecord[]; audit: AuditRecord[] }> {
  const data = await request<{ decisions?: DecisionRecord[]; audit?: AuditRecord[] }>(
    `/api/batches/${batchId}/history`
  );
  return {
    decisions: data.decisions || [],
    audit: data.audit || [],
  };
}

export async function fetchBatchRevisions(
  batchId: string,
  params: { page?: number; limit?: number } = {}
): Promise<{ revisions: RevisionSnapshot[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  return request<{ revisions: RevisionSnapshot[]; page: number; total?: number }>(
    `/api/batches/${batchId}/revisions?${query.toString()}`
  );
}

// Certificates & Deliveries
export async function fetchBatchCertificates(
  batchId: string,
  params: { page?: number; limit?: number } = {}
): Promise<{ certificates: Certificate[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  return request<{ certificates: Certificate[]; page: number; total?: number }>(
    `/api/batches/${batchId}/certificates?${query.toString()}`
  );
}

export async function fetchBatchDeliveries(
  batchId: string,
  params: { page?: number; limit?: number } = {}
): Promise<{ deliveries: DeliveryRecord[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  return request<{ deliveries: DeliveryRecord[]; page: number; total?: number }>(
    `/api/batches/${batchId}/deliveries?${query.toString()}`
  );
}

export async function fetchCertificateById(id: string): Promise<Certificate> {
  const data = await request<{ certificate: Certificate } | Certificate>(
    `/api/certificates/${id}`
  );
  if ('certificate' in data && data.certificate) return data.certificate;
  return data as Certificate;
}

export async function downloadCertificatePdfAuthenticated(
  id: string
): Promise<{ blob: Blob; filename: string }> {
  return requestBlob(`/api/certificates/${id}/pdf`, { auth: true });
}

export async function createSignedDownloadLink(
  id: string
): Promise<{ url: string; expiresIn?: number | string; token?: string }> {
  return request<{ url: string; expiresIn?: number | string; token?: string }>(
    `/api/certificates/${id}/download-link`,
    { method: 'POST' }
  );
}

export async function revokeCertificate(
  id: string,
  reason: string
): Promise<Certificate> {
  const data = await request<{ certificate: Certificate } | Certificate>(
    `/api/certificates/${id}/revoke`,
    {
      method: 'POST',
      body: { reason: reason.trim() },
    }
  );
  if ('certificate' in data && data.certificate) return data.certificate;
  return data as Certificate;
}

export async function retryCertificateDelivery(id: string): Promise<unknown> {
  return request(`/api/certificates/${id}/retry-delivery`, { method: 'POST' });
}

export async function fetchMockWhatsAppMessage(
  id: string
): Promise<MockWhatsAppMessage | null> {
  const data = await request<{ message: MockWhatsAppMessage | null } | MockWhatsAppMessage>(
    `/api/certificates/${id}/mock-message`
  );
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'object') {
    return data.message as MockWhatsAppMessage;
  }
  return data as MockWhatsAppMessage;
}

// Public endpoints
export async function verifyCertificateToken(
  token: string
): Promise<PublicVerificationResult> {
  const result = await request<PublicVerificationResult & { number?: string }>(
    `/api/verify/${encodeURIComponent(token)}`,
    { auth: false, skipUnauthorizedRedirect: true }
  );
  // The public API calls this field `number`; the UI uses `certificateNumber`.
  return { ...result, certificateNumber: result.number || result.certificateNumber };
}

export async function downloadCertificateByPublicToken(
  token: string
): Promise<{ blob: Blob; filename: string }> {
  return requestBlob(
    `/api/certificates/download/${encodeURIComponent(token)}`,
    { auth: false }
  );
}

// State Officer endpoints
export async function fetchStateDashboard(): Promise<StateDashboardData> {
  return request<StateDashboardData>('/api/state/dashboard');
}

export async function fetchStateEscalations(params: {
  page?: number;
  limit?: number;
  includeResolved?: boolean;
}): Promise<{ escalations: EscalationItem[]; page: number; total?: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 20));
  if (params.includeResolved) {
    query.set('includeResolved', 'true');
  }
  return request<{ escalations: EscalationItem[]; page: number; total?: number }>(
    `/api/state/escalations?${query.toString()}`
  );
}

export async function fetchStateJobs(): Promise<StateJobsResponse> {
  return request<StateJobsResponse>('/api/state/jobs');
}

export async function retryBatchIssuance(batchId: string): Promise<unknown> {
  return request(`/api/state/batches/${batchId}/retry-issuance`, {
    method: 'POST',
  });
}
