import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { messages as messagesAPI } from '../../services/api';
import { decryptMessageData } from '../../services/e2ee';
import {
  emitTypingDM,
  emitTypingGroup,
  joinDM,
  joinGroup,
  leaveDM,
  leaveGroup,
  offGroupMemberRemoved,
  offGroupRoleChanged,
  offGroupSeen,
  offMessageAdded,
  offMessageRemoved,
  offMessageUpdated,
  offProfileUpdated,
  offSeen,
  offTyping,
  onGroupMemberRemoved,
  onGroupRoleChanged,
  onGroupSeen,
  onMessageAdded,
  onMessageRemoved,
  onMessageUpdated,
  onProfileUpdated,
  onSeen,
  onTyping,
} from '../../services/socket';
import type { MessageData } from '../../types';
import { fetchLinkPreview, parseUrls } from '../../utils/links';
import { playMessageSound } from '../../utils/notificationSound';
import { showToast } from '../Common/Toast';
import type { AnimationType } from './Animations/keywords';
import { KEYWORD_MAP } from './Animations/keywords';
import MessageAnimation from './Animations/MessageAnimation';
import ChatTopbar from './ChatTopbar';
import ContextMenu from './ContextMenu';
import ForwardModal from './ForwardModal';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import PinnedBanner from './PinnedBanner';
import ReplyPreview from './ReplyPreview';
import SearchBar from './SearchBar';

interface ChatViewProps {
  chatWith: string | null;
  chatWithPseudo: string;
  currentGroupId: string | null;
  onOpenGroupInfo?: () => void;
  onOpenUserProfile?: (uid: string) => void;
  onDeleteConv?: () => void;
  onDownloadFile?: (fileData: string, fileName: string, fromUid: string) => void;
  onGroupKicked?: () => void;
}

export default function ChatView({
  chatWith,
  chatWithPseudo,
  currentGroupId,
  onOpenGroupInfo,
  onOpenUserProfile,
  onDeleteConv,
  onDownloadFile,
  onGroupKicked,
}: ChatViewProps) {
  const { user } = useAuth();
  const [allMessages, setAllMessages] = useState<Record<string, MessageData>>({});
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [typingText, setTypingText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; mid: string; msg: MessageData } | null>(null);
  const [pinnedMsgs, setPinnedMsgs] = useState<Record<string, MessageData>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, MessageData>>({});
  const [searching, setSearching] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<{ mid: string; msg: MessageData } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [ephemeralDuration, setEphemeralDuration] = useState<number | null>(null);
  const [partnerPubKey, setPartnerPubKey] = useState<JsonWebKey | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { avatar?: string; pseudo?: string }>>({});
  const [linkPreviews, setLinkPreviews] = useState<Record<string, import('../../utils/links').LinkPreview | null>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [currentAnimation, setCurrentAnimation] = useState<AnimationType | null>(null);

  const _searchInputRef = useRef<HTMLInputElement>(null);
  const convRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgsEl = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const oldestTimeRef = useRef<number>(Infinity);
  const loadingMoreRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const convId = chatWith || currentGroupId || '';

  useEffect(() => {
    if (!user) return;
    const uids = new Set<string>();
    for (const msg of Object.values(allMessages)) {
      if (msg.from && msg.from !== user.uid) uids.add(msg.from);
    }
    if (uids.size === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        Array.from(uids).map(async (uid) => {
          try {
            const res = await fetch(`/api/profiles/${uid}`);
            const p = (await res.json()) as { avatar?: string; pseudo?: string };
            return [uid, { avatar: p.avatar, pseudo: p.pseudo }] as const;
          } catch {
            return [uid, { avatar: undefined, pseudo: undefined }] as const;
          }
        }),
      );
      if (cancelled) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const [uid, data] of entries) next[uid] = { ...prev[uid], ...data };
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, allMessages]);

  useEffect(() => {
    const allUrls = new Set<string>();
    for (const msg of Object.values(allMessages)) {
      if (msg.text) {
        for (const url of parseUrls(msg.text)) {
          allUrls.add(url);
        }
      }
    }
    for (const url of allUrls) {
      if (!(url in linkPreviews)) {
        fetchLinkPreview(url).then((preview) => {
          setLinkPreviews((prev) => ({ ...prev, [url]: preview }));
        });
      }
    }
  }, [allMessages, linkPreviews]);

  useEffect(() => {
    if (!chatWith) {
      setPartnerPubKey(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/profiles/${chatWith}/publicKey`, {
          headers: {} as Record<string, string>,
        });
        const data = await res.json();
        setPartnerPubKey(data.publicKey as JsonWebKey | null);
      } catch {
        setPartnerPubKey(null);
      }
    })();
  }, [chatWith]);

  const allMessagesRef = useRef(allMessages);
  allMessagesRef.current = allMessages;

  const markSeen = useCallback(
    (msgKeys: string[]) => {
      if (!user) return;
      const msgs = allMessagesRef.current;
      if (chatWith) {
        const unseen = msgKeys.filter((k) => {
          const m = msgs[k];
          return !m || (m.from !== user.uid && !m.seen);
        });
        if (unseen.length > 0) {
          messagesAPI.seen(chatWith, unseen).catch((e) => {
            console.error(e);
          });
        }
      } else if (currentGroupId) {
        const unseen = msgKeys.filter((k) => {
          const m = msgs[k];
          return !m || (m.from !== user.uid && !m.seenBy?.includes(user.uid));
        });
        if (unseen.length > 0) {
          messagesAPI.seenGroup(currentGroupId, unseen).catch((e) => {
            console.error(e);
          });
        }
      }
    },
    [chatWith, currentGroupId, user],
  );

  const markSeenRef = useRef(markSeen);
  markSeenRef.current = markSeen;

  useEffect(() => {
    if (!chatWith && !currentGroupId) return;
    const convChanged = convRef.current !== (chatWith || currentGroupId);
    convRef.current = chatWith || currentGroupId;
    if (convChanged) {
      setAllMessages({});
      setReplyTo(null);
      setEditingMsgId(null);
      setInputValue('');
      setTypingText('');
      setContextMenu(null);
      setPinnedMsgs({});
      setHasMore(false);
      oldestTimeRef.current = Infinity;
      loadingMoreRef.current = false;
      userScrolledUpRef.current = false;
    }
    let cancelled = false;
    const load = async () => {
      try {
        if (chatWith) {
          if (convChanged)
            messagesAPI
              .getPinned(chatWith)
              .then((r) => {
                if (!cancelled) setPinnedMsgs(r as Record<string, MessageData>);
              })
              .catch(() => {});
          joinDM(chatWith);
          const result = await messagesAPI.list(chatWith, 20);
          if (cancelled) return;
          const data = result.messages as Record<string, MessageData>;
          setAllMessages(data);
          setHasMore(result.hasMore);
          const times = Object.values(data).map((m) => m.time || 0);
          oldestTimeRef.current = times.length > 0 ? Math.min(...times) : Infinity;
          if (user) {
            const unseen = Object.entries(data)
              .filter(([_, m]) => m.from !== user.uid && !m.seen)
              .map(([k]) => k);
            if (unseen.length > 0) messagesAPI.seen(chatWith, unseen);
          }
        } else if (currentGroupId) {
          joinGroup(currentGroupId);
          if (convChanged)
            messagesAPI
              .getPinnedGroup(currentGroupId)
              .then((r) => {
                if (!cancelled) setPinnedMsgs(r as Record<string, MessageData>);
              })
              .catch(() => {});
          const result = await messagesAPI.listGroup(currentGroupId, 20);
          if (cancelled) return;
          const data = result.messages as Record<string, MessageData>;
          setAllMessages(data);
          setHasMore(result.hasMore);
          const times = Object.values(data).map((m) => m.time || 0);
          oldestTimeRef.current = times.length > 0 ? Math.min(...times) : Infinity;
          if (user) {
            const unseen = Object.entries(data)
              .filter(([_, m]) => m.from !== user.uid && !m.seenBy?.includes(user.uid))
              .map(([k]) => k);
            if (unseen.length > 0) messagesAPI.seenGroup(currentGroupId, unseen);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();

    const onAdd = useCallback(async (ev: { convId: string; key: string; data: MessageData }) => {
      let msg = ev.data;
      if (msg.encrypted && msg.ct && msg.iv && partnerPubKey) {
        msg = (await decryptMessageData(
          msg as unknown as Record<string, unknown>,
          partnerPubKey,
        )) as unknown as MessageData;
      }
      setAllMessages((prev) => ({ ...prev, [ev.key]: msg }));
      if (msg.from !== user?.uid) {
        markSeenRef.current?.([ev.key]);
        playMessageSound();
      }
      if (msg.type === 'text' && msg.text && localStorage.getItem('wouaff_animations_enabled') !== 'false') {
        for (const [regex, animType] of KEYWORD_MAP) {
          if (regex.test(msg.text)) {
            setCurrentAnimation(animType);
            break;
          }
        }
      }
    }, [user, partnerPubKey]);
    const onUpd = async (ev: { convId: string; key: string; data: MessageData }) => {
      let msg = ev.data;
      if (msg.encrypted && msg.ct && msg.iv && partnerPubKey) {
        msg = (await decryptMessageData(
          msg as unknown as Record<string, unknown>,
          partnerPubKey,
        )) as unknown as MessageData;
      }
      setAllMessages((prev) => (prev[ev.key] ? { ...prev, [ev.key]: msg } : prev));
    };
    const onRem = (ev: { convId: string; key: string }) => {
      setAllMessages((prev) => {
        const next = { ...prev };
        delete next[ev.key];
        return next;
      });
    };
    const onTyp = (ev: { from: string; isTyping: boolean }) => {
      if (ev.from !== user?.uid) {
        setTypingText(ev.isTyping ? `${chatWithPseudo || "Quelqu'un"} écrit...` : '');
      }
    };
    onMessageAdded(onAdd);
    onMessageUpdated(onUpd);
    onMessageRemoved(onRem);
    onTyping(onTyp);

    const handleSeenDM = (ev: { by: string; msgKeys: string[] }) => {
      if (chatWith === ev.by) {
        setAllMessages((prev) => {
          const next = { ...prev };
          for (const key of ev.msgKeys) {
            if (next[key]) {
              next[key] = { ...next[key], seen: Date.now() };
            }
          }
          return next;
        });
      }
    };
    onSeen(handleSeenDM);

    const handleGroupSeen = (ev: { gid: string; by: string; msgKeys: string[] }) => {
      if (ev.gid === currentGroupId) {
        setAllMessages((prev) => {
          const next = { ...prev };
          for (const key of ev.msgKeys) {
            if (next[key]) {
              const seenBy = next[key].seenBy ? [...next[key].seenBy!] : [];
              if (!seenBy.includes(ev.by)) {
                seenBy.push(ev.by);
                next[key] = { ...next[key], seenBy };
              }
            }
          }
          return next;
        });
      }
    };
    onGroupSeen(handleGroupSeen);

    return () => {
      cancelled = true;
      if (convChanged) {
        leaveDM();
        leaveGroup();
      }
      offMessageAdded(onAdd);
      offMessageUpdated(onUpd);
      offMessageRemoved(onRem);
      offTyping(onTyp);
      offSeen(handleSeenDM);
      offGroupSeen(handleGroupSeen);
    };
  }, [chatWith, currentGroupId, user, partnerPubKey, chatWithPseudo]);

  useEffect(() => {
    if (msgsEl.current && !userScrolledUpRef.current && !loadingMoreRef.current) {
      msgsEl.current.scrollTop = msgsEl.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const el = msgsEl.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      userScrolledUpRef.current = !nearBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || (!chatWith && !currentGroupId)) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const prevHeight = msgsEl.current?.scrollHeight || 0;
    const prevScrollTop = msgsEl.current?.scrollTop || 0;
    try {
      const result = chatWith
        ? await messagesAPI.list(chatWith, 20, oldestTimeRef.current)
        : await messagesAPI.listGroup(currentGroupId!, 20, oldestTimeRef.current);
      const data = result.messages as Record<string, MessageData>;
      setAllMessages((prev) => ({ ...data, ...prev }));
      setHasMore(result.hasMore);
      const times = Object.values(data).map((m) => m.time || 0);
      oldestTimeRef.current = times.length > 0 ? Math.min(...times) : oldestTimeRef.current;
    } catch (e) {
      console.error('loadMore failed', e);
    }
    requestAnimationFrame(() => {
      if (msgsEl.current) {
        msgsEl.current.scrollTop = prevScrollTop + (msgsEl.current.scrollHeight - prevHeight);
      }
    });
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [chatWith, currentGroupId, hasMore]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMoreRef.current) {
          loadMore();
        }
      },
      { root: msgsEl.current, threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  useEffect(() => {
    if (!currentGroupId || !user) return;
    const handleRemoved = (data: { gid: string; uid?: string; kicked?: boolean }) => {
      if (data.uid === user.uid || data.kicked) {
        onGroupKicked?.();
      }
    };
    const handleRoleChanged = (data: { gid: string; uid: string; role: string }) => {
      if (data.uid === user.uid) {
        showToast(
          `Vous êtes maintenant ${data.role === 'owner' ? 'propriétaire' : data.role === 'admin' ? 'admin' : 'membre'}`,
          'info',
        );
      }
    };
    onGroupMemberRemoved(handleRemoved);
    onGroupRoleChanged(handleRoleChanged);
    return () => {
      offGroupMemberRemoved(handleRemoved);
      offGroupRoleChanged(handleRoleChanged);
    };
  }, [currentGroupId, user, onGroupKicked]);

  useEffect(() => {
    const handleProfileUpdated = (data: { uid: string } & Record<string, unknown>) => {
      setProfiles((prev) => (prev[data.uid] ? { ...prev, [data.uid]: { ...prev[data.uid], ...data } } : prev));
    };
    onProfileUpdated(handleProfileUpdated);
    return () => offProfileUpdated(handleProfileUpdated);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (chatWith) {
      emitTypingDM(chatWith, true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => emitTypingDM(chatWith, false), 2000);
    } else if (currentGroupId) {
      emitTypingGroup(currentGroupId, true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => emitTypingGroup(currentGroupId, false), 2000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => {
          t.stop();
        });
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const audioData = reader.result as string;
          const msg: Record<string, unknown> = {
            type: 'voice',
            audioData,
            duration: recordingTime,
            messageTheme: 'default',
          };
          try {
            if (chatWith) await messagesAPI.send(chatWith, msg);
            else if (currentGroupId) await messagesAPI.sendGroup(currentGroupId, msg);
          } catch (e) {
            console.error('Voice send failed', e);
          }
        };
        reader.readAsDataURL(blob);
        setRecording(false);
        setRecordingTime(0);
      };
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (e) {
      console.error('Mic access denied', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const sendFile = async (file: File) => {
    if (!user) return;
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const msg: Record<string, unknown> = {
        text: file.name,
        type: isImage ? 'image' : 'file',
        messageTheme: 'default',
      };
      if (isImage) {
        msg.imageData = dataUrl;
      } else {
        msg.fileData = dataUrl;
        msg.fileName = file.name;
      }
      try {
        if (chatWith) await messagesAPI.send(chatWith, msg);
        else if (currentGroupId) await messagesAPI.sendGroup(currentGroupId, msg);
      } catch (e) {
        console.error('File send failed', e);
      }
    };
    reader.readAsDataURL(file);
  };

  const sendMsg = async () => {
    if (!inputValue.trim() || !user) return;
    if (editingMsgId) {
      try {
        if (chatWith) await messagesAPI.update(chatWith, editingMsgId, { text: inputValue, edited: true });
        else if (currentGroupId) {
          await fetch(`/api/messages/group/${currentGroupId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: inputValue, edited: true }),
          });
        }
      } catch (e) {
        console.error('Edit failed', e);
      }
      setEditingMsgId(null);
      setInputValue('');
      return;
    }
    const msg: Record<string, unknown> = { text: inputValue, messageTheme: 'default' };
    if (replyTo) {
      msg.replyTo = replyTo;
      setReplyTo(null);
      setReplyText('');
    }
    if (ephemeralDuration) {
      msg.ephemeralDuration = ephemeralDuration;
      setEphemeralDuration(null);
    }
    try {
      const res = chatWith
        ? ((await messagesAPI.send(chatWith, msg)) as unknown as { key: string } & Record<string, unknown>)
        : ((await messagesAPI.sendGroup(currentGroupId!, msg)) as unknown as { key: string } & Record<string, unknown>);
      setAllMessages((prev) => ({ ...prev, [res.key]: { ...res, from: user.uid } as unknown as MessageData }));
      setInputValue('');
    } catch (e) {
      console.error('Send failed', e);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults({});
      return;
    }
    setSearching(true);
    try {
      const res = chatWith ? await messagesAPI.search(chatWith, q) : await messagesAPI.searchGroup(currentGroupId!, q);
      setSearchResults(res.results as Record<string, MessageData>);
    } catch (e) {
      console.error('Search failed', e);
    }
    setSearching(false);
  };

  const scrollToMsg = (mid: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({});
    setTimeout(() => {
      const el = document.querySelector(`[data-mid="${mid}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const deleteMsg = async (mid: string) => {
    try {
      if (currentGroupId) await messagesAPI.deleteGroup(currentGroupId, mid);
      else if (chatWith) await messagesAPI.delete(chatWith, mid);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, mid: string, msg: MessageData) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, mid, msg });
  };

  const handleLongPressStart = (mid: string, msg: MessageData) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x: 0, y: 0, mid, msg });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  if (!chatWith && !currentGroupId) {
    return (
      <div className="chat-placeholder">
        <div className="chat-placeholder-content">
          <img src="/assets/logo/logo.png" alt="Wouaff" className="w-16 h-16 opacity-30" />
          <h2>Sélectionnez une conversation</h2>
        </div>
      </div>
    );
  }

  const sorted = Object.entries(allMessages).sort((a, b) => (a[1].time || 0) - (b[1].time || 0));
  const isGroup = !!currentGroupId;

  return (
    <>
      <ChatTopbar
        chatWith={chatWith}
        chatWithPseudo={chatWithPseudo}
        currentGroupId={currentGroupId}
        searchOpen={searchOpen}
        onToggleSearch={() => {
          setSearchOpen((o) => !o);
        }}
        onOpenGroupInfo={onOpenGroupInfo}
        onOpenUserProfile={onOpenUserProfile}
        onDeleteConv={onDeleteConv}
      />
      <SearchBar
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searching={searching}
        searchResults={searchResults}
        onSearchChange={handleSearch}
        onClose={() => setSearchOpen(false)}
        onResultClick={scrollToMsg}
      />
      <PinnedBanner count={Object.keys(pinnedMsgs).length} />
      <div className="messages" ref={msgsEl}>
        {hasMore && <div ref={sentinelRef} className="h-1" />}
        {loadingMore && (
          <div className="flex items-center justify-center py-3 text-sm text-[var(--text-secondary)]">
            <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mr-2" />
            Chargement...
          </div>
        )}
        {sorted.length === 0 && !loadingMore && (
          <div className="flex items-center justify-center h-full text-center px-5 py-10 text-text-muted text-sm leading-relaxed">
            Aucun message.
            <br />
            Envoyez le premier message !
          </div>
        )}
        {sorted.map(([mid, msg], i) => {
          const isSent = msg.from === user?.uid;
          const prev = i > 0 ? sorted[i - 1][1] : null;
          const next = i < sorted.length - 1 ? sorted[i + 1][1] : null;
          const windowMs = isGroup ? 90000 : 60000;
          const prevSame = prev && prev.from === msg.from && msg.time - (prev.time || 0) < windowMs;
          const nextSame = next && next.from === msg.from && (next.time || 0) - msg.time < windowMs;
          let groupClass = '';
          if (prevSame && nextSame) groupClass = 'group-middle grouped';
          else if (prevSame && !nextSame) groupClass = 'group-end grouped';
          else if (!prevSame && nextSame) groupClass = 'group-start';

          return (
            <MessageBubble
              key={mid}
              mid={mid}
              msg={msg}
              isSent={isSent}
              isGroup={isGroup}
              groupClass={groupClass}
              prevSame={!!prevSame}
              profiles={profiles}
              allMessages={allMessages}
              linkPreviews={linkPreviews}
              user={user}
              convId={convId}
              currentGroupId={currentGroupId}
              onOpenUserProfile={onOpenUserProfile}
              onContextMenu={handleContextMenu}
              onTouchStart={handleLongPressStart}
              onTouchEnd={handleLongPressEnd}
              onTouchMove={handleLongPressEnd}
              onDownloadFile={onDownloadFile}
            />
          );
        })}
        {typingText && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            {typingText}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mid={contextMenu.mid}
          msg={contextMenu.msg}
          convId={convId}
          isGroup={isGroup}
          isOwn={contextMenu.msg.from === user?.uid}
          onReply={() => {
            setReplyTo(contextMenu.mid);
            setReplyText(contextMenu.msg.text || '');
          }}
          onEdit={() => {
            setEditingMsgId(contextMenu.mid);
            setInputValue(contextMenu.msg.text || '');
          }}
          onForward={() => {
            setForwardMsg({ mid: contextMenu.mid, msg: contextMenu.msg });
          }}
          onTogglePin={async () => {
            const pinned = !contextMenu.msg.pinned;
            try {
              if (chatWith) await messagesAPI.pin(chatWith, contextMenu.mid, pinned);
              else if (currentGroupId) await messagesAPI.pinGroup(currentGroupId, contextMenu.mid, pinned);
            } catch (e) {
              console.error('Pin failed', e);
            }
          }}
          onDelete={() => deleteMsg(contextMenu.mid)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {forwardMsg && (
        <ForwardModal
          msg={forwardMsg.msg}
          user={user}
          currentChatWith={chatWith}
          currentGroupId={currentGroupId}
          onClose={() => setForwardMsg(null)}
        />
      )}

      <ReplyPreview
        replyTo={replyTo}
        replyText={replyText}
        editingMsgId={editingMsgId}
        onCancelReply={() => {
          setReplyTo(null);
          setReplyText('');
        }}
        onCancelEdit={() => {
          setEditingMsgId(null);
          setInputValue('');
        }}
      />

      <MessageInput
        inputValue={inputValue}
        recording={recording}
        recordingTime={recordingTime}
        showEmojiPicker={showEmojiPicker}
        ephemeralDuration={ephemeralDuration}
        onInputChange={handleInputChange}
        onSend={sendMsg}
        onFileSelect={sendFile}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onToggleEmojiPicker={() => setShowEmojiPicker((o) => !o)}
        onEmojiSelect={(emoji) => {
          setInputValue((v) => v + emoji);
          setShowEmojiPicker(false);
        }}
        onCloseEmojiPicker={() => setShowEmojiPicker(false)}
        onEphemeralChange={setEphemeralDuration}
        placeholder={chatWith ? 'Écrivez un message…' : 'Écrivez dans le groupe…'}
      />
      {currentAnimation && <MessageAnimation type={currentAnimation} onEnd={() => setCurrentAnimation(null)} />}
    </>
  );
}
