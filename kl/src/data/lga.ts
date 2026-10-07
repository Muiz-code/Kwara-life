// Places and actions on a generated LGA map (every LGA except the hand-built Ilorin map).
// Ported from reference/naija-votes-2027.html. Place positions and roads come from src/world.
import type { Action } from "./action";
import { LOCAL_FOOD, MARKET_NAME } from "./biomes";
import { WORKPLACE, type ClassId } from "./jobs";
import type { State } from "./states";

export type LgaPlaceId =
  | "home" | "work" | "inec" | "pu" | "market" | "buka" | "viewing" | "kiosk" | "mosque" | "church" | "park"
  | "hall" | "board" | "landmark" | "shelter" | "hotel";

export interface LgaPlace {
  id: LgaPlaceId;
  name: string;
  /** Art kind for the tile. */
  kind: string;
  open: [number, number];
  /** Has a generator. */
  gen: boolean;
  blurb: string;
}

export interface LgaContext {
  state: State;
  lgaName: string;
  cls: ClassId;
  job: string;
  home: string;
  underFlyover: boolean;
  /** Was under a flyover and got a shelter bed: the shelter stays on the map. */
  wasUnder?: boolean;
  /** The citizen is visiting this LGA: no home, workplace or shelter of theirs here. */
  visiting?: boolean;
}

/** A night's lodging away from home, by class. */
export const LODGING: Record<ClassId, { name: string; price: number }> = {
  poor: { name: "Guest house", price: 5000 },
  middle: { name: "Hotel", price: 25000 },
  rich: { name: "Hotel", price: 80000 },
};

const shortTown = (lga: string) => lga.split(/[ /-]/)[0];

export function lgaPlaces(c: LgaContext): LgaPlace[] {
  const work = WORKPLACE[c.cls];
  const food = LOCAL_FOOD[c.state.zone];
  const places: LgaPlace[] = [
    {
      id: "home", name: c.underFlyover ? "Flyover" : "Home", kind: c.underFlyover ? "flyover" : "house", open: [0, 24], gen: c.cls === "rich",
      blurb: `Where you live: ${c.underFlyover ? "under a flyover near the motor park" : c.home}.`,
    },
    { id: "work", name: work.name, kind: work.kind, open: [7, 20], gen: c.cls !== "poor", blurb: `Where you work as a ${c.job.toLowerCase()}.` },
    { id: "inec", name: "INEC Office", kind: "inec", open: [8, 17], gen: true, blurb: "INEC LGA office. Register, collect your PVC and ask questions." },
    { id: "pu", name: "Polling Unit", kind: "school", open: [0, 24], gen: false, blurb: "Your polling unit, in a primary school. This is where you vote." },
    { id: "market", name: MARKET_NAME[c.state.zone](shortTown(c.lgaName)), kind: "market", open: [6, 20], gen: false, blurb: "Foodstuff, radios, TVs and everything in between." },
    { id: "buka", name: food.place, kind: "buka", open: [7, 22], gen: false, blurb: `Local food: ${food.dish.toLowerCase()}.` },
    { id: "viewing", name: "Viewing Centre", kind: "viewing", open: [10, 23], gen: true, blurb: "Big TV, plastic chairs, small fee. News and football for people without TV at home." },
    { id: "kiosk", name: "News Stand", kind: "kiosk", open: [6, 19], gen: false, blurb: "Newspapers on display. Plenty people read the front pages for free." },
    { id: "mosque", name: "Central Mosque", kind: "mosque", open: [0, 24], gen: false, blurb: "The central mosque." },
    { id: "church", name: "Church", kind: "church", open: [0, 24], gen: false, blurb: "A busy church with big Sunday services." },
    { id: "park", name: "Motor Park", kind: "garage", open: [5, 22], gen: false, blurb: "Buses, drivers and all the political gist you can handle." },
    { id: "hall", name: "Town Hall", kind: "townhall", open: [8, 20], gen: false, blurb: "Voter education sessions and community debates." },
    { id: "board", name: "Notice Board", kind: "board", open: [0, 24], gen: false, blurb: "Flyers and announcements. Campaign flyers posted in this LGA show here." },
    { id: "landmark", name: c.state.landmark.name, kind: "lm-" + c.state.landmark.kind, open: [7, 19], gen: false, blurb: `${c.state.name}: ${c.state.slogan}.` },
  ];
  if (c.underFlyover || c.wasUnder) places.push({ id: "shelter", name: "Shelter", kind: "shelter", open: [0, 24], gen: false, blurb: "A church-run shelter that sometimes has beds." });
  places.push({ id: "hotel", name: "Hotel", kind: "hotel", open: [0, 24], gen: true, blurb: "Rooms for the night when you are away from home, a bar and cold drinks." });
  if (c.visiting) return places.filter((p) => p.id !== "home" && p.id !== "work" && p.id !== "shelter");
  return places;
}

const BRIBE: Action = { id: "bribe", label: "Offer money for votes", dur: 60, bribe: true, fx: {}, bubble: "Sharing money", done: "" };

function homeActions(under: boolean): Action[] {
  if (under) {
    return [
      { id: "sleep", label: "Sleep under the flyover", dur: 420, sleep: true, fx: { energy: 70, hygiene: -10 }, bubble: "Zzz", done: "You slept under the flyover. The traffic never stopped." },
      { id: "radio", label: "Listen to your small radio", dur: 30, media: "radio", fx: { fun: 6 }, bubble: "Radio", done: "Radio news." },
    ];
  }
  return [
    { id: "sleep", label: "Sleep", dur: 480, sleep: true, fx: { energy: 100 }, bubble: "Zzz", done: "You slept for 8 hours." },
    { id: "nap", label: "Take a nap", dur: 90, sleep: true, fx: { energy: 30 }, bubble: "Zzz", done: "Short nap." },
    { id: "bath", label: "Take a bath", dur: 30, fx: { hygiene: 70 }, bubble: "Splash", done: "Cold bath, you feel fresh." },
    { id: "cook", label: "Cook at home", dur: 40, fx: { food: 45 }, usesFood: true, bubble: "Cooking", done: "You cooked a pot of rice and stew." },
    { id: "tv", label: "Watch the news on your TV", dur: 60, media: "tv", light: true, fx: { fun: 18 }, bubble: "News", done: "TV news." },
    { id: "radio", label: "Listen to the radio", dur: 30, media: "radio", fx: { fun: 6 }, bubble: "Radio", done: "Radio news." },
    { id: "phone", label: "Scroll WhatsApp status", dur: 30, fx: { fun: 8, social: 6 }, bubble: "Scrolling", done: "Everyone's status is about the election." },
  ];
}

/** Civic places shared by every map, Ilorin included. */
export const CIVIC_ACTIONS: Record<"inec" | "pu" | "viewing" | "kiosk" | "hall" | "board", Action[]> = {
  inec: [
    { id: "register", label: "Register to vote", dur: 120, pvcAct: "register", fx: { energy: -5 }, bubble: "BVAS capture", done: "You registered. INEC will announce when PVCs are ready for collection." },
    { id: "collect", label: "Collect your PVC", dur: 90, pvcAct: "collect", fx: {}, bubble: "Searching", done: "" },
    { id: "help", label: "Help a neighbour register", dur: 90, fx: { social: 15 }, civic: 1, bubble: "Helping", done: "You helped Mama Ngozi register." },
  ],
  pu: [
    { id: "check", label: "Check your name on the register", dur: 30, informed: 1, fx: {}, bubble: "Checking", done: "Your name is on the displayed register." },
    { id: "vote", label: "Vote", dur: 60, vote: true, fx: {}, bubble: "Voting", done: "" },
  ],
  viewing: [
    { id: "vnews", label: "Watch the news", dur: 60, cost: 100, media: "tv", fx: { fun: 10, social: 6 }, bubble: "News", done: "TV news at the viewing centre." },
    { id: "football", label: "Watch football", dur: 120, cost: 200, fx: { fun: 35, social: 15 }, bubble: "Goal!", done: "Big match. The whole centre screamed." },
  ],
  kiosk: [
    { id: "glance", label: "Read the front pages for free", dur: 15, media: "paper", fx: {}, bubble: "Reading", done: "Front pages." },
    { id: "paper", label: "Buy a newspaper", dur: 30, cost: 300, media: "paper2", fx: { fun: 5 }, bubble: "Reading", done: "Full paper." },
  ],
  hall: [
    { id: "edu", label: "Voter education session", dur: 90, informed: 2, fx: { social: 8 }, bubble: "Learning", done: "INEC and NOA explained BVAS, ballot marking and result upload." },
    { id: "debate", label: "Watch a community debate", dur: 120, informed: 2, fx: { fun: 10, social: 12 }, bubble: "Listening", done: "Party agents debated roads, power and jobs. Calm and civil." },
  ],
  board: [
    { id: "readfly", label: "Read the flyers", dur: 15, informed: 1, fx: {}, bubble: "Reading", done: "You read the flyers on the board." },
    { id: "postfly", label: "Post a flyer", dur: 30, flyer: true, fx: {}, bubble: "Posting", done: "" },
  ],
};

export function lgaActions(c: LgaContext): Record<LgaPlaceId, Action[]> {
  const food = LOCAL_FOOD[c.state.zone];
  const lm = c.state.landmark.name;
  return {
    home: homeActions(c.underFlyover),
    work: [{ id: "work", label: `Work as a ${c.job.toLowerCase()}`, dur: 0, shift: true, fx: { energy: -25, fun: -8, social: 8, hygiene: -10 }, bubble: "Working", done: "Shift done." }],
    ...CIVIC_ACTIONS,
    market: [
      BRIBE,
      { id: "food", label: "Buy foodstuff", dur: 40, cost: 2000, groc: 3, fx: {}, bubble: "Pricing", done: "Foodstuff for 3 meals." },
      { id: "buyradio", label: "Buy a small radio", dur: 20, cost: 8000, buy: "radio", fx: { fun: 5 }, bubble: "Buying", done: "You bought a small battery radio." },
      { id: "buytv", label: "Buy a TV", dur: 30, cost: 85000, buy: "tv", fx: { fun: 15 }, bubble: "Buying", done: "You bought a 32-inch TV." },
      { id: "haggle", label: "Gist with traders", dur: 40, fx: { social: 12 }, overhear: true, bubble: "Gisting", done: "Traders argued about the election all afternoon." },
    ],
    buka: [
      BRIBE,
      { id: "eat", label: food.dish, dur: 40, cost: food.price, fx: { food: 60, fun: 6 }, bubble: "Eating", done: `${food.dish}. Belle full.` },
      { id: "gist", label: "Gist with regulars", dur: 30, fx: { social: 12 }, overhear: true, bubble: "Gisting", done: "Everybody has an opinion about 2027." },
    ],
    mosque: [
      { id: "pray", label: "Pray", dur: 30, fx: { fun: 8, social: 6 }, bubble: "Praying", done: "You prayed and feel calm." },
      { id: "jummah", label: "Attend Jummah", dur: 90, day: 4, hours: [12, 15], fx: { social: 25, fun: 10 }, bubble: "Jummah", done: "Jummah. The imam reminded everyone to vote in peace." },
    ],
    church: [
      { id: "cpray", label: "Pray", dur: 30, fx: { fun: 8, social: 6 }, bubble: "Praying", done: "You prayed and feel calm." },
      { id: "service", label: "Attend Sunday service", dur: 150, day: 6, hours: [8, 13], fx: { social: 25, fun: 12 }, bubble: "Praise", done: "Sunday service. The pastor reminded everyone to collect their PVC." },
    ],
    park: [
      BRIBE,
      { id: "drivers", label: "Gist with drivers", dur: 40, fx: { social: 12, fun: 6 }, overhear: true, bubble: "Gisting", done: "The drivers' union argued politics for an hour." },
    ],
    landmark: [{ id: "visit", label: `Visit ${lm}`, dur: 90, fx: { fun: 30, social: 5, energy: -10 }, bubble: "Wow", done: `You spent the afternoon at ${lm}.` }],
    shelter: [{ id: "bed", label: "Ask for a bed", dur: 60, fx: {}, shelter: true, bubble: "Waiting", done: "" }],
    hotel: [
      { id: "lodge", label: `Take a room for the night (${LODGING[c.cls].name.toLowerCase()})`, dur: 480, sleep: true, cost: LODGING[c.cls].price, fx: { energy: 100, hygiene: 40 }, bubble: "Zzz", done: "You slept well away from home." },
      { id: "drink", label: "Cold drink at the bar", dur: 30, cost: 1000, fx: { fun: 10, social: 8 }, overhear: true, bubble: "Sipping", done: "Cold drink at the hotel bar." },
    ],
  };
}
