import { FRIENDS, MAX_HEARTS, type FriendId } from "../data/friends";
import type { GameState } from "./state";
import { pick, type Rng } from "./rng";
import { dayNum } from "./time";

/** Mutates s: a friend meeting. Hearts grow at most once a day. Returns the journal line. */
export function befriend(s: GameState, id: FriendId, rng: Rng): string {
  const f = FRIENDS[id];
  const d = dayNum(s.t);
  if (s.friendDay[id] === d) return `${f.name} is happy to see you again today.`;
  s.friendDay[id] = d;
  if (s.friends[id] < MAX_HEARTS) s.friends[id]++;
  let m = pick(rng, f.lines);
  if (s.friends[id] === 3 && f.unlock) m += " " + f.unlock;
  if (s.friends[id] === MAX_HEARTS) m += " You are now close friends.";
  return m;
}
