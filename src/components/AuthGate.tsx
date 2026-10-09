"use client";
// Sign in before you play: one account, one citizen, one vote. Sign up with an email, a password and a
// public username and a date of birth (18 and over only; the date is checked, never kept); sign in with the email or the username (through /api/auth/signin, which keeps emails
// private and limits guessing). The email is confirmed before the first sign-in. Supabase checks every new account too (supabase/migrations: the
// sign-up guard refuses throwaway inboxes and a second account for the same mailbox).
// A build without Supabase settings skips this screen and plays offline.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { CalendarCheck, Eye, Smartphone, EyeOff, KeyRound, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { online, supabase } from "@/net/supabase";
import { getGameStore, setAccount } from "@/store";
import { retryHere, signOutHere, startSync, useBlocked } from "@/net/sync";
import { UNDER_AGE, dobProblem, dobString, lagosToday } from "@/sim/age";
import Loader from "./game/Loader";

type Mode = "signin" | "signup" | "forgot" | "newpass";

/** Why a password won't do, or null. Supabase enforces its own minimum too (set it to 8 in the dashboard). */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Use at least 8 characters";
  if (p.length > 72) return "Keep it under 72 characters";
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return "Mix letters and numbers";
  return null;
}

/** A password box with an eye button to show or hide what was typed. */
function PasswordInput({ value, onChange, autoComplete, show, onToggle, className }: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  show: boolean;
  onToggle: () => void;
  className: string;
}) {
  const Icon = show ? EyeOff : Eye;
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-[calc(50%-2px)] items-center justify-center rounded-lg text-[#F7E7C1]/70 hover:text-[#F7E7C1]"
      >
        <Icon aria-hidden className="h-5 w-5" />
      </button>
    </div>
  );
}

type Dob = { d: number; m: number; y: number };
const NO_DOB: Dob = { d: 0, m: 0, y: 0 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day, month and year boxes: easier than a calendar picker on a phone, for a date decades back. */
function DobInput({ value, onChange, className }: { value: Dob; onChange: (v: Dob) => void; className: string }) {
  const thisYear = lagosToday()[0];
  const years = Array.from({ length: 100 }, (_, i) => thisYear - i);
  const box = `${className} appearance-none [&>option]:text-[#141B33]`;
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.4fr] gap-2">
      <select aria-label="Day" autoComplete="bday-day" value={value.d} onChange={(e) => onChange({ ...value, d: +e.target.value })} className={box}>
        <option value={0}>Day</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select aria-label="Month" autoComplete="bday-month" value={value.m} onChange={(e) => onChange({ ...value, m: +e.target.value })} className={box}>
        <option value={0}>Month</option>
        {MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select aria-label="Year" autoComplete="bday-year" value={value.y} onChange={(e) => onChange({ ...value, y: +e.target.value })} className={box}>
        <option value={0}>Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

/** What to say under the date boxes once all three are picked, or null. */
const dobNote = (v: Dob) => (v.d && v.m && v.y ? dobProblem(v.y, v.m, v.d) : null);

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

/** The same first checks the database makes (supabase/migrations: username_problem); it has the final say. */
export function usernameProblem(u: string): string | null {
  const n = u.trim().toLowerCase();
  if (n.length < 3) return "Use at least 3 characters";
  if (n.length > 20) return "Keep it to 20 characters";
  if (!/^[a-z0-9_]+$/.test(n)) return "Use only letters, numbers and _";
  if (!/[a-z]/.test(n)) return "Use at least one letter";
  return null;
}

/** Supabase's messages, in plain words for players. */
function friendly(message: string): string {
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent you";
  if (/invalid login credentials/i.test(message)) return "Wrong email or password";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a few minutes and try again";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists. Sign in instead";
  return message;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(online() ? undefined : null);
  const [mode, setMode] = useState<Mode>("signin");

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Back from a "reset your password" email: ask for the new one before playing.
      if (event === "PASSWORD_RECOVERY") setMode("newpass");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!online()) return <>{children}</>;
  if (session === undefined) return <Loader done={false} label="Loading Naija Votes…" />;
  if (session && mode !== "newpass") {
    return (
      <AgeGate key={session.user.id}>
        {/* This account's own save; a different account remounts the game with its own life. */}
        <Account id={session.user.id}>{children}</Account>
      </AgeGate>
    );
  }
  return <AuthScreen mode={mode} setMode={setMode} onDone={() => setMode("signin")} />;
}

function Account({ id, children }: { id: string; children: ReactNode }) {
  setAccount(id);
  // Keep this account's game in step with the server while it plays.
  useEffect(() => startSync(getGameStore(), id), [id]);
  const blocked = useBlocked();
  if (blocked)
    return (
      <AuthShell onSubmit={retryHere}>
        <h1 className="mb-3 flex items-center gap-2 font-bold">
          <Smartphone aria-hidden className="h-5 w-5 text-[#F2B705]" />
          Playing on another device
        </h1>
        <p className="mb-4 text-sm">{blocked} One person, one citizen, one device at a time.</p>
        <button type="submit" className="w-full rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33]">I have logged out there. Try again</button>
        <button type="button" onClick={() => void signOutHere()} className="mt-4 text-sm font-semibold underline">
          Log out here instead
        </button>
      </AuthShell>
    );
  return <Fragment key={id}>{children}</Fragment>;
}

type AgeStatus = "confirmed" | "locked" | "needed" | "error";

/** 18 and over only. New accounts confirmed at sign-up; older ones confirm here once before they play. */
function AgeGate({ children }: { children: ReactNode }) {
  const sb = supabase()!;
  const [status, setStatus] = useState<AgeStatus | undefined>(undefined);
  const [tries, setTries] = useState(0);
  const [dob, setDob] = useState<Dob>(NO_DOB);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    sb.rpc("my_age_status").then(({ data, error: e }) => {
      if (live) setStatus(e ? "error" : (data as AgeStatus));
    });
    return () => {
      live = false;
    };
  }, [sb, tries]);

  if (status === "confirmed") return <>{children}</>;
  if (status === undefined) return <Loader done={false} label="Loading Naija Votes…" />;

  const confirm = async () => {
    const why = dobProblem(dob.y, dob.m, dob.d);
    if (why && why !== UNDER_AGE) return setError(why);
    setBusy(true);
    setError(null);
    try {
      const { data, error: e } = await sb.rpc("confirm_age", { dob: dobString(dob.y, dob.m, dob.d) });
      if (e) return setError("No connection. Check your data and try again");
      const r = data as { ok: boolean; locked?: boolean; reason?: string };
      if (r.ok) setStatus("confirmed");
      else if (r.locked) setStatus("locked");
      else setError(r.reason ?? "Try again");
    } catch {
      setError("No connection. Check your data and try again");
    } finally {
      setBusy(false);
    }
  };
  const note = dobNote(dob);
  const field = "mt-1 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-[#F7E7C1]";
  const signOut = (
    <button type="button" onClick={() => void sb.auth.signOut()} className="mt-4 text-sm font-semibold underline">
      Sign out
    </button>
  );

  return (
    <AuthShell
      onSubmit={() => {
        if (status === "needed" && !busy) void confirm();
        if (status === "error") setTries((n) => n + 1);
      }}
    >
      <h1 className="mb-3 flex items-center gap-2 font-bold">
        <CalendarCheck aria-hidden className="h-5 w-5 text-[#F2B705]" />
        {status === "locked" ? "18 and over only" : "Confirm your age"}
      </h1>
      {status === "locked" && <p className="text-sm">{UNDER_AGE}, the same as voting age in Nigeria. Come back when you turn 18.</p>}
      {status === "error" && (
        <>
          <p className="mb-3 text-sm">We couldn&apos;t check your account. Check your data and try again.</p>
          <button type="submit" className="w-full rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33]">Try again</button>
        </>
      )}
      {status === "needed" && (
        <>
          <p className="mb-3 text-sm opacity-90">
            Naija Votes is for players aged 18 and over. Enter your date of birth once to keep playing. We check it and don&apos;t keep it.
          </p>
          <div className="mb-3 text-sm font-semibold">
            Date of birth
            <DobInput value={dob} onChange={setDob} className={field} />
            {note && <span className="mt-1 block text-xs font-semibold text-[#FF9C8A]">{note}</span>}
          </div>
          {error && <p className="mb-3 text-sm font-semibold text-[#FF9C8A]">{error}</p>}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33] transition disabled:opacity-50">
            {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </>
      )}
      {signOut}
    </AuthShell>
  );
}

/** The sign-in screen's backdrop, title and card. */
function AuthShell({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#2B3A6B,#141B33_70%)] p-4 text-[#F7E7C1]">
      <div className="pointer-events-none absolute h-[160vmax] w-[160vmax] animate-[spin_60s_linear_infinite] bg-[repeating-conic-gradient(rgba(17,138,79,0.16)_0deg_10deg,transparent_10deg_20deg)] motion-reduce:animate-none" />
      <form
        className="relative w-full max-w-sm rounded-3xl bg-[#141B33]/85 p-6 shadow-2xl backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="mb-4 text-center">
          <div className="font-sign text-5xl leading-none drop-shadow-[0_4px_0_#0A0E1E]">Naija Votes</div>
          <div className="mt-1 text-sm font-semibold opacity-80">One account, one citizen, one vote. 18+ only.</div>
        </div>
        {children}
      </form>
    </div>
  );
}

function AuthScreen({ mode, setMode, onDone }: { mode: Mode; setMode: (m: Mode) => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nameCheck, setNameCheck] = useState<{ name: string; ok: boolean; reason?: string } | null>(null);
  const [dob, setDob] = useState<Dob>(NO_DOB);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const sb = supabase()!;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (mode !== "signup") return;
    const name = username.trim().toLowerCase();
    if (usernameProblem(name)) return;
    const t = setTimeout(async () => {
      const { data } = await sb.rpc("username_available", { name });
      if (data) setNameCheck({ name, ...(data as { ok: boolean; reason?: string }) });
    }, 400);
    return () => clearTimeout(t);
  }, [mode, username, sb]);
  const nameNote = (() => {
    const name = username.trim().toLowerCase();
    if (!name) return null;
    const local = usernameProblem(name);
    if (local) return { ok: false, text: local };
    if (nameCheck?.name !== name) return null;
    return nameCheck.ok ? { ok: true, text: `@${name} is free` } : { ok: false, text: nameCheck.reason ?? "Try another" };
  })();

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setUnconfirmed(false);
  };

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const why = await fn();
      if (why) setError(friendly(why));
    } catch {
      setError("No connection. Check your data and try again");
    } finally {
      setBusy(false);
    }
  };

  const signIn = () =>
    run(async () => {
      const login = email.trim();
      if (!login) return "Enter your email or username";
      if (!password) return "Enter your password";
      // Through our server, which can turn a username into its email without showing it to anyone.
      const res = await fetch("/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password }) });
      const r = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string; unconfirmed?: boolean };
      if (r.unconfirmed) setUnconfirmed(login.includes("@"));
      if (!res.ok || !r.access_token || !r.refresh_token) return r.error ?? "Sign-in failed. Try again";
      const { error: e } = await sb.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      return e?.message ?? null;
    });

  const signUp = () =>
    run(async () => {
      if (!emailOk(email)) return "Enter a valid email address";
      const badName = usernameProblem(username);
      if (badName) return badName;
      if (nameNote && !nameNote.ok) return nameNote.text;
      const badDob = dobProblem(dob.y, dob.m, dob.d);
      if (badDob) return badDob;
      const weak = passwordProblem(password);
      if (weak) return weak;
      if (password !== confirm) return "The two passwords don't match";
      const { data, error: e } = await sb.auth.signUp({
        email: email.trim(),
        password,
        // The sign-up guard checks the username and the date of birth again. The profile is made from the
        // username; the date is thrown away as the account is made (only "18+ confirmed" is kept).
        options: { emailRedirectTo: origin, data: { username: username.trim().toLowerCase(), dob: dobString(dob.y, dob.m, dob.d) } },
      });
      if (e) return e.message;
      // With email confirmation on there is no session yet: the player must open the link first.
      if (!data.session) {
        setInfo(`We sent a confirmation link to ${email.trim()}. Open it, then sign in here with your email or @${username.trim().toLowerCase()}.`);
        setMode("signin");
        setPassword("");
        setConfirm("");
      }
      return null;
    });

  const resend = () =>
    run(async () => {
      const { error: e } = await sb.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: origin } });
      if (!e) setInfo("Sent again. Check your inbox and spam folder.");
      return e?.message ?? null;
    });

  const forgot = () =>
    run(async () => {
      if (!emailOk(email)) return "Enter your email address";
      const { error: e } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: origin });
      // Same answer whether or not the account exists, so the form can't be used to find accounts.
      if (!e) setInfo("If that email has an account, a reset link is on its way.");
      return e?.message ?? null;
    });

  const newPassword = () =>
    run(async () => {
      const weak = passwordProblem(password);
      if (weak) return weak;
      if (password !== confirm) return "The two passwords don't match";
      const { error: e } = await sb.auth.updateUser({ password });
      if (!e) onDone();
      return e?.message ?? null;
    });

  const submit = { signin: signIn, signup: signUp, forgot, newpass: newPassword }[mode];
  const title = { signin: "Sign in", signup: "Create your account", forgot: "Reset your password", newpass: "Choose a new password" }[mode];
  const Icon = { signin: LogIn, signup: UserPlus, forgot: Mail, newpass: KeyRound }[mode];
  const field = "mt-1 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-[#F7E7C1] placeholder:text-[#F7E7C1]/40";

  return (
    <AuthShell
      onSubmit={() => {
        if (!busy) void submit();
      }}
    >
      <h1 className="mb-3 flex items-center gap-2 font-bold">
        <Icon aria-hidden className="h-5 w-5 text-[#F2B705]" />
        {title}
      </h1>

      {mode === "signin" && (
        <label className="mb-3 block text-sm font-semibold">
          Email or username
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="you@example.com or tunde_ib"
          />
        </label>
      )}
      {(mode === "signup" || mode === "forgot") && (
        <label className="mb-3 block text-sm font-semibold">
          Email
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@example.com" />
        </label>
      )}
      {mode === "signup" && (
        <label className="mb-3 block text-sm font-semibold">
          Username <span className="font-normal opacity-70">(your public name in the game)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60">@</span>
            <input
              type="text"
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className={`${field} pl-7`}
              placeholder="tunde_ib"
            />
          </div>
          {nameNote && <span className={`mt-1 block text-xs font-semibold ${nameNote.ok ? "text-[#8FE3B0]" : "text-[#FF9C8A]"}`}>{nameNote.text}</span>}
        </label>
      )}
      {mode === "signup" && (
        <div className="mb-3 text-sm font-semibold">
          Date of birth <span className="font-normal opacity-70">(18+ only; we check it and don&apos;t keep it)</span>
          <DobInput value={dob} onChange={setDob} className={field} />
          {dobNote(dob) && <span className="mt-1 block text-xs font-semibold text-[#FF9C8A]">{dobNote(dob)}</span>}
        </div>
      )}
      {mode !== "forgot" && (
        <label className="mb-3 block text-sm font-semibold">
          {mode === "newpass" ? "New password" : "Password"}
          <PasswordInput
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={setPassword}
            show={showPass}
            onToggle={() => setShowPass((v) => !v)}
            className={field}
          />
        </label>
      )}
      {(mode === "signup" || mode === "newpass") && (
        <>
          <label className="mb-1 block text-sm font-semibold">
            Type it again
            <PasswordInput autoComplete="new-password" value={confirm} onChange={setConfirm} show={showPass} onToggle={() => setShowPass((v) => !v)} className={field} />
          </label>
          <p className="mb-3 text-xs opacity-70">At least 8 characters, with letters and numbers.</p>
        </>
      )}

      {error && <p className="mb-3 text-sm font-semibold text-[#FF9C8A]">{error}</p>}
      {info && <p className="mb-3 text-sm font-semibold text-[#8FE3B0]">{info}</p>}
      {unconfirmed && (
        <button type="button" onClick={() => void resend()} disabled={busy} className="mb-3 text-sm font-semibold underline">
          Send the confirmation email again
        </button>
      )}

      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F2B705] py-3 font-bold text-[#141B33] transition disabled:opacity-50">
        {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
        {{ signin: "Sign in", signup: "Create account", forgot: "Send reset link", newpass: "Save password" }[mode]}
      </button>

      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => go("signup")} className="font-semibold underline">New here? Create an account</button>
            <button type="button" onClick={() => go("forgot")} className="opacity-80 underline">Forgot password?</button>
          </>
        ) : mode !== "newpass" ? (
          <button type="button" onClick={() => go("signin")} className="font-semibold underline">Back to sign in</button>
        ) : null}
      </div>
    </AuthShell>
  );
}
