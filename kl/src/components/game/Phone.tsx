"use client";
// The Phone tab: journal, news, job openings and your profile.
import { useState } from "react";
import { CAREERS, EDUCATION_LABEL } from "@/data/careers";
import { LGA } from "@/data/geography";
import { CLASS_LABEL } from "@/data/jobs";
import { NEWS } from "@/data/media";
import { dayNum, fmtTime, openings } from "@/sim";
import { getGameStore, useGame } from "@/store";
import { Button, Sheet, cx, naira } from "./ui";

type Screen = "journal" | "news" | "jobs" | "me";

export function PhonePanel({ onClose }: { onClose: () => void }) {
  const [screen, setScreen] = useState<Screen>("journal");
  const tabs: [Screen, string][] = [
    ["journal", "Journal"],
    ["news", "News"],
    ["jobs", "Jobs"],
    ["me", "Me"],
  ];
  return (
    <Sheet title="Phone" onClose={onClose}>
      <div className="mb-3 flex gap-1 rounded-full bg-panel-2 p-1">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setScreen(id)} className={cx("flex-1 rounded-full py-1.5 text-sm font-bold", screen === id ? "bg-indigo text-[#F7E7C1]" : "text-ink-soft")}>
            {label}
          </button>
        ))}
      </div>
      {screen === "journal" && <Journal />}
      {screen === "news" && <News />}
      {screen === "jobs" && <Jobs />}
      {screen === "me" && <Me />}
    </Sheet>
  );
}

function Journal() {
  const log = useGame((s) => s.game.log);
  if (!log.length) return <p className="text-sm text-ink-soft">Nothing yet. Tap a place on the map to start your day.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {log.slice(0, 20).map((e, i) => (
        <li key={i} className="py-2">
          <time className="block text-xs font-bold text-ink-soft">
            Day {dayNum(e.t)}, {fmtTime(e.t)}
          </time>
          {e.msg}
        </li>
      ))}
    </ul>
  );
}

function News() {
  const local = useGame((s) => s.game.localNews);
  return (
    <ul className="divide-y divide-line text-sm">
      {[...local, ...NEWS].map((n, i) => (
        <li key={i} className="py-2 font-semibold">
          {n}
        </li>
      ))}
    </ul>
  );
}

function Jobs() {
  const game = useGame((s) => s.game);
  const [msg, setMsg] = useState<string | null>(null);
  const c = game.citizen;
  if (!c) return null;
  const list = openings(game.at ?? c.lgaCode, dayNum(game.t));
  return (
    <div>
      <p className="mb-2 text-sm text-ink-soft">
        Openings in {LGA[game.at ?? c.lgaCode].name} this week. Printing your CV costs ₦500. Employers reply in a few days.
      </p>
      {game.applications.length > 0 && (
        <p className="mb-2 rounded-xl bg-panel-2 p-2 text-sm font-semibold">Waiting to hear back: {game.applications.map((a) => a.title).join(", ")}</p>
      )}
      <ul className="space-y-2">
        {list.map((o) => (
          <li key={o.id} className="rounded-2xl bg-panel-2 p-3 text-sm">
            <b className="block">{o.title}</b>
            {naira(o.monthly)} a month · {o.minEducation === "none" ? "no certificate needed" : `needs ${EDUCATION_LABEL[o.minEducation]}`} · {o.applicants} applicants
            <Button small className="mt-2 block" onClick={() => setMsg(getGameStore().getState().applyJob(o) ?? "Applied. Wait for their call.")}>
              Apply
            </Button>
          </li>
        ))}
      </ul>
      {msg && <p className="mt-2 text-sm font-bold">{msg}</p>}
    </div>
  );
}

function Me() {
  const game = useGame((s) => s.game);
  const c = game.citizen;
  if (!c) return null;
  const rows: [string, string][] = [
    ["Name", c.name],
    ["Class", CLASS_LABEL[c.cls]],
    ["Job", `${c.job}${c.employed ? "" : " (looking for work)"}`],
    ["Career", CAREERS[c.career].label],
    ["Pay", c.monthlyPay ? `${naira(c.monthlyPay)} a month` : "Depends on the day"],
    ["School", EDUCATION_LABEL[c.education]],
    ["Home", c.home],
    ["Registered in", LGA[c.lgaCode].name],
    ["Now in", LGA[game.at ?? c.lgaCode].name],
    ["PVC", c.pvc === "have" ? "Collected" : c.pvc === "registered" ? "Registered, not collected" : c.pvc === "seized" ? "Seized" : "Not registered"],
    ["Informed", String(game.informed)],
    ["Civic", String(game.civic)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-bold text-ink-soft">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
