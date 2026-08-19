import type { SocketMessageEvent } from '../types';
import { onConnectionChange, onMessageAdded } from './socket';

let count = 0;
let activeConv: string | null = null;
let initialized = false;
type Sub = (count: number) => void;
const subs: Sub[] = [];

function dispatch(): void {
  window.dispatchEvent(new CustomEvent('wouaff:messages-unread', { detail: { count } }));
  for (const s of subs) s(count);
}

function handleMessageAdded(ev: SocketMessageEvent): void {
  if (ev.convId !== activeConv) {
    count += 1;
    dispatch();
  }
}

function register(): void {
  onMessageAdded(handleMessageAdded);
}

/* Doit être appelé après la connexion du socket (et à chaque reconnexion). */
export function initMessagesUnread(): void {
  if (initialized) return;
  initialized = true;
  register();
  onConnectionChange((connected) => {
    if (connected) register();
  });
}

export function setActiveConversation(convId: string | null): void {
  activeConv = convId;
}

export function resetMessagesUnread(): void {
  count = 0;
  dispatch();
}

export function getMessagesUnread(): number {
  return count;
}

export function subscribeMessagesUnread(cb: Sub): () => void {
  subs.push(cb);
  cb(count);
  return () => {
    const idx = subs.indexOf(cb);
    if (idx !== -1) subs.splice(idx, 1);
  };
}
