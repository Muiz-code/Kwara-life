"use client";
// Sign in before you play: one account, one citizen, one vote. Sign up with an email, a password and a
// public username; sign in with the email or the username (through /api/auth/signin, which keeps emails
// private and limits guessing). The email is confirmed before the first sign-in. Supabase checks every new account too (supabase/migrations: the
// sign-up guard refuses throwaway inboxes and a second account for the same mailbox).
// A build without Supabase settings skips this screen and plays offline.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { online, supabase } from "@/net/supabase";
import { setAccount } from "@/store";
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
    // This account's own save; a different account remounts the game with its own life.
    setAccount(session.user.id);
    return <Fragment key={session.user.id}>{children}</Fragment>;
  }
  return <AuthScreen mode={mode} setMode={setMode} onDone={() => setMode("signin")} />;
}

function AuthScreen({ mode, setMode, onDone }: { mode: Mode; setMode: (m: Mode) => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nameCheck, setNameCheck] = useState<{ name: string; ok: boolean; reason?: string } | null>(null);
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
      const weak = passwordProblem(password);
      if (weak) return weak;
      if (password !== confirm) return "The two passwords don't match";
      const { data, error: e } = await sb.auth.signUp({
        email: email.trim(),
        password,
        // The sign-up guard checks the username again and the profile is made from it.
        options: { emailRedirectTo: origin, data: { username: username.trim().toLowerCase() } },
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#2B3A6B,#141B33_70%)] p-4 text-[#F7E7C1]">
      <div className="pointer-events-none absolute h-[160vmax] w-[160vmax] animate-[spin_60s_linear_infinite] bg-[repeating-conic-gradient(rgba(17,138,79,0.16)_0deg_10deg,transparent_10deg_20deg)] motion-reduce:animate-none" />
      <form
        className="relative w-full max-w-sm rounded-3xl bg-[#141B33]/85 p-6 shadow-2xl backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <div className="mb-4 text-center">
          <div className="font-sign text-5xl leading-none drop-shadow-[0_4px_0_#0A0E1E]">Naija Votes</div>
          <div className="mt-1 text-sm font-semibold opacity-80">One account, one citizen, one vote.</div>
        </div>
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
      </form>
    </div>
  );
}
