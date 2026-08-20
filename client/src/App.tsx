import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BannedScreen from './components/Common/BannedScreen';
import EmailVerificationBanner from './components/Common/EmailVerificationBanner';
import OpenSourceBanner from './components/Common/OpenSourceBanner';
import PwaInstallPrompt from './components/Common/PwaInstallPrompt';
import TitleBar from './components/Common/TitleBar';
import MobileLayout from './components/Layout/MobileLayout';
import { useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import { ThemeProvider } from './hooks/useTheme';

const IonicApp = lazy(() => import('./mobile/IonicApp'));
const MobileShell = lazy(() => import('./mobile/MobileShell'));

const LoginPage = lazy(() => import('./components/Auth/LoginPage'));
const MobileLoginPage = lazy(() => import('./components/Auth/MobileLoginPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const CommunitiesPage = lazy(() => import('./pages/CommunitiesPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const DiscoverCommunitiesPage = lazy(() => import('./pages/DiscoverCommunitiesPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const PostPage = lazy(() => import('./pages/PostPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TagPage = lazy(() => import('./pages/TagPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));

const HomeMobile = lazy(() => import('./mobile/pages/HomeMobile'));
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

function HomeRoot({ isMobile }: { isMobile: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div id="loadingOverlay" className="loading-overlay hidden" />;
  if (!user) return <LandingPage />;
  return isMobile ? (
    <MobileAppShell>
      <HomeMobile />
    </MobileAppShell>
  ) : (
    <AppShell>
      <HomePage />
    </AppShell>
  );
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

function SeoTitle() {
  const loc = useLocation();
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Wouaff — ton fil, pas leur algo',
      '/messages': 'Messages — Wouaff',
      '/settings': 'Paramètres — Wouaff',
      '/admin': 'Administration — Wouaff',
    };
    const t = titles[loc.pathname];
    if (t) document.title = t;
  }, [loc.pathname]);
  return null;
}

function AppRoutes() {
  const isMobile = useIsMobile();
  const [ionicReady, setIonicReady] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isMobile) {
      setIonicReady(true);
      return;
    }
    import('./mobile/ionic')
      .catch(() => {})
      .then(() => {
        if (active) setIonicReady(true);
      });
    return () => {
      active = false;
    };
  }, [isMobile]);

  if (isMobile && !ionicReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner" />
      </div>
    );
  }
  const mobile = isMobile;
  return (
    <>
      <SeoTitle />
      <Routes>
        <Route
          path="/auth"
          element={
            mobile ? (
              <IonicApp className="mobile-shell mobile-login">
                <MobileLoginPage />
              </IonicApp>
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<HomeRoot isMobile={mobile} />} />
        <Route
          path="/notifications"
          element={
            mobile ? (
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
          path="/messages"
          element={
            mobile ? (
              <MobileAppShell>
                <MessagesPage />
              </MobileAppShell>
            ) : (
              <AppShell>
                <MessagesPage />
              </AppShell>
            )
          }
        />
        <Route
          path="/hashtag/:tag"
          element={
            mobile ? (
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
            mobile ? (
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
          path="/communities"
          element={
            mobile ? (
              <MobileProtected>
                <CommunitiesPage />
              </MobileProtected>
            ) : (
              <ProtectedRoute>
                <MaintenanceGuard>
                  <MobileLayout>
                    <CommunitiesPage />
                  </MobileLayout>
                </MaintenanceGuard>
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/discover"
          element={
            mobile ? (
              <MobileProtected>
                <DiscoverCommunitiesPage />
              </MobileProtected>
            ) : (
              <ProtectedRoute>
                <MaintenanceGuard>
                  <MobileLayout>
                    <DiscoverCommunitiesPage />
                  </MobileLayout>
                </MaintenanceGuard>
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/c/:name"
          element={
            mobile ? (
              <MobileProtected>
                <CommunityPage />
              </MobileProtected>
            ) : (
              <ProtectedRoute>
                <MaintenanceGuard>
                  <MobileLayout>
                    <CommunityPage />
                  </MobileLayout>
                </MaintenanceGuard>
              </ProtectedRoute>
            )
          }
        />
        <Route
          path="/c/:name/p/:postId"
          element={
            mobile ? (
              <MobileProtected>
                <CommunityPage />
              </MobileProtected>
            ) : (
              <ProtectedRoute>
                <MaintenanceGuard>
                  <MobileLayout>
                    <CommunityPage />
                  </MobileLayout>
                </MaintenanceGuard>
              </ProtectedRoute>
            )
          }
        />
        <Route path="/download" element={<DownloadPage />} />
        <Route
          path="/search"
          element={
            mobile ? (
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
        <Route path="/*" element={<CatchAll isMobile={mobile} />} />
      </Routes>
    </>
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
        <OpenSourceBanner />
        <PwaInstallPrompt />
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
      </ThemeProvider>
    </BrowserRouter>
  );
}
