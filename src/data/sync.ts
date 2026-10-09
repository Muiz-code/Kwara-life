// Sync: the town's everything app and its office. Homes to rent and buy, rides, car hire with a driver and
// what's on in town; and an employer, from agents and drivers to cleaners and engineers.
import type { Action } from "./action";
import type { Education } from "./careers";
import { HOUSE_ACTIONS } from "./shops";

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

/** What the Sync office offers: homes (to rent or buy) and a car for the day. */
export const SYNC_ACTIONS: Action[] = [...HOUSE_ACTIONS, CAR_HIRE];

/** Sync's openings on the jobs board: every week there is at least one. */
export const SYNC_HIRING: { titles: string[]; minEducation: Education; pay: [number, number] }[] = [
  { titles: ["Sync agent", "Sync customer support"], minEducation: "secondary", pay: [100_000, 200_000] },
  { titles: ["Sync driver"], minEducation: "none", pay: [85_000, 110_000] },
  { titles: ["Sync office cleaner", "Sync security guard"], minEducation: "none", pay: [70_000, 95_000] },
  { titles: ["Sync engineer", "Sync product designer"], minEducation: "degree", pay: [450_000, 1_400_000] },
];
