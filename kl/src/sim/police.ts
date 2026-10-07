// Police checkpoints and extortion on the road. Young people with phones and laptops get stopped more.
// Politicians and the rich have connections. Reporting extortion earns civic points.
import { CAREERS } from "../data/careers";
import type { ClassId } from "../data/jobs";
import { advance } from "./needs";
import type { Rng } from "./rng";
import { log, naira, note, type GameState } from "./state";

export const STOP_CHANCE = { local: 0.06, interstate: 0.35 };
export const PROFILED_FACTOR = 1.8;

const DEMAND: Record<ClassId, [number, number]> = { poor: [500, 2000], middle: [2000, 10000], rich: [10000, 50000] };

export function stopChance(s: GameState, interstate: boolean): number {
  const c = s.citizen;
  if (!c) return 0;
  const base = interstate ? STOP_CHANCE.interstate : STOP_CHANCE.local;
  return Math.min(0.8, base * (CAREERS[c.career].profiled ? PROFILED_FACTOR : 1));
}

/** Mutates s: maybe the police stop you. Shows a note with choices. Returns true if stopped. */
export function maybePoliceStop(s: GameState, interstate: boolean, rng: Rng): boolean {
  const c = s.citizen;
  if (!c || rng() >= stopChance(s, interstate)) return false;
  const [lo, hi] = DEMAND[c.cls];
  const demand = Math.round((lo + rng() * (hi - lo)) / 500) * 500;
  s.events.policeDemand = demand;
  const choices: { label: string; id: "police-pay" | "police-argue" | "police-call" | "police-report" }[] = [
    { label: `Pay ${naira(demand)}`, id: "police-pay" },
    { label: "Argue your rights", id: "police-argue" },
  ];
  if (c.cls === "rich" || CAREERS[c.career].connected) choices.push({ label: "Call your lawyer (or your oga)", id: "police-call" });
  choices.push({ label: "Pay, then report them later", id: "police-report" });
  note(s, "Police checkpoint", `"Oga, park well. Where your papers? Find something for the boys." They want ${naira(demand)}.`, choices);
  return true;
}

/** Mutates s: your answer at the checkpoint. Yahoo citizens risk a phone search. */
export function resolvePolice(s: GameState, answer: "pay" | "argue" | "call" | "report", rng: Rng) {
  const c = s.citizen;
  const demand = s.events.policeDemand ?? 0;
  delete s.events.policeDemand;
  if (!c) return;
  const pay = (amount: number, msg: string) => {
    const paid = Math.min(amount, s.money);
    s.money -= paid;
    log(s, paid < amount ? `${msg} They collected everything you had: ${naira(paid)}.` : `${msg} You paid ${naira(paid)}.`);
  };
  if (c.career === "yahoo" && answer !== "call" && rng() < 0.3) {
    s.heat = Math.min(100, s.heat + 40);
    const lost = Math.round(s.money * 0.5);
    s.money -= lost;
    advance(s, 180, rng);
    log(s, `They searched your phone and found things. You "settled" with ${naira(lost)} and three hours in their van. EFCC will hear.`);
    s.toasts.push("Phone searched");
    return;
  }
  switch (answer) {
    case "pay":
      return pay(demand, "You settled the police.");
    case "report":
      s.civic += 2;
      pay(demand, "You settled the police, then reported them to the police complaint line.");
      s.toasts.push("Reported");
      return;
    case "call":
      if (rng() < 0.9) {
        log(s, "One phone call and the officers waved you through.");
        return;
      }
      return pay(demand, "Even your oga could not help this time.");
    case "argue":
      if (rng() < 0.5) {
        log(s, "You argued your rights calmly. They let you go.");
        return;
      }
      advance(s, 180, rng);
      return pay(demand * 2, "You argued and they took you to the station for three hours.");
  }
}
