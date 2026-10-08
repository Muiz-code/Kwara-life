// How citizens get around, by class (from reference/naija-votes-2027.html). Distances are world pixels.
// The Ilorin map also has its own modes (keke, okada, korope, Durbar horse) in src/sim/travel.ts; the two
// are merged in phase B.
import type { ClassId } from "./jobs";

export type NaijaModeId = "walk" | "okada" | "danfo" | "keke" | "ride" | "suv";

export interface NaijaMode {
  label: string;
  /** Short phrase for the journal: "You went to the market ___". */
  by: string;
  minutes: (d: number) => number;
  fare: (d: number) => number;
}

export const NAIJA_MODES: Record<NaijaModeId, NaijaMode> = {
  walk: { label: "Walk", by: "on foot", minutes: (d) => Math.round(d / 6), fare: () => 0 },
  okada: { label: "Okada", by: "by okada", minutes: (d) => Math.round(3 + d / 40), fare: (d) => 100 + Math.round(d / 300) * 50 },
  danfo: { label: "Danfo bus", by: "by danfo bus", minutes: (d) => Math.round(10 + d / 30), fare: (d) => 150 + Math.round(d / 500) * 50 },
  keke: { label: "Keke", by: "by keke", minutes: (d) => Math.round(4 + d / 32), fare: (d) => 150 + Math.round(d / 250) * 50 },
  ride: { label: "Ride-hailing", by: "in a ride-hailing car", minutes: (d) => Math.round(3 + d / 45), fare: (d) => 900 + Math.round(d / 100) * 100 },
  suv: { label: "Your SUV", by: "in your SUV with a driver", minutes: (d) => Math.round(3 + d / 45), fare: () => 0 },
};

/** Modes each class can use. Everyone can walk. */
export const MODES_BY_CLASS: Record<ClassId, NaijaModeId[]> = {
  poor: ["walk", "okada", "danfo"],
  middle: ["walk", "keke", "ride"],
  rich: ["walk", "suv"],
};

export const MODE_LINES: Record<NaijaModeId, string[]> = {
  walk: ["Sun dey shine well well.", "You greet the mallam at the junction.", "A pothole full of water. You jump it."],
  okada: ['The okada man says: "Hold well o!"', "He weaves through traffic.", "Helmet? Na story."],
  danfo: ['Conductor: "Enter with your change!"', "The driver is playing fuji at full volume.", "Someone is preaching in the bus."],
  keke: ["The keke man takes a shortcut.", '"Drop for front!"', "Three passengers at the back, very tight."],
  ride: ["The driver asks you to cancel and pay cash.", "AC is working today.", "Waze says 12 minutes."],
  suv: ['Gateman: "Morning oga!"', "Phone cameras flash from the pavement.", "Security salutes you."],
};
