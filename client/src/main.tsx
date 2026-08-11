import { setupIonicReact } from '@ionic/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@ionic/react/css/core.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/display.css';
import './index.css';
import App from './App';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { registerNotificationsServiceWorker } from './utils/browserNotifications';

setupIonicReact({ mode: 'md' });

/* Global error handlers — prevent silent crashes */
window.addEventListener('error', (e) => {
  console.error('[GLOBAL ERROR]', e.error?.stack || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason?.stack || e.reason);
});

/* Service worker — clic sur les notifications système */
registerNotificationsServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
