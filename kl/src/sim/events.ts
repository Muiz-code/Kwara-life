import type { ChoiceId, GameState } from "./state";
import { log, naira, note } from "./state";
import type { Rng } from "./rng";
import { dayNum, dayOfWeek, hourOf } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { resolveOffer, type OfferKind } from "./vote-buying";

export const NEPA_CUT_CHANCE = 0.07;
export const NEPA_RESTORE_CHANCE = 0.22;
/** Minutes after applying before the Ministry calls. */
export const JOB_CALL_DELAY = 900;
export const OWAMBE_SPRAY = 2000;

/** Mutates s: everything that can happen on the hour. */
export function hourly(s: GameState, rng: Rng) {
  const h = hourOf(s.t);
  const d = dayOfWeek(s.t);

  if (s.light) {
    if (rng() < NEPA_CUT_CHANCE) {
      s.light = false;
      log(s, "NEPA took light.");
      s.toasts.push("NEPA took light");
    }
  } else if (rng() < NEPA_RESTORE_CHANCE) {
    s.light = true;
    log(s, "Up NEPA! Light is back.");
    s.toasts.push("Light is back");
  }

  if (h === 8) {
    const r = rng();
    if (r < 0.12) {
      s.needs.fun = clamp(s.needs.fun - 5);
      note(s, "Mummy called", "She asked, again, when you are bringing someone home to meet the family. You changed the topic.");
      log(s, "Mummy called about marriage again.");
    } else if (r < 0.2) {
      s.money += 3000;
      note(s, "Credit alert", `Your uncle in Offa sent you ${naira(3000)} with a message: "Use it wisely."`);
      log(s, `Uncle sent ${naira(3000)}.`);
    }
  }

  const owambeKey = "ow" + dayNum(s.t);
  if (d === 5 && h === 10 && !s.seen[owambeKey]) {
    s.seen[owambeKey] = true;
    note(s, "Owambe invite", "Your neighbour's daughter is getting married at a hall in GRA today. Jollof, small chops and plenty spraying.", [
      { label: `Go to the owambe (spray ${naira(OWAMBE_SPRAY)})`, id: "owambe-go" },
      { label: "Stay back", id: "owambe-skip" },
    ]);
  }

  if (d === 4 && h === 11) log(s, "It's Friday. Jummah at the Central Mosque runs 12pm to 3pm.");
  if (d === 5 && h === 14) log(s, "Kwara United play at the stadium from 3pm.");

  if (s.flags.applied !== undefined && !s.flags.job && s.t - s.flags.applied >= JOB_CALL_DELAY) {
    s.flags.job = true;
    note(s, "You got the job", "The Ministry called. You can now work civil service shifts at the State Secretariat, Monday to Friday. Show up between 8am and 10am.");
  }
}

/** Mutates s: applies the player's answer to a note. */
export function resolveChoice(s: GameState, id: ChoiceId, rng: Rng) {
  switch (id) {
    case "owambe-go":
      if (s.money < OWAMBE_SPRAY) {
        s.toasts.push("Not enough money to spray");
        return;
      }
      s.money -= OWAMBE_SPRAY;
      advance(s, 240, rng);
      applyFx(s, { food: 50, fun: 30, social: 30, energy: -15 });
      log(s, "You danced at an owambe and ate plenty jollof.");
      return;
    case "owambe-skip":
      log(s, "You skipped the owambe.");
      return;
    case "ok":
      return;
    default: {
      const [kind, answer] = id.split("-") as [OfferKind, "report" | "refuse" | "take"];
      resolveOffer(s, kind, answer, rng);
    }
  }
}
