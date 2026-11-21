import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Award, Ban, CheckCircle2, Download, FileWarning, WifiOff } from 'lucide-react';
import {
  ApiError,
  downloadCertificateByPublicToken,
  triggerBlobDownload,
} from '@/src/lib/api';
import { extractVerificationToken } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

type DownloadState =
  | { status: 'idle' }
  | { status: 'downloading' }
  | { status: 'success'; filename: string }
  | { status: 'revoked'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'network_error'; message: string };

export function CandidateDownloadPage() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [tokenInput, setTokenInput] = useState(token || '');
  const [state, setState] = useState<DownloadState>({ status: 'idle' });

  const performDownload = useCallback(async (activeToken: string) => {
    setState({ status: 'downloading' });
    try {
      const { blob, filename } = await downloadCertificateByPublicToken(activeToken);
      triggerBlobDownload(blob, filename);
      setState({ status: 'success', filename });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isNetworkError) {
          setState({ status: 'network_error', message: err.message });
          return;
        }
        if (err.status === 410) {
          setState({
            status: 'revoked',
            message: err.message || 'This certificate has been revoked and cannot be downloaded.',
          });
          return;
        }
        if (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404) {
          setState({
            status: 'invalid',
            message: err.message || 'This download link is invalid or has expired.',
          });
          return;
        }
      }
      setState({
        status: 'invalid',
        message: err instanceof Error ? err.message : 'Unable to download certificate PDF.',
      });
    }
  }, []);

  useEffect(() => {
    if (token) {
      setTokenInput(token);
      void performDownload(token);
    }
  }, [token, performDownload]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = extractVerificationToken(tokenInput);
    if (!clean) return;
    if (clean === token) {
      void performDownload(clean);
    } else {
      navigate(`/download/${encodeURIComponent(clean)}`);
    }
  };

  return (
    <div className="login-backdrop min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Award className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            CertiFlow Candidate Download
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Download Your Certificate PDF</CardTitle>
            <CardDescription>
              Use your signed download link to retrieve your official certificate. No login is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token && (
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste signed download token..."
                  className="font-mono text-xs"
                />
                <Button type="submit">Download</Button>
              </form>
            )}

            {state.status === 'downloading' && (
              <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground">
                Retrieving your certificate PDF...
              </div>
            )}

            {state.status === 'success' && (
              <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-sm">
                    <p className="font-semibold">Certificate PDF Ready</p>
                    <p className="mt-0.5 text-xs opacity-90">
                      Download started for <span className="font-mono">{state.filename}</span>.
                    </p>
                  </div>
                </div>
                {token && (
                  <Button variant="outline" size="sm" onClick={() => performDownload(token)}>
                    <Download className="h-4 w-4" />
                    Download Again
                  </Button>
                )}
              </div>
            )}

            {state.status === 'revoked' && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/35 dark:text-red-100"
              >
                <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <p className="font-semibold">Certificate Revoked</p>
                  <p className="mt-1 text-xs">{state.message}</p>
                </div>
              </div>
            )}

            {state.status === 'invalid' && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-semibold">Invalid or Expired Download Link</p>
                  <p className="mt-1 text-xs">{state.message}</p>
                </div>
              </div>
            )}

            {state.status === 'network_error' && (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <div className="flex items-start gap-2.5">
                  <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-semibold">Unable to Connect</p>
                    <p className="mt-1 text-xs">{state.message}</p>
                  </div>
                </div>
                {token && (
                  <Button variant="outline" size="sm" className="self-start bg-card" onClick={() => performDownload(token)}>
                    Retry Download
                  </Button>
                )}
              </div>
            )}

            {token && state.status === 'idle' && (
              <Button onClick={() => performDownload(token)}>
                <Download className="h-4 w-4" />
                Download Certificate PDF
              </Button>
            )}

            <div className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Signed links are time-limited. If your link expired, request a new link from your training centre.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
