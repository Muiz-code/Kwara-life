// A new life: the one-time roll, then the starting state (opening balance, home, the first log line).
// Shared by the game, for offline play, and the server, which rolls every real citizen so a roll can't be
// faked in the browser.
import { LGA } from "../data/geography";
import { STATE } from "../data/states";
import { book, freshBank } from "./bank";
import type { Rng } from "./rng";
import { rollCitizen, startingMoney, type RollInput } from "./roll";
import { clone, log, type GameState } from "./state";

/** The game after rolling a citizen on top of `base`. Throws with a reason the player can read. */
export function startLife(base: GameState, input: RollInput, now: number, rng: Rng): GameState {
  const citizen = rollCitizen(input, now, rng);
  const g = clone(base);
  g.citizen = citizen;
  g.char = { name: citizen.name, ...citizen.look };
  g.money = 0;
  g.bank = freshBank();
  g.visited = [citizen.stateCode];
  book(g, startingMoney(citizen, rng), "Opening balance", "opening");
  g.loc = "home";
  g.homeId = "home";
  g.at = null;
  const lga = LGA[citizen.lgaCode];
  log(g, `${citizen.name} started life in ${lga.name}, ${STATE[lga.stateCode].name}.`);
  return g;
}
