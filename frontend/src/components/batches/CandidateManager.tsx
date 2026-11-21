import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiError,
  fetchAllBatchCandidates,
  fetchBatchCandidates,
  importBatchCandidates,
  replaceBatchCandidates,
} from '@/src/lib/api';
import { validateIsoDate, validatePhoneFormat } from '@/src/lib/utils';
import type { Batch, Candidate, RowValidationError } from '@/src/types/certiflow';
import { DataTable, type DataColumn } from '@/src/components/shared/DataTable';
import { ConfirmDialog } from '@/src/components/shared/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PAGE_LIMIT = 100;

export function CandidateManager({
  batch,
  canEdit,
}: {
  batch: Batch;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [page, setPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowValidationError[]>([]);
  const [validateSuccessMsg, setValidateSuccessMsg] = useState<string | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  // Editable JSON roster mode
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [loadingAllForEdit, setLoadingAllForEdit] = useState(false);
  const [draftCandidates, setDraftCandidates] = useState<Candidate[]>([]);
  const [tableValidationError, setTableValidationError] = useState<string | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  const candidatesQuery = useQuery({
    queryKey: ['batch-candidates', batch._id, page],
    queryFn: () => fetchBatchCandidates(batch._id, { page, limit: PAGE_LIMIT }),
  });

  const candidates = candidatesQuery.data?.candidates || [];
  const hasExistingCandidates = (batch.candidateCount ?? 0) > 0 || candidates.length > 0;

  const invalidateRoster = () => {
    queryClient.invalidateQueries({ queryKey: ['batch-candidates', batch._id] });
    queryClient.invalidateQueries({ queryKey: ['batch', batch._id] });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
  };

  const validateMutation = useMutation({
    mutationFn: (file: File) => importBatchCandidates(batch._id, file, { validateOnly: true }),
    onSuccess: (res) => {
      if (res.errors && res.errors.length > 0) {
        setRowErrors(res.errors);
        setValidateSuccessMsg(null);
        toast.error('Spreadsheet validation failed. Fix the listed row errors.');
        return;
      }
      setRowErrors([]);
      const count = res.count ?? res.candidateCount ?? res.candidates?.length;
      setValidateSuccessMsg(
        typeof count === 'number'
          ? `Validation passed for ${count} candidate rows. Ready to import.`
          : 'Spreadsheet validation passed. Ready to import.'
      );
      toast.success('Validation passed');
    },
    onError: (err) => {
      setValidateSuccessMsg(null);
      if (err instanceof ApiError && err.rowErrors.length > 0) {
        setRowErrors(err.rowErrors);
      } else {
        setRowErrors([]);
      }
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    },
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => importBatchCandidates(batch._id, file, { validateOnly: false }),
    onSuccess: () => {
      setConfirmImportOpen(false);
      setRowErrors([]);
      setValidateSuccessMsg(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPage(1);
      invalidateRoster();
      toast.success('Candidate roster imported and saved.');
    },
    onError: (err) => {
      setConfirmImportOpen(false);
      setValidateSuccessMsg(null);
      if (err instanceof ApiError && err.rowErrors.length > 0) {
        setRowErrors(err.rowErrors);
      }
      toast.error(err instanceof Error ? err.message : 'Import failed');
    },
  });

  const saveTableMutation = useMutation({
    mutationFn: (rows: Candidate[]) => replaceBatchCandidates(batch._id, rows),
    onSuccess: () => {
      setConfirmReplaceOpen(false);
      setIsEditingRoster(false);
      setTableValidationError(null);
      setPage(1);
      invalidateRoster();
      toast.success('Candidate roster updated.');
    },
    onError: (err) => {
      setConfirmReplaceOpen(false);
      if (err instanceof ApiError && err.rowErrors.length > 0) {
        setRowErrors(err.rowErrors);
      }
      toast.error(err instanceof Error ? err.message : 'Unable to save candidates');
    },
  });

  const handleDownloadTemplate = () => {
    const csv = [
      'candidateId,name,phone,courseCompletedOn',
      'C001,Asha Rao,+919876543210,2026-01-15',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'certiflow-candidates-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileSelected = (file: File | null) => {
    setRowErrors([]);
    setValidateSuccessMsg(null);
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setFileError('Selected file exceeds the 2 MB upload limit.');
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      setSelectedFile(null);
      setFileError('Only .csv and .xlsx spreadsheets are supported.');
      return;
    }
    setSelectedFile(file);
  };

  const handleStartTableEdit = async () => {
    setLoadingAllForEdit(true);
    setTableValidationError(null);
    setRowErrors([]);
    try {
      // Must load every existing page before editing/saving so a paginated subset never deletes other candidates
      const all = await fetchAllBatchCandidates(batch._id);
      setDraftCandidates(
        all.length > 0
          ? all.map((c) => ({
              candidateId: c.candidateId,
              name: c.name,
              phone: c.phone,
              courseCompletedOn: c.courseCompletedOn ? String(c.courseCompletedOn).slice(0, 10) : '',
            }))
          : [{ candidateId: '', name: '', phone: '', courseCompletedOn: '' }]
      );
      setIsEditingRoster(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load full candidate roster for editing.');
    } finally {
      setLoadingAllForEdit(false);
    }
  };

  const validateDraftTable = (): string | null => {
    if (draftCandidates.length === 0) {
      return 'At least 1 candidate is required (1–500 candidates allowed).';
    }
    if (draftCandidates.length > 500) {
      return 'A batch cannot exceed 500 candidates.';
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < draftCandidates.length; i += 1) {
      const row = draftCandidates[i];
      const rowNum = i + 1;
      if (!row.candidateId.trim()) return `Row ${rowNum}: candidateId is required.`;
      if (seenIds.has(row.candidateId.trim())) {
        return `Row ${rowNum}: duplicate candidateId "${row.candidateId.trim()}".`;
      }
      seenIds.add(row.candidateId.trim());
      if (!row.name.trim()) return `Row ${rowNum}: name is required.`;
      if (!validatePhoneFormat(row.phone)) {
        return `Row ${rowNum}: phone must use international E.164 format (e.g. +919876543210).`;
      }
      if (!validateIsoDate(row.courseCompletedOn)) {
        return `Row ${rowNum}: courseCompletedOn must use YYYY-MM-DD format.`;
      }
    }
    return null;
  };

  const handleRequestSaveTable = () => {
    const err = validateDraftTable();
    if (err) {
      setTableValidationError(err);
      return;
    }
    setTableValidationError(null);
    if (hasExistingCandidates) {
      setConfirmReplaceOpen(true);
    } else {
      saveTableMutation.mutate(draftCandidates);
    }
  };

  const columns: DataColumn<Candidate>[] = [
    {
      key: 'candidateId',
      header: 'Candidate ID',
      render: (c) => <span className="font-mono text-xs font-medium">{c.candidateId}</span>,
    },
    {
      key: 'name',
      header: 'Full Name',
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => <span className="font-mono text-xs">{c.phone}</span>,
    },
    {
      key: 'courseCompletedOn',
      header: 'Completed On',
      align: 'right',
      render: (c) => (
        <span className="font-mono text-xs tabular-nums">
          {c.courseCompletedOn ? String(c.courseCompletedOn).slice(0, 10) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Import Candidate Spreadsheet</CardTitle>
                <CardDescription>
                  Upload a CSV or XLSX file (max 2 MB, 1–500 candidates). Importing replaces the complete roster for this batch.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <p>
                <span className="font-semibold text-foreground">Required headers: </span>
                <code className="font-mono text-foreground">candidateId,name,phone,courseCompletedOn</code>
              </p>
              <p>
                <span className="font-semibold text-foreground">Phone format: </span>
                International format with country code, e.g. <code className="font-mono text-foreground">+919876543210</code>.
              </p>
              <p>
                <span className="font-semibold text-foreground">Completion date: </span>
                Strict <code className="font-mono text-foreground">YYYY-MM-DD</code> format (e.g. <code className="font-mono text-foreground">2026-01-15</code>).
              </p>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Note: A successful import replaces the entire existing candidate roster for this batch. Validation errors reject the whole file with no partial changes.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <label htmlFor="candidate-file-upload" className="sr-only">
                  Select CSV or XLSX file
                </label>
                <Input
                  ref={fileInputRef}
                  id="candidate-file-upload"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                  className="cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  disabled={!selectedFile || validateMutation.isPending || importMutation.isPending}
                  onClick={() => selectedFile && validateMutation.mutate(selectedFile)}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {validateMutation.isPending ? 'Validating...' : 'Validate Only'}
                </Button>
                <Button
                  disabled={!selectedFile || validateMutation.isPending || importMutation.isPending}
                  onClick={() => {
                    if (!selectedFile) return;
                    if (hasExistingCandidates) {
                      setConfirmImportOpen(true);
                    } else {
                      importMutation.mutate(selectedFile);
                    }
                  }}
                >
                  <Upload className="h-4 w-4" />
                  {importMutation.isPending ? 'Importing...' : 'Import & Save'}
                </Button>
              </div>
            </div>

            {fileError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {fileError}
              </p>
            )}

            {validateSuccessMsg && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{validateSuccessMsg}</span>
              </div>
            )}

            {rowErrors.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50/70 p-4 dark:border-red-900/70 dark:bg-red-950/25"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-red-900 dark:text-red-200 mb-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Spreadsheet Validation Errors (No changes saved)</span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded border border-red-200 dark:border-red-900/60 bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rowErrors.map((err, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono tabular-nums">
                            {err.row ?? err.rowNumber ?? err.line ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-mono">{err.field ?? err.column ?? '—'}</td>
                          <td className="px-3 py-2 text-destructive">{err.message ?? err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roster Table / Editable Roster */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Candidate Roster</h3>
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? 'Review imported candidates or edit the complete roster directly.'
                : 'Editing is disabled after batch submission.'}
            </p>
          </div>
          {canEdit && !isEditingRoster && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartTableEdit}
              disabled={loadingAllForEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              {loadingAllForEdit ? 'Loading All Pages...' : 'Edit Roster Table'}
            </Button>
          )}
        </div>

        {isEditingRoster ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Editable Roster ({draftCandidates.length} rows)</CardTitle>
                  <CardDescription>
                    All existing pages were loaded. Saving replaces the entire roster for this batch.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingRoster(false);
                      setTableValidationError(null);
                    }}
                    disabled={saveTableMutation.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draftCandidates.length >= 500 || saveTableMutation.isPending}
                    onClick={() =>
                      setDraftCandidates((prev) => [
                        ...prev,
                        { candidateId: '', name: '', phone: '', courseCompletedOn: '' },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                  </Button>
                  <Button
                    size="sm"
                    disabled={saveTableMutation.isPending}
                    onClick={handleRequestSaveTable}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saveTableMutation.isPending ? 'Saving...' : 'Save Complete Roster'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {tableValidationError && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
                >
                  {tableValidationError}
                </div>
              )}
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">Candidate ID</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone (+91...)</th>
                      <th className="px-3 py-2">Completed On (YYYY-MM-DD)</th>
                      <th className="px-3 py-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {draftCandidates.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label={`Row ${idx + 1} candidate ID`}
                            value={row.candidateId}
                            onChange={(e) => {
                              const next = [...draftCandidates];
                              next[idx] = { ...next[idx], candidateId: e.target.value };
                              setDraftCandidates(next);
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="C001"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label={`Row ${idx + 1} full name`}
                            value={row.name}
                            onChange={(e) => {
                              const next = [...draftCandidates];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setDraftCandidates(next);
                            }}
                            className="h-8 text-xs"
                            placeholder="Asha Rao"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label={`Row ${idx + 1} phone`}
                            value={row.phone}
                            onChange={(e) => {
                              const next = [...draftCandidates];
                              next[idx] = { ...next[idx], phone: e.target.value };
                              setDraftCandidates(next);
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="+919876543210"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            aria-label={`Row ${idx + 1} completion date`}
                            value={row.courseCompletedOn}
                            onChange={(e) => {
                              const next = [...draftCandidates];
                              next[idx] = { ...next[idx], courseCompletedOn: e.target.value };
                              setDraftCandidates(next);
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder="2026-01-15"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove row ${idx + 1}`}
                            disabled={draftCandidates.length <= 1}
                            onClick={() =>
                              setDraftCandidates((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : candidatesQuery.isLoading ? (
          <LoadingState rows={5} message="Loading candidate roster..." />
        ) : candidatesQuery.isError ? (
          <ErrorState
            error={candidatesQuery.error}
            title="Unable to load candidate roster"
            onRetry={() => candidatesQuery.refetch()}
          />
        ) : candidates.length === 0 ? (
          <EmptyState
            title="No candidates added yet"
            description={
              canEdit
                ? 'Import a CSV/XLSX spreadsheet or use Edit Roster Table to add candidates before submitting this batch.'
                : 'No candidates are recorded for this batch.'
            }
          />
        ) : (
          <DataTable
            data={candidates}
            columns={columns}
            getRowKey={(c, i) => c._id || `${c.candidateId}-${i}`}
            page={candidatesQuery.data?.page ?? page}
            limit={PAGE_LIMIT}
            total={candidatesQuery.data?.total}
            onPageChange={setPage}
            isFetching={candidatesQuery.isFetching}
          />
        )}
      </div>

      {/* Confirmations */}
      <ConfirmDialog
        open={confirmImportOpen}
        onOpenChange={setConfirmImportOpen}
        title="Replace Existing Candidate Roster?"
        description="Importing this spreadsheet will replace the entire existing candidate list on this batch. Previous candidate rows will be overwritten."
        confirmLabel="Replace & Import"
        isLoading={importMutation.isPending}
        onConfirm={() => {
          if (selectedFile) importMutation.mutate(selectedFile);
        }}
      />

      <ConfirmDialog
        open={confirmReplaceOpen}
        onOpenChange={setConfirmReplaceOpen}
        title="Save & Replace Candidate Roster?"
        description={`Saving ${draftCandidates.length} candidate(s) will replace the complete existing roster for this batch.`}
        confirmLabel="Save Roster"
        isLoading={saveTableMutation.isPending}
        onConfirm={() => {
          saveTableMutation.mutate(draftCandidates);
        }}
      />
    </div>
  );
}
