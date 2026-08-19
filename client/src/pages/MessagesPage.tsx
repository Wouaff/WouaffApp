import { MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LeftNav from '../components/Home/LeftNav';
import { type ChatTarget, ChatWindow } from '../components/Messages/ChatWindow';
import ConversationList, { type ConvListItem } from '../components/Messages/ConversationList';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { conversations, groups as groupsApi, messages as messagesApi } from '../services/api';
import { resetMessagesUnread, setActiveConversation } from '../services/messagesUnread';
import {
  emitSeen,
  joinDM,
  joinGroup,
  leaveDM,
  leaveGroup,
  offMessageAdded,
  offMessageRemoved,
  offMessageUpdated,
  offTyping,
  onMessageAdded,
  onMessageRemoved,
  onMessageUpdated,
  onTyping,
} from '../services/socket';
import type { MessageData } from '../types';

function chatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

interface ConvRaw {
  profile?: Record<string, unknown>;
  group?: Record<string, unknown>;
  lastMsg?: MessageData | null;
  lastTime?: number;
  type?: string;
}

function buildDms(data: Record<string, ConvRaw>): ConvListItem[] {
  return Object.entries(data)
    .map(([uid, c]) => {
      const p = c.profile || {};
      const name = (p.pseudo as string) || uid;
      return {
        id: uid,
        type: 'dm' as const,
        name,
        avatar: (p.avatar as string) || undefined,
        lastMsg: c.lastMsg || null,
        lastTime: c.lastTime || 0,
        online: p.status === 'online',
      };
    })
    .sort((a, b) => b.lastTime - a.lastTime);
}

function buildGroups(data: Record<string, ConvRaw>): ConvListItem[] {
  return Object.entries(data)
    .map(([gid, c]) => {
      const g = c.group || {};
      const members = (g.members as Record<string, unknown>) || {};
      return {
        id: gid,
        type: 'group' as const,
        name: (g.name as string) || 'Groupe',
        avatar: (g.icon as string) || undefined,
        lastMsg: c.lastMsg || null,
        lastTime: c.lastTime || 0,
        memberCount: Object.keys(members).length,
      };
    })
    .sort((a, b) => b.lastTime - a.lastTime);
}

export default function MessagesPage() {
  const { user } = useAuth();
  const meUid = user?.uid || '';
  const myPseudo = user?.pseudo || '';
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();

  const [dms, setDms] = useState<ConvListItem[]>([]);
  const [groups, setGroups] = useState<ConvListItem[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  const [active, setActive] = useState<ChatTarget | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageData>>({});
  const [hasMore, setHasMore] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [typingFrom, setTypingFrom] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  const seenMarked = useRef<Set<string>>(new Set());
  const inflightProfiles = useRef<Set<string>>(new Set());
  const activeRef = useRef<ChatTarget | null>(null);
  activeRef.current = active;

  /* ── Chargement des conversations ── */
  const loadConversations = useCallback(async () => {
    try {
      const data = (await conversations.list()) as { dms: Record<string, ConvRaw>; groups: Record<string, ConvRaw> };
      setDms(buildDms(data.dms || {}));
      setGroups(buildGroups(data.groups || {}));
    } catch {
      /* erreur silencieuse */
    }
    setLoadingConvs(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* ── Ouverture d'une conversation ── */
  const fetchMessages = useCallback(async (target: ChatTarget, before?: number) => {
    setMessagesLoading(true);
    try {
      const isGroup = target.type === 'group';
      const res = isGroup
        ? await messagesApi.listGroup(target.id, 50, before)
        : await messagesApi.list(target.id, 50, before);
      const list = (res.messages as unknown as Record<string, MessageData>) || {};
      setMessages((prev) => {
        if (before) return { ...list, ...prev };
        return list;
      });
      setHasMore(!!res.hasMore);
      seenMarked.current.clear();
    } catch {
      /* erreur */
    }
    setMessagesLoading(false);
  }, []);

  const selectConversation = useCallback(
    async (id: string, type: 'dm' | 'group') => {
      if (activeRef.current && activeRef.current.type === 'dm') leaveDM();
      if (activeRef.current && activeRef.current.type === 'group') leaveGroup();

      let target: ChatTarget;
      if (type === 'group') {
        const found = groups.find((g) => g.id === id);
        target = {
          id,
          type: 'group',
          name: found?.name || 'Groupe',
          avatar: found?.avatar,
          memberCount: found?.memberCount,
        };
        joinGroup(id);
      } else {
        let found = dms.find((d) => d.id === id);
        if (!found) {
          const res = (await fetch(`/api/profiles/${encodeURIComponent(id)}`).then((r) => r.json())) as {
            pseudo?: string;
            avatar?: string;
            status?: string;
          };
          found = {
            id,
            type: 'dm',
            name: res.pseudo || id,
            avatar: res.avatar,
            online: res.status === 'online',
            lastMsg: null,
            lastTime: 0,
          };
          setDms((prev) => [found!, ...prev.filter((d) => d.id !== id)]);
        }
        target = { id, type: 'dm', name: found.name, avatar: found.avatar, online: found.online };
        joinDM(id);
      }

      setActive(target);
      setTypingFrom(null);
      setMessages({});
      setHasMore(false);
      setActiveConversation(target.type === 'group' ? target.id : chatId(meUid, target.id));
      resetMessagesUnread();
      fetchMessages(target);

      if (type === 'group') {
        groupsApi
          .get(id)
          .then((g) => {
            const count = Object.keys((g.members as Record<string, unknown>) || {}).length;
            setGroups((prev) => prev.map((x) => (x.id === id ? { ...x, memberCount: count } : x)));
            setActive((a) => (a && a.id === id ? { ...a, memberCount: count } : a));
          })
          .catch(() => {});
      }
    },
    [dms, groups, meUid, fetchMessages],
  );

  /* ── Ouverture via URL ?uid= / ?gid= (une seule fois) ── */
  const openedOnce = useRef(false);
  useEffect(() => {
    if (openedOnce.current) return;
    openedOnce.current = true;
    const uid = searchParams.get('uid');
    const gid = searchParams.get('gid');
    if (uid && meUid) void selectConversation(uid, 'dm');
    else if (gid) void selectConversation(gid, 'group');
  }, [searchParams, meUid, selectConversation]);

  /* ── Envoi ── */
  const send = useCallback(
    async (text: string, imageData?: string) => {
      if (!activeRef.current || !meUid) return;
      const target = activeRef.current;
      const payload: Record<string, unknown> = {
        text: text || undefined,
        type: 'text',
        senderName: myPseudo || undefined,
      };
      if (imageData) payload.imageData = imageData;
      try {
        const isGroup = target.type === 'group';
        const res = (
          isGroup ? await messagesApi.sendGroup(target.id, payload) : await messagesApi.send(target.id, payload)
        ) as { key: string } & MessageData;
        setMessages((prev) => (prev[res.key] ? prev : { ...prev, [res.key]: res }));
        if (isGroup) {
          setGroups((prev) =>
            prev
              .map((g) => (g.id === target.id ? { ...g, lastMsg: res, lastTime: Date.now() } : g))
              .sort((a, b) => b.lastTime - a.lastTime),
          );
        } else {
          const cid = chatId(meUid, target.id);
          setDms((prev) =>
            prev
              .map((d) => (d.id === target.id ? { ...d, lastMsg: res, lastTime: Date.now() } : d))
              .sort((a, b) => b.lastTime - a.lastTime),
          );
          void cid;
        }
      } catch {
        /* erreur d'envoi */
      }
    },
    [meUid, myPseudo],
  );

  /* ── Réception temps réel ── */
  useEffect(() => {
    const onAdded = (ev: { convId: string; key: string; data: MessageData; isGroup?: boolean }) => {
      const target = activeRef.current;
      const targetCid = target ? (target.type === 'group' ? target.id : chatId(meUid, target.id)) : null;
      if (target && ev.convId === targetCid) {
        setMessages((prev) => (prev[ev.key] ? prev : { ...prev, [ev.key]: ev.data }));
        if (ev.data.from !== meUid) setTypingFrom(null);
        loadConversations();
      } else {
        loadConversations();
      }
    };

    const onUpdated = (ev: { convId: string; key: string; data: MessageData; isGroup?: boolean }) => {
      const target = activeRef.current;
      const targetCid = target ? (target.type === 'group' ? target.id : chatId(meUid, target.id)) : null;
      if (target && ev.convId === targetCid) {
        setMessages((prev) => {
          const cur = prev[ev.key];
          if (!cur) return prev;
          return { ...prev, [ev.key]: { ...cur, ...ev.data } };
        });
      }
    };

    const onRemoved = (ev: { convId: string; key: string }) => {
      const target = activeRef.current;
      const targetCid = target ? (target.type === 'group' ? target.id : chatId(meUid, target.id)) : null;
      if (target && ev.convId === targetCid) {
        setMessages((prev) => {
          const next = { ...prev };
          delete next[ev.key];
          return next;
        });
      }
    };

    const onType = (ev: { from: string; isTyping: boolean }) => {
      if (ev.from === meUid) return;
      setTypingFrom(ev.isTyping ? ev.from : null);
    };

    onMessageAdded(onAdded);
    onMessageUpdated(onUpdated);
    onMessageRemoved(onRemoved);
    onTyping(onType);
    return () => {
      offMessageAdded(onAdded);
      offMessageUpdated(onUpdated);
      offMessageRemoved(onRemoved);
      offTyping(onType);
    };
  }, [meUid, loadConversations]);

  /* ── Marquage lu ── */
  useEffect(() => {
    const target = active;
    if (!target || !meUid) return;
    const isGroup = target.type === 'group';
    const cid = isGroup ? target.id : chatId(meUid, target.id);
    const keys = Object.entries(messages)
      .filter(([k, m]) => m.from !== meUid && !m.deleted && !m.seen && !seenMarked.current.has(k))
      .map(([k]) => k);
    if (keys.length === 0) return;
    for (const k of keys) seenMarked.current.add(k);
    if (isGroup) {
      messagesApi.seenGroup(target.id, keys).catch(() => {});
    } else {
      messagesApi.seen(target.id, keys).catch(() => {});
      emitSeen(target.id, keys);
      void cid;
    }
  }, [active, messages, meUid]);

  /* ── Résolution des pseudos de groupe (auteurs inconnus) ── */
  useEffect(() => {
    const unknown = new Set<string>();
    for (const m of Object.values(messages)) {
      if (!m.from || m.from === meUid || m.from === 'pendingFrom') continue;
      if (senderNames[m.from] || inflightProfiles.current.has(m.from)) continue;
      unknown.add(m.from);
    }
    for (const from of unknown) {
      inflightProfiles.current.add(from);
      fetch(`/api/profiles/${encodeURIComponent(from)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p: { pseudo?: string } | null) => {
          if (p?.pseudo) setSenderNames((prev) => ({ ...prev, [from]: p.pseudo as string }));
        })
        .finally(() => inflightProfiles.current.delete(from));
    }
  }, [messages, senderNames, meUid]);

  /* ── Nettoyage ── */
  useEffect(() => {
    return () => {
      leaveDM();
      leaveGroup();
      setActiveConversation(null);
    };
  }, []);

  const typingLabel = typingFrom ? senderNames[typingFrom] || typingFrom : null;

  return (
    <div className="flex h-full">
      <LeftNav />
      <main className="flex-1 min-w-0 h-full border-x border-[var(--border)] bg-[var(--bg-deep)] flex overflow-hidden">
        <div
          className={`w-full md:w-[340px] md:flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-base)] flex-col ${
            isMobile && active ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            dms={dms}
            groups={groups}
            activeId={active?.id || null}
            typingMap={active ? { [active.id]: typingLabel } : {}}
            onSelect={selectConversation}
            onStartConversation={(uid) => void selectConversation(uid, 'dm')}
            onOpenGroup={(gid) => void selectConversation(gid, 'group')}
          />
        </div>

        <div className={`flex-1 min-w-0 flex-col ${isMobile && !active ? 'hidden md:flex' : 'flex'}`}>
          {active ? (
            <ChatWindow
              conv={active}
              meUid={meUid}
              myPseudo={myPseudo}
              senderNames={senderNames}
              messages={messages}
              hasMore={hasMore}
              loading={loadingConvs || messagesLoading}
              typing={typingLabel}
              onLoadMore={() => {
                const t = activeRef.current;
                if (!t) return;
                const minTime = Object.values(messages).reduce((m, x) => (x.time < m ? x.time : m), Infinity);
                if (Number.isFinite(minTime)) fetchMessages(t, minTime);
              }}
              onSend={send}
              onBack={() => {
                setActive(null);
                setMessages({});
                setActiveConversation(null);
              }}
            />
          ) : (
            <div className="chat-placeholder">
              <div className="chat-placeholder-content">
                <MessageCircle size={40} />
                <p className="m-0" style={{ fontWeight: 600 }}>
                  Choisissez une conversation
                </p>
                <p className="m-0" style={{ fontSize: 13 }}>
                  Sélectionnez un message privé ou un groupe pour discuter.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
