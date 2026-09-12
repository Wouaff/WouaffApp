import type { ReactNode } from 'react';
import SidePanel from './SidePanel';
import TopNav from './TopNav';

/**
 * Disposition desktop : bandeau horizontal en haut, puis une rangée
 * colonne contextuelle (gauche) + contenu principal. Le fil n'est plus
 * coincé entre deux rails verticaux : la navigation est passée en haut.
 */
export default function AppChrome({ children, sidebar = true }: { children: ReactNode; sidebar?: boolean }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <TopNav />
      <div className="flex flex-1 min-h-0">
        {sidebar && <SidePanel />}
        {children}
      </div>
    </div>
  );
}
