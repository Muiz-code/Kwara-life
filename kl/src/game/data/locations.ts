// Real Ilorin places with real coordinates. Ported from reference/kwara-life.html.

export type PlaceKind =
  | "junction" | "palace" | "oldtown" | "shops" | "stadium" | "garage" | "estate"
  | "airport" | "square" | "office" | "hotel" | "hub" | "govhouse" | "garden"
  | "buka" | "mall" | "house" | "market" | "campus" | "poly" | "village"
  | "farmstop" | "kwasu";

export interface Place {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
  blurb: string;
  /** Opening hours as [from, to) in 24h clock. [0, 24] means always open. */
  open: [number, number];
  /** Has a generator, so lights stay on when NEPA takes light. */
  gen: boolean;
  /** Art variant: a building colour for shops, or the estate class. */
  variant?: string;
}

export const PLACES: Place[] = [
  { id: "po", name: "Post Office", area: "City centre", lat: 8.4879, lng: 4.5644, kind: "junction", blurb: "The heartbeat of Ilorin. The overhead bridge, the old mast, garages and hawkers. Every road passes here.", open: [0, 24], gen: false },
  { id: "palace", name: "Emir's Palace", area: "Oja Oba", lat: 8.4975, lng: 4.5475, kind: "palace", blurb: "The Emir's palace, the Central Mosque and Oja Oba, the King's market. Durbar horses are hired here.", open: [6, 22], gen: false },
  { id: "adabata", name: "Adabata", area: "Old city", lat: 8.4898, lng: 4.5304, kind: "oldtown", blurb: "Old Ilorin. Compound houses, narrow streets, elders under the neem tree and the best mama put.", open: [6, 22], gen: false },
  { id: "taiwo", name: "Taiwo Oke", area: "Commercial hub", lat: 8.4813, lng: 4.5413, kind: "shops", blurb: "Phones, gadgets, appliances and banks. If you need it, Taiwo Oke has it.", open: [8, 19], gen: false, variant: "#2B4C7E" },
  { id: "stadium", name: "Kwara Stadium", area: "Ibrahim Taiwo Rd", lat: 8.474, lng: 4.5384, kind: "stadium", blurb: "Home of Kwara United. The boys play ball outside the gate every evening.", open: [0, 24], gen: false },
  { id: "sawmill", name: "Sawmill", area: "Garage and market", lat: 8.4712, lng: 4.525, kind: "garage", blurb: "Buses to Lagos and Ibadan, spare parts, wara, kulikuli and fila sellers.", open: [5, 22], gen: false },
  { id: "adewole", name: "Adewole Estate", area: "West", lat: 8.4812, lng: 4.5144, kind: "estate", blurb: "Well laid-out estate with duplexes and steady light. Expensive, but peaceful.", open: [0, 24], gen: true, variant: "rich" },
  { id: "airport", name: "Ilorin Airport", area: "Airport Rd, towards Eyenkorin", lat: 8.4337, lng: 4.4947, kind: "airport", blurb: "General Tunde Idiagbon International Airport. Small, calm, and no traffic on the way.", open: [0, 24], gen: true },
  { id: "metro", name: "Metro Square", area: "Asa Dam Rd", lat: 8.451, lng: 4.5497, kind: "square", blurb: "Metropolitan Square. Concerts, events and passing-out parades.", open: [6, 23], gen: false },
  { id: "irewolede", name: "Irewolede Estate", area: "Sapati Ile", lat: 8.4629, lng: 4.5524, kind: "estate", blurb: "Government estate for middle-income families. Tarred streets and a police post.", open: [0, 24], gen: false, variant: "mid" },
  { id: "secretariat", name: "State Secretariat", area: "Ahmadu Bello Way", lat: 8.4866, lng: 4.57, kind: "office", blurb: "The new Kwara State Secretariat. Ministries, files, and a steady salary.", open: [7, 17], gen: true },
  { id: "hotel", name: "Kwara Hotel", area: "Ahmadu Bello Way", lat: 8.4822, lng: 4.5754, kind: "hotel", blurb: "The old grand state hotel. Pool, gym and tennis court.", open: [6, 23], gen: true },
  { id: "hub", name: "Innovation Hub", area: "Ahmadu Bello Way", lat: 8.482, lng: 4.5771, kind: "hub", blurb: "Ilorin Innovation Hub. Fast wifi, cold AC and founders building things.", open: [9, 18], gen: true },
  { id: "govhouse", name: "Government House", area: "GRA", lat: 8.4805, lng: 4.5811, kind: "govhouse", blurb: "Seat of the Kwara State government. Big lawns and serious security.", open: [8, 18], gen: true },
  { id: "flower", name: "Flower Garden", area: "GRA", lat: 8.4867, lng: 4.5819, kind: "garden", blurb: "Serene park for picnics and evening hangouts. Beautiful at night.", open: [10, 22], gen: false },
  { id: "amala", name: "Amala Place", area: "Fate Rd", lat: 8.4991, lng: 4.582, kind: "buka", blurb: "Busy amala joint. Goat meat, cold zobo and Mama Basira behind the pots.", open: [7, 24], gen: false },
  { id: "mall", name: "Palms Mall", area: "Fate Rd", lat: 8.4984, lng: 4.5866, kind: "mall", blurb: "Cinema, snooker, Melbourne for fine dining, and Cold Stone for ice cream.", open: [9, 23], gen: true },
  { id: "froyo", name: "Frozencup", area: "Fate Rd, opposite Federal Secretariat", lat: 8.4957, lng: 4.5905, kind: "shops", blurb: "Frozen yogurt, fruit tarts and a cute spot for a date.", open: [12, 22], gen: true, variant: "#E39AB8" },
  { id: "home", name: "Tanke Compound", area: "Tanke", lat: 8.4812, lng: 4.6148, kind: "house", blurb: "Your face-me-I-face-you room in Tanke. Cheap rent, plenty neighbours.", open: [0, 24], gen: false },
  { id: "item7", name: "Item 7", area: "Tanke", lat: 8.4807, lng: 4.6289, kind: "shops", blurb: "The go-to student food spot. Jollof, fried rice, chicken and shawarma.", open: [8, 23], gen: true, variant: "#E67E22" },
  { id: "okeodo", name: "Oke-Odo", area: "Tanke", lat: 8.4785, lng: 4.633, kind: "market", blurb: "A junction that works like a market. Korope buses to campus leave from here.", open: [6, 22], gen: false },
  { id: "unilorin", name: "Unilorin", area: "Main gate", lat: 8.4809, lng: 4.6376, kind: "campus", blurb: "University of Ilorin. Better by far. Lectures, coursemates and long walks.", open: [7, 18], gen: true },
  { id: "evergreen", name: "Evergreen Estate", area: "Taoheed Rd", lat: 8.5019, lng: 4.614, kind: "estate", blurb: "Modern gated estate with private security and solar street lights.", open: [0, 24], gen: true, variant: "modern" },
  { id: "poly", name: "Kwara Poly", area: "Sango Rd", lat: 8.5547, lng: 4.6349, kind: "poly", blurb: "Kwara State Polytechnic. Students always need tutors.", open: [7, 19], gen: true },
  { id: "shao", name: "Shao", area: "Ilorin to Malete road", lat: 8.5919, lng: 4.5599, kind: "village", blurb: "Small town on the way to Malete. Roasted corn, yams and mangoes by the road.", open: [6, 21], gen: false },
  { id: "farm", name: "Malete Road", area: "Savanna stretch", lat: 8.65, lng: 4.52, kind: "farmstop", blurb: "Open savanna, farms and Fulani cattle. Long road, fresh air.", open: [6, 19], gen: false },
  { id: "kwasu", name: "KWASU", area: "Malete", lat: 8.7165, lng: 4.4722, kind: "kwasu", blurb: "Kwara State University, Malete. Home of the biggest library in West Africa.", open: [7, 18], gen: true },
];

export const PLACE: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]));

/** Roundabouts that are road junctions, not places you can visit. */
export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const WAYPOINTS: Waypoint[] = [
  { id: "sobi", name: "Sobi", lat: 8.5383, lng: 4.5524 },
  { id: "geri", name: "Geri Alimi", lat: 8.4629, lng: 4.5209 },
  { id: "fate", name: "Fate Roundabout", lat: 8.4943, lng: 4.5941 },
];

export const START_PLACE = "home";
