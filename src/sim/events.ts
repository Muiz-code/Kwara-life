import type { ChoiceId, GameState } from "./state";
import { log, naira, note } from "./state";
import { lapseInterview } from "./interview";
import type { Rng } from "./rng";
import { dayNum, dayOfWeek, hourOf, worldT } from "./time";
import { advance, applyFx, clamp } from "./needs";
import { resolveOffer, type OfferKind } from "./vote-buying";
import { resolvePolice } from "./police";
import { efccDaily, resolveEfcc } from "./efcc";
import { dailyLife, resolveFamily } from "./naija-life";
import { decideApplications } from "./jobs";
import { bankDaily, book, resolveStock } from "./bank";
import { addConnections, checkStanding, OWAMBE_CONNECTIONS } from "./standing";
import { CAREERS } from "../data/careers";

export const NEPA_CUT_CHANCE = 0.07;
export const NEPA_RESTORE_CHANCE = 0.22;
/** Minutes after applying before the Ministry calls. */
export const JOB_CALL_DELAY = 900;
export const OWAMBE_SPRAY = 2000;

/** Mutates s: everything that can happen on the hour. */
export function hourly(s: GameState, rng: Rng) {
  const h = hourOf(worldT(s));
  const d = dayOfWeek(worldT(s));
  // The game clock runs much faster than the world's: an hour of the world passes many game hours. Each
  // event of the day fires once that day, on its hour.
  const today = dayNum(worldT(s));
  const once = (k: string) => {
    const key = `${k}@${today}`;
    if (s.seen[key]) return false;
    s.seen[key] = true;
    return true;
  };

  // Morning nudge: a job you haven't done today.
  const c = s.citizen;
  if (h === 7 && c?.employed && CAREERS[c.career] && s.flags.shiftDay !== dayNum(s.t) && once("work-call"))
    s.toasts.push(`Time for work: ${CAREERS[c.career].workLabel.toLowerCase()}`);

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

  if (h === 8 && once("morning")) {
    const r = rng();
    if (r < 0.12) {
      s.needs.fun = clamp(s.needs.fun - 5);
      note(s, "Mummy called", "She asked, again, when you are bringing someone home to meet the family. You changed the topic.");
      log(s, "Mummy called about marriage again.");
    } else if (r < 0.2) {
      book(s, 3000, "Cash gift", "gift");
      note(s, "Credit alert", `Your uncle in Offa sent you ${naira(3000)} with a message: "Use it wisely."`);
      log(s, `Uncle sent ${naira(3000)}.`);
    }
  }

  if (d === 5 && h === 10 && once("owambe")) {
    note(s, "Owambe invite", "Your neighbour's daughter is getting married at a hall in GRA today. Jollof, small chops and plenty spraying.", [
      { label: `Go to the owambe (spray ${naira(OWAMBE_SPRAY)})`, id: "owambe-go" },
      { label: "Stay back", id: "owambe-skip" },
    ]);
  }

  if (h === 7 && s.citizen && once("daily")) {
    dailyLife(s, rng);
    checkStanding(s);
    efccDaily(s, rng);
    bankDaily(s);
  }
  // Employers reply on their day; checking every hour is safe, each reply happens once.
  if (s.citizen) {
    decideApplications(s, rng);
    lapseInterview(s);
  }

  if (d === 4 && h === 11 && once("jummah")) log(s, "It's Friday. Jummah at the Central Mosque runs 12pm to 3pm.");
  if (d === 5 && h === 14 && once("match")) log(s, "Kwara United play at the stadium from 3pm.");

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
      book(s, -OWAMBE_SPRAY, "Sprayed money at an owambe", "fun");
      advance(s, 240, rng);
      applyFx(s, { food: 50, fun: 30, social: 30, energy: -15 });
      log(s, "You danced at an owambe and ate plenty jollof.");
      // Owambes are where people meet people.
      if (addConnections(s, OWAMBE_CONNECTIONS)) s.toasts.push("You met important people at the owambe");
      return;
    case "owambe-skip":
      log(s, "You skipped the owambe.");
      return;
    case "ok":
      return;
    case "police-pay":
    case "police-argue":
    case "police-call":
    case "police-report":
      return resolvePolice(s, id.slice(7) as "pay" | "argue" | "call" | "report", rng);
    case "efcc-honour":
    case "efcc-ignore":
    case "efcc-run":
    case "efcc-hide":
    case "efcc-surrender":
      return resolveEfcc(s, id.slice(5) as "honour" | "ignore" | "run" | "hide" | "surrender", rng);
    case "family-give":
    case "family-decline":
      return resolveFamily(s, id === "family-give");
    default: {
      if (id.startsWith("stock-")) return resolveStock(s, id);
      const [kind, answer] = id.split("-") as [OfferKind, "report" | "refuse" | "take"];
      resolveOffer(s, kind, answer);
    }
  }
}
