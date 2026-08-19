const SW_PATH = '/sw.js';

let swReg: ServiceWorkerRegistration | null = null;

export function isBrowserNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationsSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

export function notificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function registerNotificationsServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register(SW_PATH);
  } catch {
    swReg = null;
  }
}

/* Affiche une notification système uniquement quand l'onglet est en arrière-plan */
export async function showBrowserNotification(
  title: string,
  opts: { body?: string; icon?: string; url?: string } = {},
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;

  const icon = opts.icon || '/assets/logo/logo.png';
  const options: NotificationOptions = {
    body: opts.body,
    icon,
    badge: icon,
    data: { url: opts.url || '/' },
    tag: `wouaff-${Date.now()}`,
  };

  try {
    if (!swReg && 'serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.ready;
      } catch {
        swReg = null;
      }
    }
    if (swReg) {
      await swReg.showNotification(title, options);
      return;
    }
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      if (opts.url) window.location.href = opts.url;
      notification.close();
    };
  } catch {
    /* Silencieux */
  }
}
