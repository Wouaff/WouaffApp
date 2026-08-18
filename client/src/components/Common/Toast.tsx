import { IonToast } from '@ionic/react';
import { useEffect, useState } from 'react';

interface ToastData {
  message: string;
  type?: string;
}

let showToastFn: ((msg: string, type?: string) => void) | null = null;

export function showToast(message: string, type?: string) {
  showToastFn?.(message, type);
}

const TYPE_COLOR: Record<string, string> = {
  success: 'success',
  error: 'danger',
  info: 'primary',
};

export default function Toast() {
  const [data, setData] = useState<ToastData | null>(null);

  useEffect(() => {
    showToastFn = (message, type) => setData({ message, type });
    return () => {
      showToastFn = null;
    };
  }, []);

  return (
    <IonToast
      isOpen={!!data}
      message={data?.message}
      position="bottom"
      duration={3000}
      color={data ? (TYPE_COLOR[data.type || ''] ?? 'medium') : undefined}
      cssClass="wouaff-toast"
      onDidDismiss={() => setData(null)}
    />
  );
}
