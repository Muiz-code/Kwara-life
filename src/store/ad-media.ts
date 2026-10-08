"use client";
// Video ads, kept in this browser's IndexedDB: localStorage holds a few megabytes of text at most, far
// too little for video. Until the ads service exists (docs/HANDOVER.md, Phase E) only this device sees
// them; the server will store them and serve them from the CDN instead.
import { MAX_VIDEO_BYTES, VIDEO_TYPES } from "../data/boards";
import { MAX_VIDEO_SECONDS } from "../data/ads";

const DB = "nv-ad-media";
const STORE = "videos";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    if (typeof indexedDB === "undefined") return fail(new Error("This browser can't store videos"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error ?? new Error("Video storage is blocked in this browser"));
  });
}

function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((ok, fail) => {
        const tx = db.transaction(STORE, mode);
        const req = act(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          ok(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          fail(tx.error ?? new Error("Could not save the video"));
        };
      }),
  );
}

/** Save a video; returns the id the booking keeps. */
export async function saveVideo(blob: Blob): Promise<string> {
  const id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await run("readwrite", (s) => s.put(blob, id));
  return id;
}

export const loadVideo = (id: string): Promise<Blob | undefined> => run<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>).catch(() => undefined);

export const deleteVideo = (id: string): Promise<void> => run("readwrite", (s) => s.delete(id)).then(() => undefined).catch(() => undefined);

/** Object URLs for saved videos, made once each. */
const urls = new Map<string, Promise<string | null>>();
export function videoUrl(id: string): Promise<string | null> {
  let p = urls.get(id);
  if (!p) urls.set(id, (p = loadVideo(id).then((b) => (b ? URL.createObjectURL(b) : null))));
  return p;
}

/** Why a video can't go on a smart screen, or null. Reads its length from the file itself. */
export async function videoProblem(file: File): Promise<string | null> {
  if (!VIDEO_TYPES.includes(file.type)) return "Use an MP4 or WebM video";
  if (file.size > MAX_VIDEO_BYTES) return `Keep the video under ${MAX_VIDEO_BYTES / 1024 / 1024} MB`;
  const url = URL.createObjectURL(file);
  try {
    const seconds = await new Promise<number>((ok, fail) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => ok(v.duration);
      v.onerror = () => fail(new Error("We can't play that video. Try an MP4"));
      v.src = url;
    });
    if (!Number.isFinite(seconds) || seconds <= 0) return "We can't read how long that video is. Try an MP4";
    if (seconds > MAX_VIDEO_SECONDS + 0.5) return `Keep the video to ${MAX_VIDEO_SECONDS} seconds`;
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    URL.revokeObjectURL(url);
  }
}
