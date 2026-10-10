"use client";
// The game as an app: registers the service worker (public/sw.js), and invites players to install it. A small
// banner comes up once they have been playing for a minute (never on the first screens, never once installed,
// and not again for three days after "Not now"); the menu's "Install the app" opens the same how-to any time.
// The website keeps working in the browser exactly as before.
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasConsent } from "../Welcome";
import { online } from "@/net/supabase";
import { inAppBrowser, installed, listenForInstall, openInstallHelp, platform, promptInstall, snooze, snoozed, useCanPrompt, useHelpOpen } from "./install";

/** Past the terms and, with accounts, signed in. */
function playing(): boolean {
  if (!hasConsent()) return false;
  if (!online()) return true;
  try {
    return Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return false;
  }
}

/** How long someone plays before the banner asks. */
const ASK_AFTER_MS = 60_000;

export default function Pwa() {
  const path = usePathname();
  const [ask, setAsk] = useState(false);
  const helpOpen = useHelpOpen();

  useEffect(() => {
    // The service worker only in real builds (in dev it would hold on to old code), or with ?sw to try it.
    const want = process.env.NODE_ENV === "production" || new URLSearchParams(location.search).has("sw");
    if (want && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    return listenForInstall();
  }, []);

  useEffect(() => {
    if (path !== "/" || installed() || snoozed()) return;
    // Only once they are really playing: past the terms, signed in (when this build has accounts), then a minute.
    let since = 0;
    const id = setInterval(() => {
      if (!playing()) return void (since = 0);
      since ||= Date.now();
      if (Date.now() - since >= ASK_AFTER_MS) {
        clearInterval(id);
        setAsk(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [path]);

  return (
    <>
      {ask && !helpOpen && (
        <Banner
          onLater={() => {
            snooze();
            setAsk(false);
          }}
          onDone={() => setAsk(false)}
        />
      )}
      {helpOpen && <InstallHelp onClose={() => openInstallHelp(false)} />}
    </>
  );
}

function Banner({ onLater, onDone }: { onLater: () => void; onDone: () => void }) {
  const canPrompt = useCanPrompt();
  return (
    <div
      role="dialog"
      aria-label="Install Naija Votes"
      className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-[#141B33] p-3 text-[#F7E7C1] shadow-2xl"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Add Naija Votes to your phone</p>
          <p className="text-sm opacity-80">Full screen, faster on mobile data, and it opens straight from your home screen.</p>
        </div>
        <button type="button" onClick={onLater} aria-label="Not now" className="rounded-lg p-1 opacity-70 hover:opacity-100">
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={async () => {
            if (canPrompt) {
              await promptInstall();
              onDone();
            } else {
              onDone();
              openInstallHelp();
            }
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F2B705] py-2.5 font-bold text-[#141B33]"
        >
          <Download aria-hidden className="h-4 w-4" />
          {canPrompt ? "Install" : "Show me how"}
        </button>
        <button type="button" onClick={onLater} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold">
          Not now
        </button>
      </div>
    </div>
  );
}

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2B705] text-sm font-bold text-[#141B33]">{n}</span>
    <span className="pt-0.5">{children}</span>
  </li>
);
const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 align-middle font-bold">{children}</span>
);

/** How to install, for the phone in the player's hand. */
export function InstallHelp({ onClose }: { onClose: () => void }) {
  const canPrompt = useCanPrompt();
  const p = platform();
  const done = installed();
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Install Naija Votes" className="w-full max-w-sm rounded-3xl bg-[#141B33] p-5 text-[#F7E7C1] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <p className="font-sign text-2xl leading-none">Install Naija Votes</p>
            <p className="text-xs opacity-70">You can still play in the browser any time.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 opacity-70 hover:opacity-100">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {done ? (
          <p className="text-sm">It&apos;s installed. Open Naija Votes from your home screen.</p>
        ) : inAppBrowser() ? (
          <ol className="space-y-3 text-sm">
            <Step n={1}>You opened the game inside another app. Tap its menu <Key><MoreVertical aria-hidden className="h-3.5 w-3.5" /></Key> and choose <Key>Open in browser</Key>.</Step>
            <Step n={2}>In Chrome or Safari, open this menu again and follow the steps there.</Step>
          </ol>
        ) : canPrompt ? (
          <button
            type="button"
            onClick={async () => {
              if (await promptInstall()) onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33]"
          >
            <Download aria-hidden className="h-5 w-5" />
            Install now
          </button>
        ) : p === "ios" ? (
          <ol className="space-y-3 text-sm">
            <Step n={1}>Tap the Share button <Key><Share aria-hidden className="h-3.5 w-3.5" /></Key> at the bottom of Safari (in Chrome, it&apos;s at the top right).</Step>
            <Step n={2}>Scroll down and tap <Key><PlusSquare aria-hidden className="h-3.5 w-3.5" />Add to Home Screen</Key>.</Step>
            <Step n={3}>Tap <Key>Add</Key>. Naija Votes is now on your home screen.</Step>
          </ol>
        ) : p === "android" ? (
          <ol className="space-y-3 text-sm">
            <Step n={1}>Tap the menu <Key><MoreVertical aria-hidden className="h-3.5 w-3.5" /></Key> at the top right of Chrome.</Step>
            <Step n={2}>Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>.</Step>
            <Step n={3}>Tap <Key>Install</Key>. Naija Votes is now on your home screen.</Step>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm">
            <Step n={1}>Look for the install icon <Key><Download aria-hidden className="h-3.5 w-3.5" /></Key> at the right of the address bar, or open the browser menu.</Step>
            <Step n={2}>Choose <Key>Install Naija Votes</Key>.</Step>
          </ol>
        )}
      </div>
    </div>
  );
}
