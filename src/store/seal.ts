import type { StateStorage } from "zustand/middleware";

// The save sits in localStorage, where anyone can open DevTools and type in more money. Each save is
// written with a signature over its text; a save whose signature doesn't match was edited outside
// the game and is dropped, so the player starts fresh instead of loading the edit.
//
// The key ships in the bundle, so this stops casual editing, not a determined reverse engineer. The
// server is the real authority once Phase E lands: it keeps its own copy of everything that counts
// (citizen, money, votes) and never trusts a save.

const KEY = "nv27|ilorin|ballot-is-secret|7c1f";

/** cyrb53: a fast 53-bit string hash. */
function hash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const sign = (name: string, value: string) => hash(`${KEY}|${name}|${value}|${value.length}`, value.length) + hash(value, 0x9e3779b9);

/** Text as stored: signature, a dot, then the save. */
export const seal = (name: string, value: string) => `${sign(name, value)}.${value}`;

/** The save, or null if it is missing, unsigned or was edited. */
export function unseal(name: string, stored: string | null): string | null {
  if (!stored) return null;
  const dot = stored.indexOf(".");
  if (dot <= 0) return null;
  const value = stored.slice(dot + 1);
  return stored.slice(0, dot) === sign(name, value) ? value : null;
}

/** Wraps a storage so everything written is sealed and anything tampered with reads as empty. */
export function sealedStorage(base: StateStorage, onTampered?: (name: string) => void): StateStorage {
  return {
    getItem: (name) => {
      const stored = base.getItem(name) as string | null;
      const value = unseal(name, stored);
      if (stored && value === null) onTampered?.(name);
      return value;
    },
    setItem: (name, value) => base.setItem(name, seal(name, value)),
    removeItem: (name) => base.removeItem(name),
  };
}
