import type { Server } from 'socket.io';
import type { NotificationType } from '../types/index.js';
import { sendNewUserAlert, sendSqlInjectionAlertData } from './discordWebhook.js';
import { getLastEmailError, sendPasswordResetEmail, sendVerificationEmail } from './email.js';
import { createNotification } from './notifications.js';
import { registerJobHandler } from './queue.js';

let ioRef: Server | null = null;

export function setQueueIo(io: Server): void {
  ioRef = io;
}

/* Envoi d'email : lève une erreur si l'envoi échoue, pour déclencher le retry de la file (backoff) */
async function sendEmailOrThrow(send: () => Promise<boolean>): Promise<void> {
  const sent = await send();
  if (!sent) {
    throw new Error(getLastEmailError() || "Echec de l'envoi de l'email");
  }
}

export function registerQueueHandlers(): void {
  /* Emails (vérification / reset), avec retries en cas de panne SMTP */
  registerJobHandler('email', async (payload) => {
    const kind = payload.kind as string;
    const to = String(payload.to ?? '');
    if (kind === 'verify') {
      await sendEmailOrThrow(() => sendVerificationEmail(to, String(payload.code ?? '')));
    } else if (kind === 'reset') {
      await sendEmailOrThrow(() => sendPasswordResetEmail(to, String(payload.token ?? '')));
    }
  });

  /* Notifications (like / repost / comment / follow), INSERT + SELECT + emit découplés de la requête */
  registerJobHandler('notification', async (payload) => {
    await createNotification(ioRef, {
      uid: payload.uid as string,
      actorUid: payload.actorUid as string,
      type: payload.type as NotificationType,
      postId: payload.postId as string | undefined,
      commentId: payload.commentId as number | undefined,
    });
  });

  /* Webhooks Discord (nouvelle inscription / alerte SQL), rate-limit via la file */
  registerJobHandler('webhook', async (payload) => {
    const kind = payload.kind as string;
    if (kind === 'newUser') {
      await sendNewUserAlert(payload.data as { pseudo: string; wouaffId: string; uid: string });
    } else if (kind === 'sqlAlert') {
      await sendSqlInjectionAlertData(payload.data as Record<string, unknown>);
    }
  });
}
