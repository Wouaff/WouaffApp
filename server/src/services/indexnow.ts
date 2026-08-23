import { SITE_URL } from './seo.js';

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const HOST = new URL(SITE_URL).host;

const ENDPOINTS = ['https://api.bing.com/indexnow/index', 'https://yandex.com/indexnow'];

let queue: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (!INDEXNOW_KEY || queue.length === 0) return;
  const urls = [...queue];
  queue = [];
  const body = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });
  for (const endpoint of ENDPOINTS) {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
    }).catch(() => {});
  }
}

export function notifyIndexNow(path: string) {
  if (!INDEXNOW_KEY) return;
  const url = `${SITE_URL}${path}`;
  queue.push(url);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 2000);
}

export function indexNowKeyFileContent(): string {
  return INDEXNOW_KEY;
}
