import { PLACE } from "../data/ilorin/places";
import { EMPTY_GRACE, type NeedKey } from "../data/needs";
import type { GameState } from "./state";
import { log, naira, note } from "./state";
import type { Rng } from "./rng";
import { book } from "./bank";
import { advance, markEmpty } from "./needs";

export const CLINIC_BILL = 3000;

/** How long a need has sat at empty, in game minutes, or -1 while it is not empty. */
function emptyFor(s: GameState, k: NeedKey) {
  const at = s.flags.emptyAt?.[k];
  return typeof at === "number" && s.needs[k] <= 0 ? s.t - at : -1;
}

/**
 * Mutates s: a need left at empty for EMPTY_GRACE catches up with you. Hunger lands you in hospital,
 * tiredness knocks you out, no bath and people smell you, no fun or company and you feel low.
 */
export function checkCritical(s: GameState, rng: Rng) {
  markEmpty(s);
  if (emptyFor(s, "food") >= EMPTY_GRACE) {
    book(s, -Math.min(s.money, CLINIC_BILL), "Hospital bill", "bills");
    s.loc = s.homeId;
    s.inside = false;
    advance(s, 120, rng, { sleep: true });
    s.needs.food = 40;
    s.needs.energy = Math.max(s.needs.energy, 30);
    note(s, "You fainted", `Hunger knocked you down. Neighbours rushed you to hospital and the bill was ${naira(CLINIC_BILL)}. Eat something soon.`);
    log(s, `Fainted from hunger. Hospital bill ${naira(CLINIC_BILL)}.`);
  } else if (emptyFor(s, "energy") >= EMPTY_GRACE) {
    advance(s, 240, rng, { sleep: true });
    s.needs.energy = 45;
    const where = PLACE[s.loc]?.name ?? "where you were";
    note(s, "You slept off", `You were so tired you slept off at ${where} for 4 hours.`);
    log(s, `Slept off at ${where}.`);
  }

  if (!s.flags.smelly && emptyFor(s, "hygiene") >= EMPTY_GRACE) {
    s.flags.smelly = true;
    s.needs.social = Math.max(0, s.needs.social - 15);
    note(s, "You're smelling", "People are covering their noses when you pass. Go home and take a bath. Until then, nobody wants to gist with you for long.");
    log(s, "Went too long without a bath. People noticed.");
  } else if (s.flags.smelly && s.needs.hygiene >= 50) {
    s.flags.smelly = false;
    s.toasts.push("Fresh again. People can stand near you now");
  }

  if (!s.flags.low && (emptyFor(s, "fun") >= EMPTY_GRACE || emptyFor(s, "social") >= EMPTY_GRACE)) {
    s.flags.low = true;
    note(s, "You're feeling low", "No enjoyment and nobody to talk to. You feel heavy and tired. Go and gist with people, catch a match or call someone.");
    log(s, "Feeling low.");
  } else if (s.flags.low && s.needs.fun > 30 && s.needs.social > 30) {
    s.flags.low = false;
    s.toasts.push("You're feeling like yourself again");
  }
  markEmpty(s);
}
