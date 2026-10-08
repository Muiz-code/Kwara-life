// Places and actions on a generated LGA map (every LGA except the hand-built Ilorin map).
// Ported from reference/naija-votes-2027.html. Place positions and roads come from src/world.
import type { Action } from "./action";
import { LOCAL_FOOD, MARKET_NAME } from "./biomes";
import { WORKPLACE, type ClassId } from "./jobs";
import { CAREERS, type CareerId } from "./careers";
import type { State } from "./states";
import { nightSpot, SHARIA_STATES } from "./clubs";
import { FURNITURE_ACTIONS } from "./furniture";
import { PHONE_ACTIONS } from "./phones";
import { AIRPORT_NAMES, airportLga } from "./capitals";
import { CAR_ACTIONS, HOUSE_ACTIONS, OUTFIT_ACTIONS, SUPERMARKET_ACTIONS } from "./shops";

/** Abuja Municipal is home to Aso Rock and the Presidential Villa, on its own big ground out of town. */
export const isAsoRockTown = (c: Pick<LgaContext, "state" | "lgaName">) => c.state.code === "fct" && c.lgaName === "Abuja Municipal";

export type LgaPlaceId =
  | "home" | "work" | "inec" | "pu" | "market" | "buka" | "viewing" | "kiosk" | "mosque" | "church" | "park"
  | "hall" | "board" | "landmark" | "shelter" | "hotel" | "club" | "mosque2" | "church2" | "bank" | "raavon" | "terminal" | "station" | "airport"
  | "supermarket" | "boutique" | "cardealer" | "estateagent";

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
  career?: CareerId;
}

/** A night's lodging away from home, by class. */
export const LODGING: Record<ClassId, { name: string; price: number }> = {
  poor: { name: "Guest house", price: 5000 },
  middle: { name: "Hotel", price: 25000 },
  rich: { name: "Hotel", price: 80000 },
};

const shortTown = (lga: string) => lga.split(/[ /-]/)[0];

/** Where each career works. Laptop careers still get a place (a co-working space) to visit. */
export function careerWorkplace(career: CareerId, cls: ClassId): { name: string; kind: string } {
  switch (career) {
    case "student":
      return { name: "Campus", kind: "school" };
    case "corper":
      return { name: "Your PPA", kind: "office" };
    case "worker":
    case "developer":
      return { name: "Office", kind: "office" };
    case "artisan":
      return { name: "Workshop", kind: "workshop" };
    case "trader":
      return { name: "Your stall", kind: "market" };
    case "herbalist":
      return { name: "Herbal shop", kind: "workshop" };
    case "politician":
      return { name: "Party office", kind: "office" };
    case "executive":
      return { name: "Company HQ", kind: "tower" };
    default:
      return WORKPLACE[cls];
  }
}

export function lgaPlaces(c: LgaContext): LgaPlace[] {
  const work = c.career ? careerWorkplace(c.career, c.cls) : WORKPLACE[c.cls];
  const food = LOCAL_FOOD[c.state.zone];
  const places: LgaPlace[] = [
    {
      id: "home", name: c.underFlyover ? "Flyover" : "Home", kind: c.underFlyover ? "flyover" : "house", open: [0, 24], gen: c.cls === "rich",
      blurb: `Where you live: ${c.underFlyover ? "under a flyover near the motor park" : c.home}.`,
    },
    { id: "work", name: work.name, kind: work.kind, open: [7, 20], gen: c.cls !== "poor", blurb: `Where you work as a ${c.job.toLowerCase()}.` },
    { id: "inec", name: "VINEC Office", kind: "inec", open: [8, 17], gen: true, blurb: "VINEC LGA office. Register, collect your PVC and ask questions." },
    { id: "pu", name: "Polling Unit", kind: "school", open: [0, 24], gen: false, blurb: "Your polling unit, in a primary school. This is where you vote." },
    { id: "market", name: MARKET_NAME[c.state.zone](shortTown(c.lgaName)), kind: "market", open: [6, 20], gen: false, blurb: "Foodstuff, radios, TVs and everything in between." },
    { id: "buka", name: food.place, kind: "buka", open: [7, 22], gen: false, blurb: `Local food: ${food.dish.toLowerCase()}.` },
    { id: "viewing", name: "Viewing Centre", kind: "viewing", open: [10, 23], gen: true, blurb: "Big TV, plastic chairs, small fee. News and football for people without TV at home." },
    { id: "kiosk", name: "News Stand", kind: "kiosk", open: [6, 19], gen: false, blurb: "Newspapers on display. Plenty people read the front pages for free." },
    { id: "mosque", name: "Central Mosque", kind: "mosque", open: [0, 24], gen: false, blurb: "The central mosque." },
    { id: "church", name: "Church", kind: "church", open: [0, 24], gen: false, blurb: "A busy church with big Sunday services." },
    // More mosques in the north, more churches in the east and south, one of each elsewhere.
    ...(["NW", "NE"].includes(c.state.zone)
      ? [{ id: "mosque2" as const, name: "Juma'at Mosque", kind: "mosque", open: [0, 24] as [number, number], gen: false, blurb: "The big Friday mosque, full for Jummah and the evening tafsir." }]
      : ["SE", "SS"].includes(c.state.zone)
        ? [{ id: "church2" as const, name: "Cathedral", kind: "church", open: [0, 24] as [number, number], gen: false, blurb: "The cathedral, with its bell tower and Friday night vigils." }]
        : []),
    { id: "park", name: "Motor Park", kind: "garage", open: [5, 22], gen: false, blurb: "Buses, drivers and all the political gist you can handle." },
    { id: "hall", name: "Town Hall", kind: "townhall", open: [8, 20], gen: false, blurb: "Voter education sessions and community debates." },
    { id: "board", name: "Notice Board", kind: "board", open: [0, 24], gen: false, blurb: "Flyers and announcements. Campaign flyers posted in this LGA show here." },
    isAsoRockTown(c)
      ? { id: "landmark", name: "Aso Rock and the Presidential Villa", kind: "lm-villa", open: [8, 18], gen: true, blurb: "The great granite rock over Abuja, and the walled Presidential Villa at its foot. Guided tours of the grounds on weekdays." }
      : { id: "landmark", name: c.state.landmark.name, kind: "lm-" + c.state.landmark.kind, open: [7, 19], gen: false, blurb: `${c.state.name}: ${c.state.slogan}.` },
  ];
  if (c.underFlyover || c.wasUnder) places.push({ id: "shelter", name: "Shelter", kind: "shelter", open: [0, 24], gen: false, blurb: "A church-run shelter that sometimes has beds." });
  places.push({ id: "hotel", name: "Hotel", kind: "hotel", open: [0, 24], gen: true, blurb: "Rooms for the night when you are away from home, a bar and cold drinks." });
  places.push(
    { id: "bank", name: "Klario Bank", kind: "bank", open: [8, 16], gen: true, blurb: "Klario: the bank on your phone and on the high street. Savings, transfers, the ATM that works." },
    { id: "terminal", name: `${shortTown(c.lgaName)} Bus Terminal`, kind: "busterminal", open: [5, 21], gen: true, blurb: "Luxury coaches to every state capital, the ticket office and plenty of hawkers." },
    { id: "station", name: `${shortTown(c.lgaName)} Train Station`, kind: "trainstation", open: [6, 20], gen: true, blurb: "The station on the line. Trains are slow but cheap, and the coach has a fan." },
    ...(airportLga(c.state.code) === c.lgaName
      ? [{ id: "airport" as const, name: AIRPORT_NAMES[c.state.code], kind: "airport", open: [0, 24] as [number, number], gen: true, blurb: "Check-in, departures and the long walk to the gate. Flights to the state capitals." }]
      : []),
    { id: "supermarket", name: "Supermart", kind: "mall", open: [8, 21], gen: true, blurb: "Air-conditioned aisles: groceries for the week, snacks, drinks and household things." },
    { id: "boutique", name: "Fabrics and Fashion", kind: "shops", open: [9, 19], gen: false, blurb: "Agbada, babban riga, iro and buba, george and ankara, sewn while you wait." },
    { id: "cardealer", name: "Car Dealer", kind: "workshop", open: [9, 18], gen: true, blurb: "Tokunbo and brand-new cars on the lot. Buy one and drive yourself round town and across states." },
    { id: "estateagent", name: "Estate Agent", kind: "office", open: [9, 17], gen: true, blurb: "Houses for sale, from a bungalow in a new layout to a mansion with a pool. Buy one and it becomes your home." },
    { id: "raavon", name: "Raavon", kind: "techhub", open: [8, 20], gen: true, blurb: "Raavon, the tech unicorn. They recruit, build websites and apps, and back founders with good ideas." },
  );
  const night = nightSpot(c.state.code, c.lgaName);
  places.push(
    night.kind === "club"
      ? { id: "club", name: night.name, kind: "club", open: [21, 4], gen: true, blurb: `${night.area}. Afrobeats till morning, DJ on the decks, cold drinks at the bar.` }
      : { id: "club", name: night.name, kind: "lounge", open: [16, 24], gen: true, blurb: "Suya, zobo and chapman, football on the big screen, music. No alcohol here." },
  );
  if (c.visiting) return places.filter((p) => p.id !== "home" && p.id !== "work" && p.id !== "shelter");
  return places;
}

/** A night out: dance, a table if you can afford it, or a quiet evening at the relaxation spot. */
export function nightActions(stateCode: string, cls: ClassId): Action[] {
  if (SHARIA_STATES.has(stateCode)) {
    return [
      { id: "suya", label: "Suya and zobo", dur: 45, cost: 1500, fx: { food: 25, fun: 12, social: 10 }, overhear: true, bubble: "Chilling", done: "Suya with plenty yaji and a cold zobo." },
      { id: "match", label: "Watch the match on the big screen", dur: 120, cost: 500, fx: { fun: 30, social: 15 }, bubble: "Goal!", done: "The whole place jumped at the last-minute goal." },
    ];
  }
  const out: Action[] = [
    { id: "dance", label: "Dance till late", dur: 180, cost: 5000, fx: { fun: 40, social: 20, energy: -25, hygiene: -10 }, overhear: true, bubble: "Dancing", done: "The DJ played all your songs. Your legs are tired." },
    { id: "bar", label: "Cold drink at the bar", dur: 45, cost: 2500, fx: { fun: 12, social: 10 }, overhear: true, bubble: "Sipping", done: "Cold drink, loud music, good gist." },
  ];
  if (cls !== "poor") out.push({ id: "table", label: "Book a table with friends", dur: 240, cost: cls === "rich" ? 150000 : 40000, fx: { fun: 55, social: 35, energy: -30 }, bubble: "Popping bottles", done: "Sparklers, bottles and the whole club looking at your table." });
  return out;
}

/** Klario Bank, in every town. */
export const BANK_ACTIONS: Action[] = [
  { id: "officer", label: "Talk to a Klario account officer", dur: 30, fx: { social: 4 }, informed: 1, bubble: "Banking", done: "Your account officer showed you Klario savings, transfers and the app on your phone." },
  { id: "atm", label: "Use the Klario ATM", dur: 10, fx: {}, bubble: "Withdrawing", done: "The Klario ATM paid out first time. No queue, no wahala." },
];

/** Raavon, the tech unicorn, in every town. */
export const RAAVON_ACTIONS: Action[] = [
  { id: "recruit", label: "Meet the Raavon recruiters", dur: 60, fx: { social: 10 }, bubble: "Networking", done: "Raavon's recruiters took your CV and told you to watch the Jobs app on your phone." },
  { id: "site", label: "Hire Raavon to build your website", dur: 90, cost: 350000, website: true, fx: { fun: 12 }, bubble: "Briefing", done: "Raavon built your website. Your hustle is online." },
  { id: "pitch", label: "Pitch your idea to Raavon", dur: 120, pitch: true, fx: { energy: -10, fun: 6 }, bubble: "Pitching", done: "" },
];

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
    { id: "register", label: "Register to vote", dur: 120, pvcAct: "register", fx: { energy: -5 }, bubble: "BVAS capture", done: "You registered. VINEC will announce when PVCs are ready for collection." },
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
    { id: "edu", label: "Voter education session", dur: 90, informed: 2, fx: { social: 8 }, bubble: "Learning", done: "VINEC and NOA explained BVAS, ballot marking and result upload." },
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
  const career = c.career ? CAREERS[c.career] : null;
  const work: Action = {
    id: "work", label: career ? career.workLabel : `Work as a ${c.job.toLowerCase()}`, dur: 0, shift: true,
    fx: { energy: -25, fun: -8, social: 8, hygiene: -10 }, bubble: "Working", done: "Shift done.",
  };
  /** Laptop and phone work can be done from home or a hotel room. */
  const anywhere = career?.where === "anywhere" ? [work] : [];
  return {
    home: [...homeActions(c.underFlyover), ...anywhere],
    work: career?.where === "anywhere" ? [] : [work],
    ...CIVIC_ACTIONS,
    market: [
      BRIBE,
      { id: "food", label: "Buy foodstuff", dur: 40, cost: 2000, groc: 3, fx: {}, bubble: "Pricing", done: "Foodstuff for 3 meals." },
      { id: "buyradio", label: "Buy a small radio", dur: 20, cost: 8000, buy: "radio", fx: { fun: 5 }, bubble: "Buying", done: "You bought a small battery radio." },
      { id: "buytv", label: "Buy a TV", dur: 30, cost: 85000, buy: "tv", fx: { fun: 15 }, bubble: "Buying", done: "You bought a 32-inch TV." },
      ...FURNITURE_ACTIONS,
      ...PHONE_ACTIONS,
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
    mosque2: [
      { id: "pray", label: "Pray", dur: 30, fx: { fun: 8, social: 6 }, bubble: "Praying", done: "You prayed and feel calm." },
      { id: "tafsir", label: "Listen to the evening tafsir", dur: 60, hours: [16, 20], fx: { social: 12, fun: 6 }, bubble: "Listening", done: "The mallam spoke about honesty and keeping the peace." },
    ],
    church2: [
      { id: "cpray", label: "Pray", dur: 30, fx: { fun: 8, social: 6 }, bubble: "Praying", done: "You prayed and feel calm." },
      { id: "vigil", label: "Night vigil", dur: 240, day: 4, hours: [21, 24], fx: { social: 20, fun: 10, energy: -20 }, bubble: "Praise", done: "Vigil till morning. The choir did not tire." },
    ],
    park: [
      BRIBE,
      { id: "drivers", label: "Gist with drivers", dur: 40, fx: { social: 12, fun: 6 }, overhear: true, bubble: "Gisting", done: "The drivers' union argued politics for an hour." },
    ],
    landmark: isAsoRockTown(c)
      ? [
        { id: "photo", label: "Take a photo by the Villa gate", dur: 20, fx: { fun: 12 }, bubble: "Cheese", done: "Guards waved you on after one photo. Aso Rock filled the whole background." },
        { id: "tour", label: "Guided tour of the Villa grounds", dur: 120, cost: 5000, weekdays: true, hours: [10, 15], fx: { fun: 35, social: 8, energy: -12 }, informed: 2, civic: 1, bubble: "Touring", done: "The guide showed you the gardens, the old council chamber and where state visitors arrive. No cameras inside." },
        { id: "hike", label: "Walk round the foot of Aso Rock", dur: 90, fx: { fun: 25, energy: -20 }, bubble: "Hiking", done: "Granite walls rose 400 metres above you. Abuja looked small from the path." },
      ]
      : [{ id: "visit", label: `Visit ${lm}`, dur: 90, fx: { fun: 30, social: 5, energy: -10 }, bubble: "Wow", done: `You spent the afternoon at ${lm}.` }],
    supermarket: SUPERMARKET_ACTIONS,
    boutique: OUTFIT_ACTIONS,
    cardealer: CAR_ACTIONS,
    estateagent: HOUSE_ACTIONS,
    shelter: [{ id: "bed", label: "Ask for a bed", dur: 60, fx: {}, shelter: true, bubble: "Waiting", done: "" }],
    club: nightActions(c.state.code, c.cls),
    bank: BANK_ACTIONS,
    airport: [
      { id: "planes", label: "Watch the planes take off", dur: 45, fx: { fun: 14 }, bubble: "Wow", done: "A jet thundered down the runway and climbed over the town." },
    ],
    terminal: [
      { id: "coach", label: "Watch the coaches load", dur: 30, fx: { fun: 6, social: 6 }, overhear: true, bubble: "Gisting", done: "Travellers argued about fares and the election while bags went on the roof." },
    ],
    station: [
      { id: "train", label: "Watch the train come in", dur: 30, fx: { fun: 10 }, bubble: "Choo choo", done: "The train came in two hours late, horn blaring. Children waved." },
    ],
    raavon: RAAVON_ACTIONS,
    hotel: [
      ...anywhere,
      { id: "lodge", label: `Take a room for the night (${LODGING[c.cls].name.toLowerCase()})`, dur: 480, sleep: true, cost: LODGING[c.cls].price, fx: { energy: 100, hygiene: 40 }, bubble: "Zzz", done: "You slept well away from home." },
      { id: "drink", label: "Cold drink at the bar", dur: 30, cost: 1000, fx: { fun: 10, social: 8 }, overhear: true, bubble: "Sipping", done: "Cold drink at the hotel bar." },
    ],
  };
}
