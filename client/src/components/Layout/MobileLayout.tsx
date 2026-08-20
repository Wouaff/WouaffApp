import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../Navigation/BottomNav';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {children}
      {user && <BottomNav />}
    </div>
  );
}
