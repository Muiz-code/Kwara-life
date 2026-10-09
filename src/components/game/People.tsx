"use client";
// Playing together, on screen: the "People here" chip, the sheet listing other players at your place (with
// your switches, invites, reactions, block and report), the card for an invite that comes in, and the link
// that keeps it all up to date and runs the activity once both of you are in. No chat anywhere: invites are
// fixed cards, answers are Accept or Not today, and reactions are a short fixed list.
import { MoreHorizontal, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { PLACE as ILORIN_PLACE } from "@/data/ilorin/places";
import { EMOTES, INVITE_LIMITS, TOGETHER_BY_ID, type TogetherId } from "@/data/together";
import {
  POLL_MS, REPORT_REASONS, answerInvite, blockPlayer, markApplied, poll, react, reportPlayer, sendInvite, setSwitches, simulated,
  togetherStore, useTogether,
} from "@/net/together";
import { currentLga } from "@/sim/journey";
import { hourOf, worldT } from "@/sim/time";
import { activitiesAt, inviteProblem, togetherAction, type Invite, type Player } from "@/sim/together";
import { getGameStore, isBusy, useGame } from "@/store";
import { Button, Sheet, cx, naira } from "./ui";

const toast = (msg: string) => getGameStore().setState((s) => ({ toasts: [...s.toasts, msg] }));
/** "45 minutes", "1 hour", "2 hours". */
const hoursOf = (min: number) => (min < 60 ? `${min} minutes` : `${Math.round(min / 60)} hour${Math.round(min / 60) > 1 ? "s" : ""}`);
const glyph = (id: string) => EMOTES.find((e) => e.id === id)?.glyph ?? "👋";

/** Where the player is: the place id, its kind and its name. */
function usePlace() {
  const loc = useGame((s) => s.game.loc);
  const world = useGame((s) => s.world);
  const p = world?.places.find((x) => x.id === loc) ?? ILORIN_PLACE[loc];
  return { placeId: loc, kind: (p?.kind as string) ?? "", name: p?.name ?? "here" };
}

/** Keeps the people and invites up to date, and runs an activity once both players are in. Mount once. */
export function TogetherLink({ panelOpen }: { panelOpen: boolean }) {
  const lga = useGame((s) => currentLga(s.game));
  const busy = useGame((s) => isBusy(s));
  const { placeId, kind } = usePlace();
  const answers = useTogether((s) => s.answers);

  useEffect(() => {
    if (!lga) return;
    // Against the real server this is only a slow fallback, and only while the People panel is open.
    if (!simulated && !panelOpen) return;
    const run = () => void poll(lga, placeId, kind, busy);
    run();
    const id = setInterval(run, POLL_MS);
    return () => clearInterval(id);
  }, [lga, placeId, kind, busy, panelOpen]);

  // An answer to one of my invites: on yes we do it (I pay), on no a quiet "Not today".
  useEffect(() => {
    if (!answers.length) return;
    togetherStore.setState({ answers: [] });
    for (const a of answers) {
      const t = TOGETHER_BY_ID[a.invite.activity];
      if (!a.accepted) {
        toast(`${a.nickname}: Not today`);
        continue;
      }
      if (!markApplied(a.invite.id)) continue;
      const why = getGameStore().getState().doTogether(togetherAction(a.invite.activity, "host", a.nickname), performance.now());
      toast(why ? `${a.nickname} said yes, but ${why.toLowerCase()}` : `${a.nickname} said yes to ${t.invite}`);
    }
  }, [answers]);
  return null;
}

/** The chip on the map: how many people are here, and the reactions coming in. */
export function PeopleChip({ onOpen }: { onOpen: () => void }) {
  const here = useTogether((s) => s.here);
  const inbox = useTogether((s) => s.inbox.length);
  const all = useTogether((s) => s.reactions);
  const reactions = useMemo(() => all.filter((r) => r.from !== "You").slice(-3), [all]);
  return (
    <div className="pointer-events-auto flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 rounded-2xl border-2 border-ink/25 bg-panel px-3 py-1.5 text-sm font-bold text-ink shadow-md hover:brightness-105"
      >
        <Users aria-hidden className="h-4 w-4" />
        People here {here.length ? `(${here.length})` : ""}
        {inbox > 0 && <span className="rounded-full bg-danger px-1.5 text-xs text-white">{inbox}</span>}
      </button>
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white"
          >
            {r.from} {glyph(r.emote)}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** The People sheet: switches, who is here, invites, reactions, block and report. */
export function PeopleSheet({ onClose }: { onClose: () => void }) {
  const s = useTogether((x) => x);
  const game = useGame((x) => x.game);
  const { placeId, kind, name } = usePlace();
  const hour = hourOf(worldT(game));
  const offers = useMemo(() => activitiesAt(kind), [kind]);
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const blocked = useMemo(() => new Set(s.blocked), [s.blocked]);
  const me = { id: "me", openDates: s.openDates };

  const invite = async (p: Player, activity: TogetherId) => {
    const why = inviteProblem({
      me, them: p, activity, placeId, placeKind: kind, hour, blocked,
      sentLastHour: s.sentTimes.length, declinesToday: s.declines[p.id] ?? 0, pending: !!s.sent[p.id],
    });
    if (why) return setMsg(why);
    const t = TOGETHER_BY_ID[activity];
    if (t.cost > game.money) return setMsg(`You need ${naira(t.cost)} to treat ${p.nickname}`);
    const e = await sendInvite(p, activity, placeId);
    setMsg(e ?? `Invite sent. Waiting for ${p.nickname}`);
    setOpen(null);
  };

  return (
    <Sheet title={`People at ${name}`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Switch label="Open to invites" on={s.openInvites} onChange={(v) => void setSwitches({ openInvites: v, openDates: v && s.openDates })} />
        <Switch label="Open to dates" on={s.openDates} disabled={!s.openInvites} onChange={(v) => void setSwitches({ openInvites: s.openInvites, openDates: v })} />
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        Only players at the same place see you, by your game name. No chat: invites and quick reactions only. Block or report anyone from the
        <MoreHorizontal aria-hidden className="mx-0.5 inline h-3 w-3" /> menu.
        {simulated && <b className="text-laterite"> Dev build: these are simulated players.</b>}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {EMOTES.map((e) => (
          <button key={e.id} type="button" onClick={() => void react(e.id, placeId)} className="rounded-full bg-panel-2 px-2.5 py-1 text-sm font-semibold hover:brightness-95">
            {e.glyph} {e.label}
          </button>
        ))}
      </div>

      {msg && <p className="mb-2 rounded-xl bg-panel-2 p-2 text-sm font-semibold">{msg}</p>}

      {!s.here.length ? (
        <p className="text-sm text-ink-soft">Nobody else is here right now. Try the market, the buka or the viewing centre.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {s.here.map((p) => (
            <li key={p.id} className="rounded-2xl border-2 border-line p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow" style={{ background: `linear-gradient(${p.look.skin} 45%, ${p.look.cloth} 45%)` }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{p.nickname}</b>
                  <span className="text-xs text-ink-soft">
                    {p.busy ? "Busy" : p.openInvites ? (p.openDates ? "Open to invites and dates" : "Open to invites") : "Not taking invites"}
                    {s.sent[p.id] && " · waiting for their answer"}
                  </span>
                </div>
                <Button
                  tone="ghost"
                  className="!px-3 !py-1.5 text-sm"
                  disabled={!p.openInvites || p.busy || !!s.sent[p.id] || !offers.length}
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                >
                  Invite
                </Button>
                <button type="button" aria-label={`More for ${p.nickname}`} onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-full p-1.5 hover:bg-panel-2">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              {open === p.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {offers
                    .filter((t) => !t.date || (p.openDates && s.openDates))
                    .map((t) => (
                      <button key={t.id} type="button" onClick={() => void invite(p, t.id)} className="rounded-xl bg-indigo px-3 py-1.5 text-sm font-bold text-[#F7E7C1]">
                        {t.label} {t.cost ? `· ${naira(t.cost)}` : "· free"}
                      </button>
                    ))}
                  {!offers.length && <span className="text-sm text-ink-soft">Nothing to do together here. Try a buka, lounge or viewing centre.</span>}
                </div>
              )}
              {menu === p.id && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  <button type="button" className="rounded-xl bg-danger px-3 py-1.5 font-bold text-white" onClick={() => void blockPlayer(p).then(() => setMsg(`${p.nickname} is blocked. You will not see each other.`))}>
                    Block
                  </button>
                  {REPORT_REASONS.map((r) => (
                    <button key={r} type="button" className="rounded-xl bg-panel-2 px-3 py-1.5 font-semibold" onClick={() => void reportPlayer(p, r).then(() => setMsg("Thanks. We will look into it."))}>
                      Report: {r}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-soft">
        The one who invites pays for both. Up to {INVITE_LIMITS.perHour} invites an hour; an invite lapses after {INVITE_LIMITS.expireS / 60} minutes.
      </p>
    </Sheet>
  );
}

function Switch({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold disabled:opacity-50", on ? "border-[#0E7A4B]" : "border-line")}
    >
      {label}
      <span className={cx("h-5 w-9 rounded-full p-0.5 transition-colors", on ? "bg-[#0E7A4B]" : "bg-line")}>
        <span className={cx("block h-4 w-4 rounded-full bg-white transition-transform", on && "translate-x-4")} />
      </span>
    </button>
  );
}

/** An invite that has come in: Accept or Not today. */
export function InviteCard() {
  const invite = useTogether((s) => s.inbox[0] as Invite | undefined);
  const { name } = usePlace();
  const [busy, setBusy] = useState(false);
  if (!invite) return null;
  const t = TOGETHER_BY_ID[invite.activity];
  const answer = async (accept: boolean) => {
    setBusy(true);
    const e = await answerInvite(invite, accept);
    setBusy(false);
    if (e) return toast(e);
    if (!accept) return;
    if (!markApplied(invite.id)) return;
    const why = getGameStore().getState().doTogether(togetherAction(invite.activity, "guest", invite.from.nickname), performance.now());
    if (why) toast(why);
  };
  return (
    <motion.div
      key={invite.id}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="pointer-events-auto fixed inset-x-0 bottom-24 z-40 mx-auto w-[min(92vw,26rem)] rounded-3xl bg-panel p-4 text-ink shadow-2xl"
      role="alertdialog"
      aria-label="An invite"
    >
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">An invite</p>
      <p className="mt-1 text-lg">
        <b>{invite.from.nickname}</b> is inviting you to <b>{t.invite}</b> here at {name}.
      </p>
      <p className="text-sm text-ink-soft">
        {t.cost ? `${invite.from.nickname} is paying.` : "It's free."} About {hoursOf(t.dur)} of game time.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="ghost" disabled={busy} onClick={() => void answer(false)}>
          Not today
        </Button>
        <Button disabled={busy} onClick={() => void answer(true)}>
          Accept
        </Button>
      </div>
    </motion.div>
  );
}
