import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/src/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { getDefaultHomePath } from '@/src/lib/utils';
import { ProtectedRoute } from '@/src/components/shared/ProtectedRoute';
import { LoginPage } from '@/src/pages/LoginPage';
import { DashboardPage } from '@/src/pages/DashboardPage';
import { BatchesPage } from '@/src/pages/BatchesPage';
import { NewBatchPage } from '@/src/pages/NewBatchPage';
import { BatchDetailPage } from '@/src/pages/BatchDetailPage';
import { InboxPage } from '@/src/pages/InboxPage';
import { EscalationsPage } from '@/src/pages/EscalationsPage';
import { JobsPage } from '@/src/pages/JobsPage';
import { CertificateDetailPage } from '@/src/pages/CertificateDetailPage';
import { VerifyPage } from '@/src/pages/VerifyPage';
import { CandidateDownloadPage } from '@/src/pages/CandidateDownloadPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
});

function RootRedirect() {
  const { isAuthenticated, isInitializing, user } = useAuth();
  if (isInitializing) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultHomePath(user?.role)} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/verify/:token" element={<VerifyPage />} />
              <Route path="/download" element={<CandidateDownloadPage />} />
              <Route path="/download/:token" element={<CandidateDownloadPage />} />

              {/* Role-aware root */}
              <Route path="/" element={<RootRedirect />} />

              {/* Authenticated staff routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/batches"
                element={
                  <ProtectedRoute>
                    <BatchesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/batches/new"
                element={
                  <ProtectedRoute allowedRoles={['training_centre']}>
                    <NewBatchPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/batches/:id"
                element={
                  <ProtectedRoute>
                    <BatchDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inbox"
                element={
                  <ProtectedRoute
                    allowedRoles={['district_officer', 'quality_reviewer', 'state_officer']}
                  >
                    <InboxPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/escalations"
                element={
                  <ProtectedRoute allowedRoles={['state_officer']}>
                    <EscalationsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/jobs"
                element={
                  <ProtectedRoute allowedRoles={['state_officer']}>
                    <JobsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/certificates/:id"
                element={
                  <ProtectedRoute>
                    <CertificateDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
