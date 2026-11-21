import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award, LogIn, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { checkHealth } from '@/src/lib/api';
import { getDefaultHomePath } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { BackendStatusBanner } from '@/src/components/shared/StateViews';
import { FormField } from '@/src/components/shared/FormField';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

export function LoginPage() {
  const {
    isAuthenticated,
    user,
    login,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : getDefaultHomePath(user.role), {
        replace: true,
      });
    }
  }, [isAuthenticated, user, navigate, location.state]);

  const healthQuery = useQuery({
    queryKey: ['login-health'],
    queryFn: checkHealth,
    retry: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearSessionExpiredMessage();

    if (!email.trim()) {
      setFormError('Email address is required.');
      return;
    }
    if (!password) {
      setFormError('Password is required.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    try {
      const signedInUser = await login(email.trim(), password);
      toast.success(`Signed in as ${signedInUser.name}`);
      navigate(getDefaultHomePath(signedInUser.role), { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-backdrop min-h-screen flex flex-col justify-between">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Award className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            CertiFlow
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/verify">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Verify Certificate
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <BackendStatusBanner
          reachable={!healthQuery.isError}
          onRetry={() => {
            healthQuery.refetch();
          }}
        />

        {sessionExpiredMessage && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            {sessionExpiredMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-semibold tracking-wide text-accent">
              Skilling Certificate Programme
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
              Sign in to CertiFlow
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage training batch rosters, multi-tier district and quality approvals, state sign-off, and asynchronous certificate delivery.
            </p>
            <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">Public &amp; Candidate Access</p>
              <p>
                Employers and citizens can verify certificate authenticity without signing in.
              </p>
              <Button variant="outline" size="sm" asChild className="mt-1">
                <Link to="/verify">Open Public Verification</Link>
              </Button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Staff Sign In</CardTitle>
                <CardDescription>
                  Enter your programme credentials to access your role workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <FormField id="login-email" label="Email Address" required>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      disabled={submitting}
                    />
                  </FormField>

                  <FormField id="login-password" label="Password" required>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={submitting}
                    />
                  </FormField>

                  {formError && (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      {formError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={submitting}>
                    <LogIn className="h-4 w-4" />
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        CertiFlow Skilling Certificate Issuance Platform
      </footer>
    </div>
  );
}
