// Sync: the town's everything app and its office. Homes to rent and buy, rides, car hire with a driver and
// what's on in town; and an employer, from agents and drivers to cleaners and engineers.
import type { Action } from "./action";
import type { Education } from "./careers";
import { HOUSE, HOUSES, HOUSE_ACTIONS, type HouseModel } from "./shops";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** The agent's inspection fee, Naija style: paid up front, whether you take the place or not. */
export const inspectionFee = (h: HouseModel) => (h.rent ? 5_000 : 15_000);

/** Book an inspection of each home: pay the fee, and your agent waits for you at the Sync office. */
export const INSPECT_ACTIONS: Action[] = HOUSES.map((h) => ({
  id: `house-inspect-${h.id}`, label: `Book an inspection: ${h.name.toLowerCase()} (${naira(inspectionFee(h))} fee)`, dur: 10,
  cost: inspectionFee(h), inspect: h.id, fx: {}, bubble: "Booking", done: "Inspection booked. Your agent is waiting for you at the Sync office.",
}));

/** Go with the agent to see the home you booked. */
export function tourAction(houseId: string): Action {
  const h = HOUSE[houseId];
  return {
    id: "inspection", label: `Go for the inspection: ${h?.name.toLowerCase() ?? "the house"}`, dur: 120, tour: houseId, fx: { energy: -8 }, bubble: "Inspecting",
    done: `You inspected the ${h?.name.toLowerCase() ?? "house"}. If you like it, ${h?.rent ? "pay the rent" : "buy it"} here at the Sync office.`,
  };
}

export interface TourStop {
  room: string;
  /** What the agent says in there. */
  says: string;
  /** Something you notice: good, or wahala. */
  note: string;
  good: boolean;
}

/** The rooms you walk through, by how grand the home is, with what the agent says and what you notice. */
export function tourOf(houseId: string): { area: string; stops: TourStop[] } {
  const h = HOUSE[houseId];
  const tier = h?.tier ?? 1;
  let seed = 0;
  for (const ch of houseId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = <T,>(xs: T[], k: number) => xs[(seed + k * 7) % xs.length];
  const area = pick(["a quiet close off the main road", "a busy street near the market", "a new layout past the junction", "a gated estate on the edge of town"], tier);
  const stops: TourStop[] = [];
  const add = (room: string, says: string[], notes: [string, boolean][]) => {
    const [note, good] = pick(notes, stops.length);
    stops.push({ room, says: pick(says, stops.length + 1), note, good });
  };
  if (houseId === "selfcon") {
    add("The room", ["See am, e big well well for one person.", "Fresh paint, landlord just did am."], [["Big window, good breeze", true], ["Small crack in the wall", false]]);
  } else {
    add(tier >= 3 ? "The living room" : "The parlour", ["This one fit take your visitors, no wahala.", "Tiles everywhere, as you see am."], [["Tiled floor, POP ceiling", true], ["One corner of the ceiling dey leak. Landlord says he will fix it", false]]);
    add(tier >= 2 ? "The bedrooms" : "The bedroom", ["Wardrobe dey inside already.", "Morning sun no go disturb you here."], [["Built-in wardrobe", true], ["Window net is torn", false]]);
  }
  add("The kitchen", ["Plenty space to cook your soup.", "Water runs here, no need to fetch."], [["Running water from a borehole", true], ["No sink yet, just the space for it", false]]);
  add("The toilet and bathroom", ["Water heater dey, for cold morning.", "Everything flushes, I tested am myself."], [["Water closet and shower", true], ["Tap drips a little", false]]);
  if (h?.generator) add("The generator house", ["When NEPA take light, this one go carry everything.", "Diesel is shared by all the tenants."], [["Big generator, soundproofed", true], ["Generator is loud at night", false]]);
  add("The compound", ["Security man dey gate every night.", "Parking for one car, two if you squeeze."], [["Prepaid meter, no estimated bill", true], ["Gutter outside needs clearing before rain", false]]);
  return { area, stops };
}

/** A day's car and driver, booked on the app or at the office. */
export const CAR_HIRE_PRICE = 25_000;

export const SYNC_PLACE = {
  id: "sync",
  name: "Sync",
  kind: "tower",
  open: [8, 20] as [number, number],
  gen: true,
  blurb: "Sync: homes to rent and buy, rides, car hire with a driver and what's on in town. They are hiring too.",
};

export const CAR_HIRE: Action = {
  id: "carhire", label: "Hire a car with a driver for today", dur: 15, cost: CAR_HIRE_PRICE, carHire: true, fx: { fun: 8 }, bubble: "Booking",
  done: "Your Sync driver is on standby for the rest of the day. Every trip today is in the car, free.",
};

/** What the Sync office offers: homes (to rent or buy, once inspected), inspections and a car for the day. */
export const SYNC_ACTIONS: Action[] = [...HOUSE_ACTIONS, ...INSPECT_ACTIONS, CAR_HIRE];

export interface TownEvent {
  /** Days from today: 0 today, 1 tomorrow. */
  inDays: number;
  /** Hour it starts, 24h. */
  hour: number;
  title: string;
  /** The place, to ride there. */
  place: string;
  note: string;
}

/** The town's week (weekdays 0 Monday to 6 Sunday): only events whose place this town has. */
const WEEK: { day: number | "daily"; hour: number; title: string; places: string[]; note: string }[] = [
  { day: 4, hour: 12, title: "Jummah prayers", places: ["mosque2", "mosque", "palace"], note: "The Friday mosque fills up. Come early" },
  { day: 6, hour: 8, title: "Sunday service", places: ["church", "church2"], note: "Choir, sermon, thanksgiving" },
  { day: 4, hour: 21, title: "Night vigil", places: ["church2", "church"], note: "Praise till morning" },
  { day: "daily", hour: 16, title: "Evening tafsir", places: ["mosque2"], note: "The mallam teaches in the evening" },
  { day: 5, hour: 16, title: "Big match at the viewing centre", places: ["viewing"], note: "₦200 at the gate. Bring your voice" },
  { day: 6, hour: 16, title: "Sunday football on the big screen", places: ["viewing"], note: "Derby day" },
  { day: 2, hour: 10, title: "Voter education session", places: ["hall"], note: "VINEC explains BVAS and how to mark your ballot" },
  { day: 3, hour: 17, title: "Community debate", places: ["hall"], note: "Party agents answer questions. Calm and civil" },
  { day: 5, hour: 22, title: "Saturday night out", places: ["club"], note: "DJ, dancing and cold drinks" },
  { day: 4, hour: 22, title: "Friday night out", places: ["club"], note: "Afrobeats till morning" },
  { day: 1, hour: 9, title: "Market day", places: ["market", "okeodo", "palace"], note: "Fresh foodstuff, best prices before noon" },
];

/** What's on in town over the next week, soonest first. has: whether this town has a place. */
export function townEvents(weekday: number, hour: number, has: (place: string) => boolean): TownEvent[] {
  const out: TownEvent[] = [];
  for (const e of WEEK) {
    const place = e.places.find(has);
    if (!place) continue;
    const days = e.day === "daily" ? [0, 1, 2, 3, 4, 5, 6].map((k) => (weekday + k) % 7) : [e.day];
    for (const d of days) {
      let inDays = (d - weekday + 7) % 7;
      // Already over today: next week's.
      if (inDays === 0 && hour >= e.hour + 2) inDays = 7;
      if (inDays > 6) continue;
      out.push({ inDays, hour: e.hour, title: e.title, place, note: e.note });
      if (e.day === "daily") break;
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.hour - b.hour);
}

/** Sync's openings on the jobs board: every week there is at least one. */
export const SYNC_HIRING: { titles: string[]; minEducation: Education; pay: [number, number] }[] = [
  { titles: ["Sync agent", "Sync customer support"], minEducation: "secondary", pay: [100_000, 200_000] },
  { titles: ["Sync driver"], minEducation: "none", pay: [85_000, 110_000] },
  { titles: ["Sync office cleaner", "Sync security guard"], minEducation: "none", pay: [70_000, 95_000] },
  { titles: ["Sync engineer", "Sync product designer"], minEducation: "degree", pay: [450_000, 1_400_000] },
];
