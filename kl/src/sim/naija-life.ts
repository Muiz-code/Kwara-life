// Everyday Nigeria: things that happen to everyone, once a game day at 7am.
// Each event starts with a small chance and lasts a few days. Headlines never name a party.
import { STATE } from "../data/states";
import { addNews } from "./efcc";
import { pick, type Rng } from "./rng";
import { log, naira, note, type GameState } from "./state";
import { dayNum } from "./time";

export const FUEL_FARE_FACTOR = 1.3;
export const POS_CHARGE = 200;
export const FLOOD_DELAY = 30;

const HEADLINES = [
  "Data prices go up again as telcos cite rising costs",
  "Naira slips at the parallel market",
  "Another doctor japas: hospitals count the cost",
  "Bread price rises for the third time this year",
  "Traders lament low sales as customers cut back",
  "Graduates queue for a recruitment test in a stadium",
  "Transport fares up after diesel price jump",
];

export const fuelScarcity = (s: GameState) => (s.events.fuelUntil ?? 0) >= dayNum(s.t);
export const cashScarcity = (s: GameState) => (s.events.cashUntil ?? 0) >= dayNum(s.t);
export const flooded = (s: GameState) => (s.events.floodUntil ?? 0) >= dayNum(s.t);

/** Mutates s: today's Nigeria. */
export function dailyLife(s: GameState, rng: Rng) {
  const c = s.citizen;
  const today = dayNum(s.t);
  const ev = s.events;

  if (!fuelScarcity(s) && rng() < 0.05) {
    ev.fuelUntil = today + 2 + Math.floor(rng() * 3);
    addNews(s, "Fuel queues return as stations hoard. Transport fares jump");
    note(s, "Fuel scarcity", "Long queues at every filling station. Keke and bus fares are up until it eases.");
  }
  if (!cashScarcity(s) && rng() < 0.03) {
    ev.cashUntil = today + 2 + Math.floor(rng() * 3);
    addNews(s, "Cash scarcity: POS agents charge more as banks ration notes");
    log(s, `Cash scarcity. POS agents are charging ${naira(POS_CHARGE)} extra on everything.`);
  }
  if (c && !flooded(s) && ["SS", "SE", "SW"].includes(STATE[c.stateCode].zone) && rng() < 0.03) {
    ev.floodUntil = today + 1 + Math.floor(rng() * 2);
    log(s, "Heavy rain flooded the roads. Every trip takes longer today.");
  }
  if (c && c.career === "student" && (ev.strikeUntil ?? 0) < today && rng() < 0.02) {
    ev.strikeUntil = today + 7 + Math.floor(rng() * 8);
    addNews(s, "ASUU declares strike over unpaid allowances");
    note(s, "ASUU strike", "Lecturers are on strike. No lectures until it is called off. Find something to do.");
  }
  if (c && c.career === "worker" && (ev.owedUntil ?? 0) < today && rng() < 0.03) {
    ev.owedUntil = today + 5 + Math.floor(rng() * 6);
    log(s, "Your employer says salaries will be \"a bit late\" this month.");
  }
  if (c && (ev.owedUntil ?? 0) === today - 1 && s.payOwed > 0) {
    s.money += s.payOwed;
    log(s, `Your owed salary finally came in: ${naira(s.payOwed)}.`);
    s.toasts.push("+" + naira(s.payOwed));
    s.payOwed = 0;
  }
  if (c && s.money > 20000 && rng() < 0.06) {
    const ask = Math.min(50000, Math.round((s.money * 0.1) / 500) * 500);
    note(s, "Black tax", `Your relative called: school fees, hospital bill, small thing. They need ${naira(ask)}.`, [
      { label: `Send ${naira(ask)}`, id: "family-give" },
      { label: "Tell them you're broke too", id: "family-decline" },
    ]);
    s.flags.familyAsk = ask;
  }
  if (rng() < 0.3) addNews(s, pick(rng, HEADLINES));
}

/** Mutates s: answer to the family request. */
export function resolveFamily(s: GameState, give: boolean) {
  const ask = s.flags.familyAsk ?? 0;
  delete s.flags.familyAsk;
  if (give) {
    const sent = Math.min(ask, s.money);
    s.money -= sent;
    s.needs.social = Math.min(100, s.needs.social + 15);
    log(s, `You sent ${naira(sent)} home. They prayed for you.`);
  } else {
    s.needs.fun = Math.max(0, s.needs.fun - 10);
    log(s, "You said you're broke too. You felt bad all day.");
  }
}
