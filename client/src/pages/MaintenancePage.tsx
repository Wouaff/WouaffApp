import { ShieldAlert } from 'lucide-react';
import DmcaBadge from '../components/Common/DmcaBadge';

export default function MaintenancePage({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <ShieldAlert size={64} className="mx-auto text-purple-500 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Application en maintenance</h1>
        <p className="text-gray-400 leading-relaxed">
          {message || "L'application est temporairement indisponible. Veuillez réessayer plus tard."}
        </p>
      </div>
      <div className="mt-8 flex justify-center">
        <DmcaBadge />
      </div>
    </div>
  );
}
