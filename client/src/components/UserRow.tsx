import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import FollowButton from './FollowButton';
import VerifiedBadge from './VerifiedBadge';

export interface UserSummary {
  uid: string;
  pseudo: string;
  displayName: string | null;
  avatar: string | null;
  verified: boolean;
  isFollowing?: boolean;
  isOwn?: boolean;
}

export default function UserRow({ user, showFollow = true }: { user: UserSummary; showFollow?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Link to={`/${user.pseudo}`} className="flex-shrink-0">
        <Avatar src={user.avatar} name={user.pseudo} />
      </Link>
      <Link to={`/${user.pseudo}`} className="flex-1 min-w-0 hover:no-underline">
        <div className="font-bold text-sm truncate flex items-center gap-1 text-[var(--text-primary)]">
          {user.displayName || user.pseudo}
          {user.verified && <VerifiedBadge />}
        </div>
        <div className="text-sm text-[var(--text-secondary)] truncate">@{user.pseudo}</div>
      </Link>
      {showFollow && !user.isOwn && <FollowButton pseudo={user.pseudo} initialFollowing={user.isFollowing} />}
    </div>
  );
}
