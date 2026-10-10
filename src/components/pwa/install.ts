"use client";
// Installing the game as an app. Chrome on Android (and desktop) offers its own install box, which we hold on to
// and open from our Install button; iPhone Safari has none, so we show how to add it from the Share menu.
// Installed, it opens full screen from the home screen; the website keeps working in the browser as before.
import { useSyncExternalStore } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallEvent | null = null;
let helpOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export type Platform = "ios" | "android" | "desktop";

export function platform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "desktop";
}

/** Opened inside WhatsApp, Instagram, Facebook or similar: those can't install, the player must open a browser. */
export const inAppBrowser = () => typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok/i.test(navigator.userAgent);

/** Already running as the installed app. */
export function installed(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Hold on to the browser's own install box so our button can open it later. */
export function listenForInstall() {
  const take = (e: Event) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  };
  const done = () => {
    deferred = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", take);
  window.addEventListener("appinstalled", done);
  return () => {
    window.removeEventListener("beforeinstallprompt", take);
    window.removeEventListener("appinstalled", done);
  };
}

/** The browser can install right now with one tap (Chrome, Edge, Samsung Internet). */
export const useCanPrompt = () => useSyncExternalStore(subscribe, () => deferred !== null, () => false);

/** Open the browser's install box. True if the player installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  emit();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}

// ---- The "how to install" sheet, openable from anywhere (the banner, the menu) ----

export const useHelpOpen = () => useSyncExternalStore(subscribe, () => helpOpen, () => false);
export function openInstallHelp(open = true) {
  helpOpen = open;
  emit();
}

// ---- Not nagging ----

const KEY = "nv-install-later";
/** After "Not now" the banner stays away this long. */
export const LATER_MS = 3 * 24 * 3600_000;

export function snoozed(now = Date.now()): boolean {
  try {
    return now - Number(localStorage.getItem(KEY) ?? 0) < LATER_MS;
  } catch {
    return false;
  }
}
export function snooze(now = Date.now()) {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked: the banner may come back next visit, which is fine.
  }
}
