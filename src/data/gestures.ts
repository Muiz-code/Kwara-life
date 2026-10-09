// What your character physically does while an action plays out inside a place: lie on the bed to
// sleep, switch the TV on and sit down to watch it, kneel on the mat to pray. Pure data: the 3D room
// walks the player to the nearest prop of the right kind and plays the pose until the action ends.

/** The body's position. */
export type GesturePose =
  | "lie" | "sit" | "stand" | "kneel" | "walk" | "dance" | "talk" | "pray" | "eat" | "drink" | "type" | "read"
  | "wash" | "cook" | "phone" | "lift" | "swim" | "clap" | "look";

/** What the player goes to in the room, or null to stay where they are. */
export type GestureProp =
  | "bed" | "mat" | "sofa" | "tv" | "radio" | "stove" | "bucket" | "desk" | "laptop" | "counter" | "table" | "pew"
  | "prayermat" | "dancefloor" | "bar" | "bvas" | "ballotbox" | "board" | "chair" | "screen" | "pool" | "gym" | "mirror"
  | "window" | "door" | "shelf";

export interface Gesture {
  pose: GesturePose;
  prop: GestureProp | null;
  /** Switch the prop on first (the TV screen lights up, the radio plays, the cooker flame comes on). */
  switchOn?: boolean;
  /** A second prop the player faces while posed: sit on the sofa, facing the TV. */
  faces?: GestureProp;
}

const g = (pose: GesturePose, prop: GestureProp | null = null, extra: Partial<Gesture> = {}): Gesture => ({ pose, prop, ...extra });

/** Every action by id. Ids shared by different places mean the same thing everywhere. */
const BY_ID: Record<string, Gesture> = {
  // Home
  sleep: g("lie", "bed"),
  nap: g("lie", "bed"),
  bath: g("wash", "bucket"),
  cook: g("cook", "stove", { switchOn: true }),
  tv: g("sit", "sofa", { faces: "tv", switchOn: true }),
  radio: g("sit", "chair", { faces: "radio", switchOn: true }),
  phone: g("phone", "sofa"),
  // Food and drink
  eat: g("eat", "table"),
  amala: g("eat", "table"),
  jollof: g("eat", "table"),
  shawarma: g("eat", "table"),
  caf: g("eat", "table"),
  canteen: g("eat", "table"),
  mamaput: g("eat", "table"),
  melbourne: g("eat", "table"),
  tart: g("eat", "table"),
  yogurt: g("eat", "table"),
  coldstone: g("eat", "table"),
  suya: g("eat", "table"),
  bar: g("drink", "bar"),
  drink: g("drink", "bar"),
  zobo: g("drink", "counter"),
  table: g("drink", "table"),
  // Shopping: pick it off the counter
  food: g("talk", "counter"),
  groc: g("talk", "shelf"),
  yam: g("talk", "counter"),
  mango: g("talk", "counter"),
  corn: g("talk", "counter"),
  wara: g("talk", "counter"),
  fabric: g("look", "shelf"),
  gadgets: g("look", "shelf"),
  buyradio: g("talk", "counter"),
  buytv: g("talk", "counter"),
  newphone: g("talk", "counter"),
  screen: g("talk", "counter"),
  paper: g("read", "counter"),
  glance: g("read", "board"),
  haircut: g("sit", "chair", { faces: "mirror" }),
  // Gisting and socialising
  gist: g("talk", "table"),
  haggle: g("talk", "counter"),
  drivers: g("talk", null),
  elders: g("talk", "chair"),
  aisha: g("talk", "chair"),
  aisha2: g("talk", "chair"),
  basira: g("talk", "counter"),
  kayode: g("talk", "chair"),
  hostel: g("talk", "chair"),
  date: g("eat", "table"),
  naming: g("clap", "chair"),
  chill: g("talk", null),
  cousin: g("talk", "door"),
  // Fun
  dance: g("dance", "dancefloor"),
  concert: g("dance", "dancefloor"),
  football: g("sit", "chair", { faces: "screen" }),
  match: g("sit", "chair", { faces: "screen" }),
  movie: g("sit", "chair", { faces: "screen" }),
  vnews: g("sit", "chair", { faces: "screen" }),
  snooker: g("stand", "table"),
  swim: g("swim", "pool"),
  gym: g("lift", "gym"),
  jog: g("walk", null),
  walk: g("walk", null),
  picnic: g("sit", "mat"),
  people: g("look", "window"),
  planes: g("look", "window"),
  train: g("look", "window"),
  coach: g("look", "window"),
  cattle: g("look", null),
  photo: g("stand", "door"),
  tour: g("walk", null),
  hike: g("walk", null),
  snacks: g("eat", "counter"),
  foodstuff: g("talk", "shelf"),
  visit: g("look", null),
  // Faith
  pray: g("pray", "prayermat"),
  cpray: g("kneel", "pew"),
  jummah: g("pray", "prayermat"),
  tafsir: g("sit", "prayermat"),
  service: g("clap", "pew"),
  vigil: g("clap", "pew"),
  // Civic
  register: g("talk", "desk"),
  check: g("read", "board"),
  collect: g("talk", "desk"),
  help: g("talk", "desk"),
  edu: g("sit", "chair", { faces: "board" }),
  debate: g("sit", "chair", { faces: "board" }),
  townhall: g("sit", "chair", { faces: "board" }),
  seminar: g("sit", "chair", { faces: "board" }),
  lecture: g("sit", "desk", { faces: "board" }),
  readfly: g("read", "board"),
  postfly: g("stand", "board"),
  vote: g("stand", "ballotbox"),
  bribe: g("talk", null),
  // Work, learning and money
  apply: g("talk", "desk"),
  learn: g("type", "laptop"),
  library: g("read", "desk"),
  tutor: g("talk", "desk"),
  gig: g("type", "laptop"),
  site: g("talk", "desk"),
  pitch: g("talk", "desk"),
  recruit: g("talk", "desk"),
  officer: g("talk", "desk"),
  carhire: g("talk", "desk"),
  atm: g("stand", "screen"),
  pos: g("type", "counter"),
  hustle: g("talk", "counter"),
  load: g("lift", null),
  // Lodging
  lodge: g("lie", "bed"),
  bed: g("talk", "desk"),
  rent: g("talk", "desk"),
  horse: g("talk", null),
  fly: g("talk", "counter"),
};

/** Side hustles (h-*): what each one looks like. */
const HUSTLE: Record<string, Gesture> = {
  "h-braid": g("sit", "chair"),
  "h-data": g("phone", "counter"),
  "h-delivery": g("walk", null),
  "h-design": g("type", "laptop"),
  "h-pos": g("type", "counter"),
  "h-puff": g("cook", "stove", { switchOn: true }),
  "h-skit": g("dance", null),
  "h-tutor": g("talk", "desk"),
};

/** A work shift looks like the job: typing at a desk in an office, serving at a counter in a shop. */
const WORK_BY_PLACE: Record<string, Gesture> = {
  office: g("type", "desk"),
  tower: g("type", "desk"),
  techhub: g("type", "laptop"),
  school: g("sit", "desk", { faces: "board" }),
  market: g("talk", "counter"),
  workshop: g("lift", "counter"),
  bank: g("type", "desk"),
};

/** Words in a label, for actions added later that aren't listed above. */
const BY_WORD: [RegExp, Gesture][] = [
  [/\b(sleep|nap|night|room)\b/i, g("lie", "bed")],
  [/\b(pray|jummah|mosque)\b/i, g("pray", "prayermat")],
  [/\b(eat|dinner|lunch|breakfast|rice|chicken)\b/i, g("eat", "table")],
  [/\b(drink|chapman|zobo)\b/i, g("drink", "bar")],
  [/\b(watch|movie|news|match)\b/i, g("sit", "chair", { faces: "screen" })],
  [/\b(dance|party)\b/i, g("dance", "dancefloor")],
  [/\b(read|library|paper)\b/i, g("read", "desk")],
  [/\b(code|laptop|design)\b/i, g("type", "laptop")],
  [/\b(buy|price|shop)\b/i, g("talk", "counter")],
  [/\b(gist|talk|meet|visit)\b/i, g("talk", null)],
];

/**
 * What the player does during an action. placeKind is the place's art kind ("office", "market"), used
 * for work shifts; label is a fallback for actions that aren't in the table yet.
 */
export function gestureFor(actionId: string, placeKind?: string, label = ""): Gesture {
  if (actionId === "work") return WORK_BY_PLACE[placeKind ?? ""] ?? g("stand", "counter");
  if (Object.hasOwn(BY_ID, actionId)) return BY_ID[actionId];
  if (Object.hasOwn(HUSTLE, actionId)) return HUSTLE[actionId];
  // Buying furniture, a phone, clothes, a car or a house: done at the counter.
  if (/^(buy|phone|cloth|car|house)-/.test(actionId)) return g("talk", "counter");
  for (const [re, gesture] of BY_WORD) if (re.test(label)) return gesture;
  return g("stand", null);
}
