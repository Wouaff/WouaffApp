import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import ActiveCallBar from './components/Call/ActiveCallBar';
import IncomingCallOverlay from './components/Call/IncomingCallOverlay';
import BannedScreen from './components/Common/BannedScreen';
import ConnectionLostOverlay from './components/Common/ConnectionLostOverlay';
import EmailVerificationBanner from './components/Common/EmailVerificationBanner';
import OpenSourceBanner from './components/Common/OpenSourceBanner';
import TitleBar from './components/Common/TitleBar';
import MobileLayout from './components/Layout/MobileLayout';
import { useAuth } from './hooks/useAuth';
import { CallProvider } from './hooks/useCall';
import { useIsMobile } from './hooks/useIsMobile';
import { ThemeProvider } from './hooks/useTheme';
import MobileShell from './mobile/MobileShell';
import AdminPage from './pages/AdminPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const PostPage = lazy(() => import('./pages/PostPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicGroupsPage = lazy(() => import('./pages/PublicGroupsPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TagPage = lazy(() => import('./pages/TagPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));

const HomeMobile = lazy(() => import('./mobile/pages/HomeMobile'));
const ExploreMobile = lazy(() => import('./mobile/pages/ExploreMobile'));
const FeedMobile = lazy(() => import('./mobile/pages/FeedMobile'));
const NotificationsMobile = lazy(() => import('./mobile/pages/NotificationsMobile'));

import { offAccountBanned, onAccountBanned } from './services/socket';

const PAGE_MAP = {
  '/auth': 'login',
  '/auth?mode=register': 'register',
  '/': 'home',
  '/settings': 'settings',
  '/admin': 'settings',
};

function DiscordPresenceTracker() {
  const loc = useLocation();
  useEffect(() => {
    if (!window.electronAPI?.updateDiscordPresence) return;
    const path = loc.pathname + loc.search;
    for (const [pattern, page] of Object.entries(PAGE_MAP)) {
      if (path === pattern) {
        window.electronAPI.updateDiscordPresence(page);
        return;
      }
    }
    window.electronAPI.updateDiscordPresence('home');
  }, [loc]);
  return null;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MaintenanceGuard>
        <MobileLayout>
          <ChatGuard>{children}</ChatGuard>
        </MobileLayout>
      </MaintenanceGuard>
    </ProtectedRoute>
  );
}

function MobileAppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MaintenanceGuard>
        <MobileShell>
          <ChatGuard>{children}</ChatGuard>
        </MobileShell>
      </MaintenanceGuard>
    </ProtectedRoute>
  );
}

function MobileProtected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MaintenanceGuard>
        <MobileShell>{children}</MobileShell>
      </MaintenanceGuard>
    </ProtectedRoute>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div id="loadingOverlay" className="loading-overlay hidden" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function ChatGuard({ children }: { children: React.ReactNode }) {
  const { user, emailVerified, refresh } = useAuth();
  if (!user) return <>{children}</>;
  if (emailVerified) return <>{children}</>;
  return <EmailVerificationBanner onVerified={refresh} />;
}

function MaintenanceGuard({ children, skip }: { children: React.ReactNode; skip?: boolean }) {
  const [status, setStatus] = useState<{ enabled: boolean; message: string | null } | null>(null);
  useEffect(() => {
    if (skip) return;
    fetch('/api/maintenance')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, message: null }));
  }, [skip]);
  if (skip || status === null) return <>{children}</>;
  if (status.enabled) return <MaintenancePage message={status.message ?? undefined} />;
  return <>{children}</>;
}

function CatchAll({ isMobile }: { isMobile: boolean }) {
  const loc = useLocation();
  if (loc.pathname.match(/^\/@(.+)/)) {
    const page = <ProfilePage />;
    return isMobile ? <MobileShell>{page}</MobileShell> : page;
  }
  if (loc.pathname.match(/^\/post\/(.+)/)) {
    const page = <PostPage />;
    return isMobile ? <MobileShell>{page}</MobileShell> : page;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const isMobile = useIsMobile();
  return (
    <Routes>
      <Route path="/auth" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/"
        element={
          isMobile ? (
            <MobileAppShell>
              <HomeMobile />
            </MobileAppShell>
          ) : (
            <AppShell>
              <HomePage />
            </AppShell>
          )
        }
      />
      <Route
        path="/chat"
        element={
          isMobile ? (
            <MobileAppShell>
              <ChatPage />
            </MobileAppShell>
          ) : (
            <AppShell>
              <ChatPage />
            </AppShell>
          )
        }
      />
      <Route
        path="/notifications"
        element={
          isMobile ? (
            <MobileAppShell>
              <NotificationsMobile />
            </MobileAppShell>
          ) : (
            <AppShell>
              <NotificationsPage />
            </AppShell>
          )
        }
      />
      <Route
        path="/hashtag/:tag"
        element={
          isMobile ? (
            <MobileAppShell>
              <TagPage />
            </MobileAppShell>
          ) : (
            <AppShell>
              <TagPage />
            </AppShell>
          )
        }
      />
      <Route
        path="/settings"
        element={
          isMobile ? (
            <MobileProtected>
              <SettingsPage />
            </MobileProtected>
          ) : (
            <ProtectedRoute>
              <MaintenanceGuard>
                <MobileLayout>
                  <SettingsPage />
                </MobileLayout>
              </MaintenanceGuard>
            </ProtectedRoute>
          )
        }
      />
      <Route
        path="/feed"
        element={
          isMobile ? (
            <MobileProtected>
              <FeedMobile />
            </MobileProtected>
          ) : (
            <ProtectedRoute>
              <MaintenanceGuard>
                <MobileLayout>
                  <FeedPage />
                </MobileLayout>
              </MaintenanceGuard>
            </ProtectedRoute>
          )
        }
      />
      <Route path="/download" element={<DownloadPage />} />
      <Route
        path="/explore"
        element={
          isMobile ? (
            <MobileProtected>
              <ExploreMobile />
            </MobileProtected>
          ) : (
            <ProtectedRoute>
              <MaintenanceGuard>
                <PublicGroupsPage />
              </MaintenanceGuard>
            </ProtectedRoute>
          )
        }
      />
      <Route
        path="/search"
        element={
          isMobile ? (
            <MobileAppShell>
              <SearchPage />
            </MobileAppShell>
          ) : (
            <AppShell>
              <SearchPage />
            </AppShell>
          )
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <MaintenanceGuard skip>
              <AdminPage />
            </MaintenanceGuard>
          </ProtectedRoute>
        }
      />
      <Route path="/*" element={<CatchAll isMobile={isMobile} />} />
    </Routes>
  );
}

function BannedGuard({ children }: { children: React.ReactNode }) {
  const { banned, markBanned } = useAuth();
  useEffect(() => {
    const handle = () => markBanned();
    onAccountBanned(handle);
    return () => offAccountBanned(handle);
  }, [markBanned]);
  if (banned) return <BannedScreen />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <CallProvider>
          <IncomingCallOverlay />
          <ActiveCallBar />
          <ConnectionLostOverlay />
          <OpenSourceBanner />
          <DiscordPresenceTracker />
          <BannedGuard>
            <div className="flex flex-col h-dvh">
              <TitleBar />
              <div className="flex-1 overflow-hidden">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-dvh">
                      <div className="spinner" />
                    </div>
                  }
                >
                  <AppRoutes />
                </Suspense>
              </div>
            </div>
          </BannedGuard>
        </CallProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
