"use client";
// The Campaign tab (support cards and promotion) and the flyer and vote-buying screens.
import { useMemo, useState } from "react";
import { PRESIDENTIAL_2027 as CAL, campaigningAllowed } from "@/data/calendar";
import { DAILY_PROMO_CAP, ISSUES, MAX_ISSUES, NOTE_MAX, PROMO } from "@/data/campaign";
import { PARTIES, PARTY } from "@/data/parties";
import { AMOUNTS, CIVIC_PROMO, GROUPS, catchRisk, simulatedCards, sponsoredLine, spentToday, watDate } from "@/sim";
import { useCampaignFeed } from "@/net/feed";
import { getGameStore, useGame } from "@/store";
import { Button, Modal, Sheet, cx, naira, useNow } from "./ui";

function PartySelect({ value, onChange, civic }: { value: string; onChange: (v: string) => void; civic?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2">
      {civic && <option value="civic">Civic message: go out and vote</option>}
      {PARTIES.map((p) => (
        <option key={p.code} value={p.code}>
          {p.code}, {p.name}
        </option>
      ))}
    </select>
  );
}

export function CampaignPanel({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const now = useNow(10_000);
  const open = campaigningAllowed(CAL, now);
  const postedToday = game.supportCards.some((c) => c.day === watDate(now));
  const [party, setParty] = useState(PARTIES[0].code);
  const [issues, setIssues] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [promo, setPromo] = useState(false);
  // Real players in your LGA from the server (your own cards show once, from your game); simulated supporters
  // only while the server feed is empty or out of reach.
  const server = useCampaignFeed(game.citizen?.lgaCode);
  const feed = useMemo(() => {
    const me = game.citizen?.name ?? "You";
    const mine = game.supportCards.map((c) => ({ ...c, by: me, place: "", simulated: false })).reverse();
    const others = (server?.cards ?? [])
      .filter((c) => Object.hasOwn(PARTY, c.party) && !(c.by === me && game.supportCards.some((m) => m.day === c.day)))
      .map((c) => ({ ...c, place: "", simulated: false }));
    return [...mine, ...others, ...(others.length ? [] : simulatedCards(7, 8))];
  }, [game.supportCards, game.citizen, server]);

  return (
    <Sheet title="Campaign" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-soft">No chat. Post one support card a day: the party you back and why. Your support is public; your vote is secret.</p>
      {!open ? (
        <p className="font-bold text-danger">Campaigning has ended. All campaigns stop 24 hours before election day.</p>
      ) : postedToday ? (
        <p className="rounded-xl bg-panel-2 p-3 text-sm font-semibold">You have posted today. Come back tomorrow.</p>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-bold">
            I support
            <PartySelect value={party} onChange={setParty} />
          </label>
          <div className="text-sm font-bold">Because of (up to {MAX_ISSUES})</div>
          <div className="flex flex-wrap gap-1.5">
            {ISSUES.map((i) => {
              const on = issues.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setIssues(on ? issues.filter((x) => x !== i) : issues.length < MAX_ISSUES ? [...issues, i] : issues)}
                  className={cx("rounded-full border px-3 py-1 text-sm font-semibold", on ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2")}
                >
                  {i}
                </button>
              );
            })}
          </div>
          <label className="block text-sm font-bold">
            Short note ({NOTE_MAX} characters)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} className="mt-1 block w-full rounded-xl border border-line bg-panel-2 px-3 py-2" />
          </label>
          <Button className="w-full" onClick={() => setMsg(getGameStore().getState().postCard({ party, issues, note }) ?? "Posted. Thank you.")}>
            Post support card
          </Button>
          {msg && <p className="text-sm font-semibold">{msg}</p>}
        </div>
      )}

      <h3 className="mt-5 mb-2 font-sign text-xl">Promote</h3>
      <p className="text-sm text-ink-soft">
        Same prices for every party, paid in game money only. Daily cap {naira(DAILY_PROMO_CAP)}; spent today {naira(spentToday(game, now))}.
      </p>
      <div className="mt-2 flex gap-2">
        <Button tone="keke" small disabled={!open} onClick={() => setPromo(true)}>
          Sponsored news
        </Button>
      </div>
      {promo && <PromoModal kind="news" onClose={() => setPromo(false)} />}

      {!!server?.sponsored.length && (
        <>
          <h3 className="mt-5 mb-2 font-sign text-xl">Sponsored today</h3>
          <ul className="space-y-1 text-sm">
            {server.sponsored
              .filter((p) => p.party === CIVIC_PROMO || Object.hasOwn(PARTY, p.party))
              .map((p, i) => (
                <li key={i} className="rounded-lg bg-panel-2 px-2 py-1">
                  {sponsoredLine({ kind: p.kind, option: p.option, party: p.party, price: 0, day: "", lgaCode: "" }, p.by)}
                </li>
              ))}
          </ul>
        </>
      )}

      <h3 className="mt-5 mb-2 font-sign text-xl">Support cards</h3>
      <ul className="divide-y divide-line text-sm">
        {feed.map((c, i) => (
          <li key={i} className="flex gap-2 py-2">
            <span className="h-fit rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: PARTY[c.party].colour }}>
              {c.party}
            </span>
            <div>
              <b>{c.by}</b> {c.simulated && <small className="text-ink-soft">(simulated)</small>} {c.place && <small className="text-ink-soft">{c.place}</small>}
              <br />
              Supports {PARTY[c.party].name} for {c.issues.join(", ") || "a better Nigeria"}.{c.note && ` "${c.note}"`}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function PromoModal({ kind, onClose }: { kind: "flyer" | "news"; onClose: () => void }) {
  const money = useGame((s) => s.game.money);
  const [party, setParty] = useState("civic");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title={kind === "flyer" ? "Post flyers" : "Sponsored news"}>
      <label className="block text-sm font-bold">
        Promote
        <PartySelect value={party} onChange={setParty} civic />
      </label>
      <div className="mt-3 flex flex-col gap-2">
        {PROMO[kind].map((o, i) => (
          <button
            key={o.label}
            type="button"
            disabled={o.price > money}
            onClick={() => {
              const e = getGameStore().getState().promote({ kind, option: i, party });
              if (e) setErr(e);
              else onClose();
            }}
            className="rounded-2xl bg-panel-2 px-3 py-2.5 text-left disabled:opacity-50"
          >
            <b className="block">{o.label}</b>
            <small>{naira(o.price)}</small>
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-sm font-bold text-danger">{err}</p>}
      <Button tone="ghost" className="mt-3 w-full" onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}

export function BribeModal({ onClose }: { onClose: () => void }) {
  const money = useGame((s) => s.game.money);
  const [party, setParty] = useState(PARTIES[0].code);
  const [a, setA] = useState(1);
  const [g, setG] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const total = AMOUNTS[a] * GROUPS[g];
  return (
    <Modal title="Offer money for votes">
      <p className="mb-3 text-sm font-bold text-danger">
        Vote buying is a crime under the Electoral Act. If you are caught you lose the money, pay a fine, lose your PVC and spend time in custody. Ballots are
        secret, so you can never check how anyone voted.
      </p>
      <label className="block text-sm font-bold">
        For which party
        <PartySelect value={party} onChange={setParty} />
      </label>
      <div className="mt-3 text-sm font-bold">Money per person</div>
      <div className="flex gap-2">
        {AMOUNTS.map((x, i) => (
          <button key={x} type="button" aria-pressed={a === i} onClick={() => setA(i)} className={cx("rounded-full border px-3 py-1.5 text-sm font-bold", a === i ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2")}>
            {naira(x)}
          </button>
        ))}
      </div>
      <div className="mt-3 text-sm font-bold">How many people</div>
      <div className="flex gap-2">
        {GROUPS.map((x, i) => (
          <button key={x} type="button" aria-pressed={g === i} onClick={() => setG(i)} className={cx("rounded-full border px-3 py-1.5 text-sm font-bold", g === i ? "border-indigo bg-indigo text-[#F7E7C1]" : "border-line bg-panel-2")}>
            {x}
          </button>
        ))}
      </div>
      <p className="mt-3">
        <b>Total {naira(total)}</b>. Chance of getting caught: about {catchRisk(AMOUNTS[a], GROUPS[g])}%.
      </p>
      {err && <p className="mt-2 text-sm font-bold text-danger">{err}</p>}
      <div className="mt-3 flex flex-col gap-2">
        <Button
          tone="danger"
          disabled={total > money}
          onClick={() => {
            const e = getGameStore().getState().buyVotes({ party, perPerson: AMOUNTS[a], people: GROUPS[g] });
            if (e) setErr(e);
            else onClose();
          }}
        >
          {total > money ? "Not enough money" : "Share the money"}
        </Button>
        <Button tone="ghost" onClick={onClose}>
          Walk away
        </Button>
      </div>
    </Modal>
  );
}
