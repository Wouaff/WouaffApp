import { memo } from 'react';

interface PinnedBannerProps {
  count: number;
}

const PinnedBanner = memo(function PinnedBanner({ count }: PinnedBannerProps) {
  if (count === 0) return null;

  return (
    <div className="pinned-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Messages épinglés">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
      </svg>
      <span className="pinned-banner-text">
        {count} message{count > 1 ? 's' : ''} épinglé{count > 1 ? 's' : ''}
      </span>
    </div>
  );
});

export default PinnedBanner;
