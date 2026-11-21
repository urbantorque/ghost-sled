// Round 8, the photo lane: where the Spirit Album's frames are kept. Not in the save: the save is a few hundred KB of
// JSON in localStorage or CrazyGames' data (1 MB there), and a frame is an image. Frames live in this browser's
// IndexedDB, one small WebP (a JPEG where WebP cannot be written) a sticker, keyed by the sticker's id with the run it
// came on, so a frame left from a save since reset is never shown for a sticker earned again. A browser without
// IndexedDB, a private window that refuses it, or another device keeps the album as it was: painted cards.

const DB = 'ghostsled-album';
const STORE = 'frames';
const VERSION = 1;

export interface StoredFrame {
  id: string;
  /** The run (save.runs) the sticker came on. */
  run: number;
  blob: Blob;
}

let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Keeps a sticker's frame (replacing an older one). Resolves false when it could not be kept. */
export async function putFrame(f: StoredFrame): Promise<boolean> {
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(f);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Every frame kept, by sticker id. Resolves empty when there is no store, or after `timeoutMs` (the album opens on
 *  its painted cards rather than wait). */
export async function allFrames(timeoutMs = 600): Promise<Map<string, StoredFrame>> {
  const out = new Map<string, StoredFrame>();
  const read = (async () => {
    const db = await open();
    if (!db) return out;
    return new Promise<Map<string, StoredFrame>>((resolve) => {
      try {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => {
          for (const f of req.result as StoredFrame[]) if (f && typeof f.id === 'string' && f.blob instanceof Blob) out.set(f.id, f);
          resolve(out);
        };
        req.onerror = () => resolve(out);
      } catch {
        resolve(out);
      }
    });
  })();
  return Promise.race([read, new Promise<Map<string, StoredFrame>>((r) => setTimeout(() => r(new Map()), timeoutMs))]);
}

/** Bytes kept, for the notes and play-tests. */
export async function framesSize(): Promise<{ count: number; bytes: number }> {
  const all = await allFrames(3000);
  let bytes = 0;
  for (const f of all.values()) bytes += f.blob.size;
  return { count: all.size, bytes };
}
