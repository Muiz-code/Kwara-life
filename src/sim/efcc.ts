// EFCC: risky money builds heat; heat brings raids (or, for the connected, an "invitation").
// Crime news never names a party and uses no real names.
import { CAREERS } from "../data/careers";
import { LGA } from "../data/geography";
import { advance } from "./needs";
import { pick, type Rng } from "./rng";
import { book } from "./bank";
import { log, naira, note, type GameState } from "./state";

export const HEAT_DECAY_PER_DAY = 2;
export const CUSTODY_DAYS = 2;

/** Chance of EFCC coming today. */
export const efccChance = (heat: number) => Math.min(0.6, heat / 200);

const FICTIONAL_OFFICIALS = ["Alhaji B. Danladi", "Chief O. Adeyemo", "Hon. C. Okafor", "Dr. T. Ebiere", "Engr. M. Garba", "Barr. F. Okon"];
const FORMER = ["former commissioner", "ex-council chairman", "former permanent secretary", "former local government chairman"];

export function addNews(s: GameState, line: string) {
  s.localNews.unshift(line);
  if (s.localNews.length > 12) s.localNews.length = 12;
}

/** Mutates s: once a game day. Heat cools; EFCC may come. Also adds the odd EFCC headline about officials. */
export function efccDaily(s: GameState, rng: Rng) {
  const c = s.citizen;
  if (rng() < 0.08) {
    const amount = 1 + Math.floor(rng() * 9);
    addNews(s, `EFCC invites ${pick(rng, FORMER)} ${pick(rng, FICTIONAL_OFFICIALS)} over N${amount}bn contract`);
  }
  if (!c) return;
  s.heat = Math.max(0, s.heat - HEAT_DECAY_PER_DAY);
  if (s.heat <= 0 || rng() >= efccChance(s.heat)) return;
  if (CAREERS[c.career].connected) {
    note(s, "EFCC invitation", "A letter from the EFCC: they want you to \"honour their invitation\" and explain some payments.", [
      { label: "Honour it with your lawyer", id: "efcc-honour" },
      { label: "Ignore it", id: "efcc-ignore" },
    ]);
    return;
  }
  note(s, "EFCC raid", "Vans outside. Operatives at the gate. Somebody shouts your name.", [
    { label: "Run through the back", id: "efcc-run" },
    { label: "Hide in the ceiling", id: "efcc-hide" },
    { label: "Surrender", id: "efcc-surrender" },
  ]);
}

/** Mutates s: the answer to an EFCC visit. */
export function resolveEfcc(s: GameState, answer: "honour" | "ignore" | "run" | "hide" | "surrender", rng: Rng) {
  const c = s.citizen;
  if (!c) return;
  const lga = LGA[c.lgaCode]?.name ?? "town";
  const caught = (share: number) => {
    const lost = Math.round(s.money * share);
    book(s, -lost, "Seized by the EFCC", "fines");
    s.heat = 0;
    advance(s, CUSTODY_DAYS * 1440, rng);
    const what = c.career === "launderer" ? "a suspected money launderer" : "suspected internet fraudsters";
    addNews(s, `EFCC arrests ${what} in ${lga}, recovers phones, laptops and cars`);
    log(s, `EFCC arrested you. They seized ${naira(lost)} and you spent ${CUSTODY_DAYS} days in custody.`);
    note(s, "Arrested by EFCC", `They seized ${naira(lost)} and your devices. You are out on administrative bail. Keep a low profile.`);
  };
  switch (answer) {
    case "honour":
      book(s, -Math.round(s.money * 0.1), "EFCC fine", "fines");
      s.heat = Math.max(0, s.heat - 30);
      advance(s, 480, rng);
      log(s, "You spent the day at the EFCC office with your lawyer. Legal fees took a tenth of your money.");
      return;
    case "ignore":
      s.heat = Math.min(100, s.heat + 20);
      log(s, "You ignored the EFCC invitation. The papers are talking.");
      addNews(s, `EFCC says a "politically exposed person" in ${lga} has refused its invitation`);
      return;
    case "run":
      if (rng() < 0.55) {
        s.heat = Math.max(0, s.heat - 10);
        log(s, "You jumped the back fence and ran. They did not catch you, this time.");
        return;
      }
      return caught(0.7);
    case "hide":
      if (rng() < 0.35) {
        log(s, "You hid in the ceiling until they left. Your heart is still racing.");
        return;
      }
      return caught(0.7);
    case "surrender":
      return caught(0.5);
  }
}
