/* ── E2EE CRYPTO MODULE (ECDH P-256 + AES-256-GCM) ──
 * Ported from assets/js/crypto.js for React + TypeScript
 */

/* La clé privée n'est jamais stockée en clair : elle est conservée sous forme
 * de CryptoKey non-exportable dans IndexedDB. Un XSS ne peut donc pas l'exfiltrer
 * (il ne peut au mieux que s'en servir dans l'onglet compromis). */
const LEGACY_KEY = 'wouaff_e2ee';
const IDB_NAME = 'wouaff-e2ee';
const IDB_STORE = 'keys';
const IDB_RECORD = 'keypair';

interface StoredKeyPair {
  privKey: CryptoKey;
  pubJwk: JsonWebKey;
}

let _privKey: CryptoKey | null = null;
let _pubKey: JsonWebKey | null = null;
const _keyCache = new Map<string, CryptoKey>();

function _openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Ouverture IndexedDB échouée'));
  });
}

async function _idbGet<T>(id: string): Promise<T | null> {
  const db = await _openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function _idbPut(value: StoredKeyPair, id: string): Promise<void> {
  const db = await _openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function _idbDelete(id: string): Promise<void> {
  const db = await _openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function _importPrivKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
}

async function _generateKeyPair(): Promise<{ privKey: CryptoKey; pubJwk: JsonWebKey }> {
  /* extractable=false : la clé privée ne peut plus être exportée. La clé publique
   * reste, elle, toujours exportable conformément à la spécification WebCrypto. */
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']);
  return {
    privKey: kp.privateKey,
    pubJwk: await crypto.subtle.exportKey('jwk', kp.publicKey),
  };
}

async function _loadStoredKeyPair(): Promise<StoredKeyPair | null> {
  try {
    const record = await _idbGet<StoredKeyPair>(IDB_RECORD);
    if (record?.privKey && record?.pubJwk) return record;
  } catch (e) {
    console.warn('E2EE : IndexedDB indisponible, clé privée non persistée', e);
    return null;
  }
  return _migrateLegacyKeyPair();
}

/* Migration de l'ancienne clé stockée en clair dans localStorage : elle est
 * ré-importée en clé non-exportable puis supprimée du localStorage. */
async function _migrateLegacyKeyPair(): Promise<StoredKeyPair | null> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { privJwk?: JsonWebKey; pubJwk?: JsonWebKey };
    if (!data?.privJwk || !data?.pubJwk) throw new Error('paire de clés héritée invalide');
    const privKey = await _importPrivKey(data.privJwk);
    await _idbPut({ privKey, pubJwk: data.pubJwk }, IDB_RECORD);
    localStorage.removeItem(LEGACY_KEY);
    return { privKey, pubJwk: data.pubJwk };
  } catch (e) {
    console.warn('E2EE : migration de la clé locale échouée', e);
    return null;
  }
}

async function _getAesKey(partnerPubJwk: JsonWebKey): Promise<CryptoKey> {
  if (!_privKey) throw new Error('E2EE not initialised');
  const key = JSON.stringify(partnerPubJwk);
  const cached = _keyCache.get(key);
  if (cached) return cached;
  const pub = await crypto.subtle.importKey('jwk', partnerPubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const aes = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    _privKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  _keyCache.set(key, aes);
  return aes;
}

/* ── Public API ── */

export async function initE2EE(
  _uid: string,
  _fetchPublicKeyFromAPI: (uid: string) => Promise<JsonWebKey | null>,
): Promise<void> {
  const stored = await _loadStoredKeyPair();
  if (stored) {
    _privKey = stored.privKey;
    _pubKey = stored.pubJwk;
    return;
  }
  const pair = await _generateKeyPair();
  _privKey = pair.privKey;
  _pubKey = pair.pubJwk;
  try {
    await _idbPut({ privKey: pair.privKey, pubJwk: pair.pubJwk }, IDB_RECORD);
  } catch (e) {
    console.warn('E2EE : persistance de la clé privée impossible', e);
  }
}

export function clearE2EE(): void {
  _keyCache.clear();
  _privKey = null;
  _pubKey = null;
}

/* Efface la clé privée persistée (déconnexion / changement de compte). */
export async function destroyE2EE(): Promise<void> {
  clearE2EE();
  try {
    await _idbDelete(IDB_RECORD);
  } catch {
    /* IndexedDB indisponible */
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export async function encrypt(partnerPubJwk: JsonWebKey, plaintext: string): Promise<{ ct: string; iv: string }> {
  const aes = await _getAesKey(partnerPubJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(plaintext));
  return {
    ct: btoa(String.fromCharCode(...new Uint8Array(enc))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decrypt(partnerPubJwk: JsonWebKey, ct: string, iv: string): Promise<string> {
  const aes = await _getAesKey(partnerPubJwk);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), (c) => c.charCodeAt(0)) },
    aes,
    Uint8Array.from(atob(ct), (c) => c.charCodeAt(0)),
  );
  return new TextDecoder().decode(raw);
}

export function encryptMessageData(
  msgData: Record<string, unknown>,
  partnerPubJwk: JsonWebKey,
): Promise<Record<string, unknown>> {
  return (async () => {
    let plaintext: string;
    if (msgData.type === 'image') {
      plaintext = (msgData.imageData as string) || '';
      delete msgData.imageData;
      msgData.text = '\u{1F512} Image';
    } else if (msgData.type === 'voice') {
      plaintext = (msgData.audioData as string) || '';
      delete msgData.audioData;
      msgData.text = '\u{1F512} Message vocal';
    } else if (msgData.type === 'file') {
      plaintext = JSON.stringify({ d: msgData.fileData || '', n: msgData.fileName || '' });
      delete msgData.fileData;
      delete msgData.fileName;
      msgData.text = '\u{1F512} Fichier';
    } else if (msgData.type === 'contact') {
      plaintext = JSON.stringify(msgData.contact || '');
      delete msgData.contact;
      msgData.text = '\u{1F512} Contact';
    } else {
      plaintext = (msgData.text as string) || '';
      msgData.text = '\u{1F512} Message chiffr\u00E9';
    }
    const { ct, iv } = await encrypt(partnerPubJwk, plaintext);
    msgData.ct = ct;
    msgData.iv = iv;
    msgData.encrypted = true;
    return msgData;
  })();
}

export function decryptMessageData(
  msg: Record<string, unknown>,
  partnerPubJwk: JsonWebKey,
): Promise<Record<string, unknown>> {
  return (async () => {
    if (!msg.encrypted || !msg.ct || !msg.iv) return msg;
    try {
      const pt = await decrypt(partnerPubJwk, msg.ct as string, msg.iv as string);
      if (msg.type === 'image') {
        msg.imageData = pt;
      } else if (msg.type === 'voice') {
        msg.audioData = pt;
      } else if (msg.type === 'file') {
        try {
          const p = JSON.parse(pt);
          msg.fileData = p.d;
          msg.fileName = p.n;
        } catch (e) {
          console.error(e);
        }
      } else if (msg.type === 'contact') {
        try {
          msg.contact = JSON.parse(pt);
        } catch (e) {
          console.error(e);
        }
      } else {
        msg.text = pt;
      }
      delete msg.ct;
      delete msg.iv;
      msg.encrypted = false;
    } catch (e) {
      console.warn('E2EE decrypt failed', e);
    }
    return msg;
  })();
}

export function getPublicKey(): JsonWebKey | null {
  return _pubKey;
}
