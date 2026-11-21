import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Ban,
  CheckCircle2,
  HelpCircle,
  
  Search,
  
  WifiOff,
} from 'lucide-react';
import { ApiError, verifyCertificateToken } from '@/src/lib/api';
import { extractVerificationToken, formatDate } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { FormField } from '@/src/components/shared/FormField';
import { LoadingState } from '@/src/components/shared/StateViews';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

export function VerifyPage() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [inputVal, setInputVal] = useState(token || '');
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      setInputVal(token);
    }
  }, [token]);

  // Always fetch fresh verification status whenever the page opens; do not persist stale results
  const verifyQuery = useQuery({
    queryKey: ['public-verify', token],
    queryFn: () => verifyCertificateToken(token!),
    enabled: Boolean(token),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractVerificationToken(inputVal);
    if (!extracted) {
      setInputError('Paste a valid verification token or verification URL.');
      return;
    }
    setInputError(null);
    if (extracted === token) {
      verifyQuery.refetch();
    } else {
      navigate(`/verify/${encodeURIComponent(extracted)}`);
    }
  };

  const renderResult = () => {
    if (!token) return null;

    if (verifyQuery.isFetching) {
      return <LoadingState rows={3} message="Checking live certificate registry..." />;
    }

    if (verifyQuery.isError) {
      const err = verifyQuery.error;
      const apiErr = err instanceof ApiError ? err : null;

      if (apiErr?.status === 404) {
        return (
          <Card className="border-slate-300 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Certificate Not Found
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No certificate matches the verification token{' '}
                    <span className="font-mono text-foreground">{token}</span>. Check the token and try again.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      }

      // Network/server failure: NEVER show "fake" or "invalid" merely because the network failed
      return (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <WifiOff className="mt-0.5 h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Unable to verify right now
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We could not reach the verification service to confirm this certificate. This does not mean the certificate is invalid—please retry shortly.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => verifyQuery.refetch()}>
                Retry Verification
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const result = verifyQuery.data;
    if (!result) return null;

    const isRevoked =
      result.status?.toLowerCase() === 'revoked' || Boolean(result.revokedAt);

    return (
      <Card
        className={
          isRevoked
            ? 'border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/25'
            : 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/25'
        }
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            {isRevoked ? (
              <Ban className="mt-0.5 h-7 w-7 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <div>
              <CardTitle className="text-xl">
                {isRevoked ? 'Certificate Revoked (Invalid)' : 'Valid Certificate Verified'}
              </CardTitle>
              <CardDescription>
                {isRevoked
                  ? 'This skilling certificate has been officially revoked and is no longer valid.'
                  : 'Confirmed against the live CertiFlow public registry.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Display ONLY public fields returned by the backend */}
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Certificate Number</dt>
              <dd className="mt-1 break-all font-mono text-sm font-semibold">
                {result.certificateNumber || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Masked Holder Name</dt>
              <dd className="mt-1 font-medium">
                {result.maskedHolderName || result.maskedName || result.holderName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Course</dt>
              <dd className="mt-1 font-medium">{result.course || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Training Centre</dt>
              <dd className="mt-1">{result.centreName || result.centre || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Issued Date</dt>
              <dd className="mt-1 font-mono text-xs tabular-nums">
                {formatDate(result.issuedAt)}
              </dd>
            </div>
            {result.revokedAt && (
              <div>
                <dt className="text-xs text-muted-foreground">Revocation Date</dt>
                <dd className="mt-1 font-mono text-xs font-semibold text-destructive tabular-nums">
                  {formatDate(result.revokedAt)}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="login-backdrop min-h-screen flex flex-col justify-between">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/85 backdrop-blur-xs">
        <Link to="/verify" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Award className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            CertiFlow Verification
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              {isAuthenticated ? 'Back to Workspace' : 'Staff Sign In'}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl text-balance">
            Public Certificate Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a verification token or full verification URL to check real-time certificate validity.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                id="verify-token-input"
                label="Verification Token or URL"
                helperText="Only the token path segment is extracted and checked against the CertiFlow backend."
                error={inputError}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="verify-token-input"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Paste verification token or https://.../verify/..."
                    className="font-mono text-xs"
                  />
                  <Button type="submit" className="shrink-0">
                    <Search className="h-4 w-4" />
                    Verify
                  </Button>
                </div>
              </FormField>
            </form>
          </CardContent>
        </Card>

        {renderResult()}
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        CertiFlow Public Registry · Real-time verification
      </footer>
    </div>
  );
}
