// Odds for the one-time citizen roll (docs/DESIGN.md, "Citizen roll"). The roll itself is in src/sim/roll.ts.
import type { ClassId } from "./jobs";

/** Cumulative: poor 63%, middle 32%, rich 5%. */
export const CLASS_ODDS: [ClassId, number][] = [
  ["poor", 0.63],
  ["middle", 0.32],
  ["rich", 0.05],
];

/** Share of poor citizens who sleep under a flyover. Written with dignity; the shelter quest can move them indoors. */
export const UNDER_FLYOVER = 0.15;

/** PVC at start: 55% have it, 25% registered but uncollected, 20% unregistered. */
export const PVC_ODDS = { have: 0.55, registered: 0.25, none: 0.2 };

/** Chance of owning a TV and a radio at start, by class. Under-flyover citizens: no TV, radio 30%. */
export const MEDIA_ODDS: Record<ClassId, { tv: number; radio: number }> = {
  rich: { tv: 1, radio: 1 },
  middle: { tv: 0.85, radio: 0.7 },
  poor: { tv: 0.2, radio: 0.6 },
};
export const UNDER_FLYOVER_RADIO = 0.3;
