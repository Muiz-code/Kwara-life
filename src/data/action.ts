// What a place lets you do. Shared by the hand-built Ilorin map and the generated LGA maps.
import type { NeedKey } from "./needs";
import type { FriendId } from "./friends";

export type GoalId = "phone" | "fly";
export type OnceFlag = "applied";

export interface Action {
  id: string;
  label: string;
  /** Game minutes. */
  dur: number;
  fx: Partial<Record<NeedKey, number>>;
  done: string;
  bubble?: string;
  cost?: number;
  earn?: number;
  /** Cash gift received on top of earnings. */
  tip?: number;
  /** Only allowed between these hours, [from, to). */
  hours?: [number, number];
  /** Only on this day of the week (0 = Monday). */
  day?: number;
  /** Only on these days of the week. */
  days?: number[];
  /** Closed on this day of the week. */
  noDay?: number;
  /** Monday to Friday only. */
  weekdays?: boolean;
  /** Needs you to live here. */
  home?: boolean;
  sleep?: boolean;
  /** 30% chance the tap is dry and you fetch water first. */
  water?: boolean;
  /** Needs light (NEPA or a generator). */
  light?: boolean;
  usesFood?: boolean;
  /** Adds this many meals of foodstuff. */
  groc?: number;
  /** Packs this food (its food value) to take home, instead of eating it here. */
  takeaway?: number;
  /** Books an inspection of this home (a house id from src/data/shops.ts), paying the fee. */
  inspect?: string;
  /** Goes on the booked inspection of this home with the agent. */
  tour?: string;
  /** A car and driver for the rest of the game day (Sync). */
  carHire?: boolean;
  /** Eats the oldest take-away pack at home. */
  eatTakeaway?: boolean;
  skill?: number;
  minSkill?: number;
  friend?: FriendId;
  goal?: GoalId;
  once?: OnceFlag;
  /** Civil service shift: needs the job, once per day. */
  job?: boolean;
  /** Hires a Durbar horse for the rest of the day. */
  horse?: boolean;
  /** Pay rent and move in. */
  rent?: boolean;

  // ---- Naija Votes ----
  /** A work shift paid by class (random within the class range). Once per game day. */
  shift?: boolean;
  /** Gives news: tv and radio need owning one (at home), paper is the free front pages, paper2 a bought paper. */
  media?: "tv" | "radio" | "paper" | "paper2";
  /** Informed points gained. */
  informed?: number;
  /** Civic points gained. */
  civic?: number;
  /** Gisting: you overhear the news. */
  overhear?: boolean;
  /** Buys an item you keep. */
  buy?: "tv" | "radio";
  /** Buys a piece of furniture for your home (an id from src/data/furniture.ts). */
  furnish?: string;
  /** Buys a phone (an id from src/data/phones.ts). */
  phone?: string;
  /** Buys a car (an id from src/data/shops.ts): you can drive yourself in town and between states. */
  car?: string;
  /** Buys a house (an id from src/data/shops.ts): it becomes your home. */
  house?: string;
  /** Buys an outfit (an id from src/data/shops.ts): your character wears it. */
  outfit?: string;
  /** Pays Raavon to build your website (once). */
  website?: boolean;
  /** Pitches an idea to investors: a small chance of funding. */
  pitch?: boolean;
  pvcAct?: "register" | "collect";
  /** Opens the BVAS and ballot flow. */
  vote?: boolean;
  /** Opens the vote-buying offer flow. */
  bribe?: boolean;
  /** Opens the flyer promotion flow. */
  flyer?: boolean;
  /** A real journey to another state (sim/journey.ts): a flight lands at that state's airport town. */
  journey?: { state: string; mode: "bus" | "flight" | "car" };
  /** Ask the shelter for a bed (citizens under a flyover). */
  shelter?: boolean;
}

