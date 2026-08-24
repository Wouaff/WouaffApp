import { Link } from 'react-router-dom';
import DmcaBadge from '../components/Common/DmcaBadge';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4 flex justify-center text-brand">
          <span className="text-6xl font-black tracking-tight">404</span>
        </div>
        <h1 className="text-lg font-bold">Cette page n'existe pas.</h1>
        <p className="text-text-secondary text-sm mt-2">
          Le lien est peut-être cassé, ou la page a été déplacée. Le reste de Wouaff, lui, fonctionne.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 bg-brand text-white px-6 py-3 rounded-xl font-bold text-sm no-underline"
        >
          Retour à l'accueil
        </Link>
      </div>
      <div className="mt-6 flex justify-center">
        <DmcaBadge />
      </div>
    </div>
  );
}
