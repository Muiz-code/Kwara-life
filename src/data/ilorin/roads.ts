// Road network between places and waypoints. Ported from reference/kwara-life.html.

export interface Road {
  a: string;
  b: string;
  name: string;
  /** Highway: the long Malete road. No okadas, police checkpoints, korope breakdowns. */
  highway?: boolean;
}

const r = (a: string, b: string, name: string, highway?: boolean): Road =>
  highway ? { a, b, name, highway } : { a, b, name };

export const ROADS: Road[] = [
  r("po", "palace", "Ibrahim Taiwo Rd"),
  r("palace", "adabata", "Adabata Rd"),
  r("palace", "sobi", "Sobi Rd"),
  r("sobi", "shao", "Shao Rd", true),
  r("shao", "farm", "Malete Rd", true),
  r("farm", "kwasu", "Malete Rd", true),
  r("po", "taiwo", "Taiwo Rd"),
  r("taiwo", "adabata", ""),
  r("taiwo", "stadium", "Ibrahim Taiwo Rd"),
  r("stadium", "sawmill", "Sawmill Rd"),
  r("sawmill", "adewole", "Adewole Rd"),
  r("sawmill", "geri", "Abdul Azeez Attah Rd"),
  r("geri", "airport", "Airport Rd"),
  r("po", "metro", "Unity Rd"),
  r("metro", "irewolede", "Asa Dam Rd"),
  r("irewolede", "geri", "Asa Dam Rd"),
  r("po", "secretariat", "Ahmadu Bello Way"),
  r("secretariat", "hotel", "Ahmadu Bello Way"),
  r("hotel", "hub", "Ahmadu Bello Way"),
  r("hub", "govhouse", "Ahmadu Bello Way"),
  r("govhouse", "flower", "Reservation Rd"),
  r("po", "amala", "Murtala Mohammed Way"),
  r("flower", "amala", ""),
  r("amala", "mall", "Fate Rd"),
  r("mall", "froyo", "Fate Rd"),
  r("froyo", "fate", "Fate Rd"),
  r("fate", "home", "Tanke Rd"),
  r("home", "item7", "Tanke Rd"),
  r("item7", "okeodo", "Unilorin Rd"),
  r("okeodo", "unilorin", "Unilorin Rd"),
  r("home", "evergreen", "Taoheed Rd"),
  r("fate", "poly", "Sango Rd"),
  // Added after the prototype.
  r("taiwo", "klario", "Taiwo Rd"),
  r("hub", "raavon", "Ahmadu Bello Way"),
  r("item7", "club", "Tanke Rd"),
  r("palace", "station", "Asa Dam Rd"),
  r("sobi", "terminal", "Sobi Rd"),
];

/** How many roads the prototype had. */
export const PROTOTYPE_ROADS = 32;
