import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { stories as storiesAPI } from '../../services/api';
import type { StoryData } from '../../types';

interface StoryUser {
  uid: string;
  stories: Record<string, StoryData>;
  storyIds: string[];
}

interface StoryViewerProps {
  startUid: string;
  onClose: () => void;
}

export default function StoryViewer({ startUid, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<StoryUser[]>([]);
  const [userIdx, setUserIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef({ x: 0, y: 0, t: 0 });

  const [profiles, setProfiles] = useState<Record<string, { pseudo: string; avatar?: string }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allStories, myStories] = await Promise.all([storiesAPI.list(), storiesAPI.mine()]);
        if (cancelled) return;
        const list: StoryUser[] = [];
        const myStoriesData = myStories as unknown as Record<string, StoryData>;
        const profileMap: Record<string, { pseudo: string; avatar?: string }> = {};

        if (Object.keys(myStoriesData).length > 0) {
          list.push({ uid: user!.uid, stories: myStoriesData, storyIds: Object.keys(myStoriesData) });
        }
        for (const [uid, stories] of Object.entries(allStories)) {
          if (uid === user?.uid) continue;
          const active = stories as Record<string, StoryData>;
          if (Object.keys(active).length > 0) {
            list.push({ uid, stories: active as Record<string, StoryData>, storyIds: Object.keys(active) });
          }
        }
        setUsers(list);

        const uids = list.map((u) => u.uid);
        const results = await Promise.allSettled(
          uids.map((uid) =>
            fetch(`/api/profiles/${uid}`)
              .then((r) => r.json() as Promise<{ pseudo: string; avatar?: string }>)
              .then((p) => ({ uid, ...p })),
          ),
        );
        if (cancelled) return;
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            profileMap[r.value.uid] = { pseudo: r.value.pseudo || '?', avatar: r.value.avatar };
          }
        }
        setProfiles(profileMap);

        const startIdx = list.findIndex((u) => u.uid === startUid);
        setUserIdx(startIdx >= 0 ? startIdx : 0);
        setStoryIdx(0);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user?.uid, startUid]);

  /* Resume audio on first user interaction (browser autoplay policy) */
  const tryPlayAudio = useCallback(() => {
    if (audioRef.current?.paused && !paused) {
      audioRef.current.play().catch(() => {});
    }
  }, [paused]);

  /* Audio lifecycle */
  useEffect(() => {
    const story = users[userIdx]?.stories[users[userIdx]?.storyIds[storyIdx]];
    if (audioEndTimerRef.current) {
      clearTimeout(audioEndTimerRef.current);
      audioEndTimerRef.current = null;
    }

    if (!story?.audioData) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setAudioReady(false);
      return;
    }
    if (!audioRef.current || audioRef.current.src !== story.audioData) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(story.audioData);
      audio.volume = 0.3;
      audio.loop = false;
      if (story.audioStartTime) audio.currentTime = story.audioStartTime;
      audioRef.current = audio;
      setAudioReady(true);
      if (paused) return;
      audio.play().catch(() => {});
    } else if (paused) {
      audioRef.current?.pause();
    } else {
      /* Resuming: seek to start time if needed */
      const story = users[userIdx]?.stories[users[userIdx]?.storyIds[storyIdx]];
      if (story?.audioStartTime && audioRef.current) {
        audioRef.current.currentTime = story.audioStartTime;
      }
      audioRef.current?.play().catch(() => {});
    }

    /* Stop audio after extract duration */
    if (story?.audioExtractDuration && audioRef.current) {
      audioEndTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }, story.audioExtractDuration * 1000);
    }

    return () => {
      if (audioEndTimerRef.current) {
        clearTimeout(audioEndTimerRef.current);
        audioEndTimerRef.current = null;
      }
      if (audioRef.current && audioRef.current.src !== story?.audioData) {
        audioRef.current.pause();
        audioRef.current = null;
        setAudioReady(false);
      }
    };
  }, [users, userIdx, storyIdx, paused]);

  const markViewed = useCallback(async (uid: string, sid: string) => {
    try {
      await storiesAPI.markViewed(sid, uid);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (users.length === 0) return;
    const current = users[userIdx];
    if (!current || storyIdx >= current.storyIds.length) {
      if (userIdx + 1 < users.length) {
        setUserIdx(userIdx + 1);
        setStoryIdx(0);
      } else {
        onClose();
      }
      return;
    }
    const sid = current.storyIds[storyIdx];
    markViewed(current.uid, sid);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (!paused) {
      const currentStory = current.stories[sid];
      const duration = (currentStory?.audioExtractDuration || 5) * 1000;
      timerRef.current = setTimeout(() => {
        setStoryIdx(storyIdx + 1);
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [users, userIdx, storyIdx, paused, markViewed, onClose]);

  const navigate = (dir: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const current = users[userIdx];
    if (!current) return;
    if (dir === 1) {
      if (storyIdx + 1 < current.storyIds.length) setStoryIdx(storyIdx + 1);
      else if (userIdx + 1 < users.length) {
        setUserIdx(userIdx + 1);
        setStoryIdx(0);
      }
    } else {
      if (storyIdx > 0) setStoryIdx(storyIdx - 1);
      else if (userIdx > 0) {
        setUserIdx(userIdx - 1);
        setStoryIdx(0);
      }
    }
  };

  const current = users[userIdx];
  const currentStory = current ? current.stories[current.storyIds[storyIdx]] : null;
  const currentProfile = current ? profiles[current.uid] : null;

  if (!current || !currentStory) return null;

  const hasAudio = !!currentStory.audioData;
  const storyDuration = currentStory.audioExtractDuration || 5;
  const progressMs = storyDuration * 1000;

  return (
    <div
      className="story-viewer-overlay"
      id="storyViewer"
      role="dialog"
      aria-label="Visionneuse de story"
      aria-modal="true"
      onTouchStart={(e) => {
        tryPlayAudio();
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
          onClose();
          return;
        }
        if (Math.abs(dx) > 50) navigate(dx > 0 ? -1 : 1);
        setPaused(false);
      }}
      onClick={(e) => {
        tryPlayAudio();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.3) navigate(-1);
        else if (x > rect.width * 0.7) navigate(1);
        else setPaused(!paused);
      }}
    >
      {/* Progress bar */}
      <div className="story-progress-row">
        {current.storyIds.map((id, i) => (
          <div key={id} className="story-progress-segment">
            <div
              className={`story-progress-fill ${i < storyIdx ? 'done' : ''} ${i === storyIdx && !paused ? 'active' : ''}`}
              style={i === storyIdx && !paused ? ({ '--pd': `${progressMs}ms` } as React.CSSProperties) : undefined}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="story-viewer-header">
        <div className="story-viewer-user">
          <div className="story-viewer-avatar" id="storyViewerAvatar">
            {currentProfile?.avatar ? (
              <img src={currentProfile.avatar} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span>{(currentProfile?.pseudo || '?')[0]}</span>
            )}
          </div>
          <div className="story-viewer-info">
            <span className="story-viewer-name" id="storyViewerName">
              {currentProfile?.pseudo || 'Utilisateur'}
            </span>
            <span className="story-viewer-time" id="storyViewerTime">
              {currentStory.timestamp
                ? new Date(currentStory.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : ''}
            </span>
          </div>
        </div>
        <button className="story-viewer-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>

      {/* Media */}
      <img className="story-viewer-image" id="storyViewerImage" src={currentStory.media} alt="" />

      {/* Description */}
      {currentStory.description && <div className="story-viewer-desc">{currentStory.description}</div>}

      {/* Music indicator */}
      {hasAudio && audioReady && (
        <div className={`story-music-indicator${paused ? ' paused' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span>{currentStory.audioName || 'Musique'}</span>
          <div className="music-bars">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Tap hints */}
      <div className="story-tap-hint-left" aria-hidden="true" />
      <div className="story-tap-hint-right" aria-hidden="true" />
    </div>
  );
}
