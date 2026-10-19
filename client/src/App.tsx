import { lazy, type ReactNode, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import MobileNav from './components/MobileNav';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import './index.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const TagPage = lazy(() => import('./pages/TagPage'));
const PostPage = lazy(() => import('./pages/PostPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FollowListPage = lazy(() => import('./pages/FollowListPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const ForgotPasswordPage = lazy(() => import('./pages/AuthFlowPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/AuthFlowPages').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/AuthFlowPages').then((m) => ({ default: m.VerifyEmailPage })));

function Loading() {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const protectedPage = (el: ReactNode) => <ProtectedRoute>{el}</ProtectedRoute>;
const publicPage = (el: ReactNode) => <PublicRoute>{el}</PublicRoute>;

/* Rich presence Discord (appli de bureau uniquement) : on indique la page courante. */
function usePresence() {
  const { pathname } = useLocation();
  useEffect(() => {
    const presence = window.electronAPI?.updateDiscordPresence;
    if (!presence) return;
    presence(pathname === '/auth' ? 'login' : pathname.startsWith('/settings') ? 'settings' : 'home');
  }, [pathname]);
}

function AppRoutes() {
  usePresence();
  return (
    <Routes>
      <Route path="/auth" element={publicPage(<LoginPage />)} />
      <Route path="/forgot-password" element={publicPage(<ForgotPasswordPage />)} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/legal/:slug" element={<LegalPage />} />
      <Route path="/" element={protectedPage(<FeedPage />)} />
      <Route path="/explore" element={protectedPage(<ExplorePage />)} />
      <Route path="/tag/:tag" element={protectedPage(<TagPage />)} />
      <Route path="/post/:id" element={protectedPage(<PostPage />)} />
      <Route path="/notifications" element={protectedPage(<NotificationsPage />)} />
      <Route path="/settings" element={protectedPage(<SettingsPage />)} />
      <Route path="/:pseudo/followers" element={protectedPage(<FollowListPage kind="followers" />)} />
      <Route path="/:pseudo/following" element={protectedPage(<FollowListPage kind="following" />)} />
      <Route path="/:pseudo" element={protectedPage(<ProfilePage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <AppRoutes />
            <MobileNav />
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
