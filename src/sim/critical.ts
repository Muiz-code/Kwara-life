import { PLACE } from "../data/ilorin/places";
import type { GameState } from "./state";
import { log, naira, note } from "./state";
import type { Rng } from "./rng";
import { book } from "./bank";
import { advance } from "./needs";

export const CLINIC_BILL = 3000;

/** Mutates s: fainting from hunger or sleeping off from tiredness. */
export function checkCritical(s: GameState, rng: Rng) {
  if (s.needs.food <= 0) {
    book(s, -Math.min(s.money, CLINIC_BILL), "Clinic bill", "bills");
    s.loc = s.homeId;
    s.inside = false;
    advance(s, 120, rng, { sleep: true });
    s.needs.food = 40;
    s.needs.energy = Math.max(s.needs.energy, 30);
    note(s, "You fainted", `Hunger knocked you down. Neighbours carried you to the clinic and the bill was ${naira(CLINIC_BILL)}. Eat something soon.`);
    log(s, `Fainted from hunger. Clinic bill ${naira(CLINIC_BILL)}.`);
  } else if (s.needs.energy <= 0) {
    advance(s, 240, rng, { sleep: true });
    s.needs.energy = 45;
    const where = PLACE[s.loc]?.name ?? "where you were";
    note(s, "You slept off", `You were so tired you slept off at ${where} for 4 hours.`);
    log(s, `Slept off at ${where}.`);
  }
}
