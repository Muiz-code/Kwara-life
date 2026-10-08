// The Explorer mission: see Nigeria. Every state you set foot in counts, your own included, with a notice
// at each milestone and one for reaching every one of the six zones.
import { STATE, STATES } from "../data/states";
import { note, type GameState } from "./state";

/** How many states make each milestone, and what it is called. */
export const EXPLORER_STEPS: [number, string][] = [
  [3, "Road tripper"],
  [6, "Explorer"],
  [12, "Seasoned traveller"],
  [20, "Naija nomad"],
  [STATES.length, "Seen it all"],
];

const ZONES = new Set(STATES.map((s) => s.zone));

/** The next milestone, or null once every state is done. */
export function nextStep(visited: number): [number, string] | null {
  return EXPLORER_STEPS.find(([n]) => n > visited) ?? null;
}

/** The title you have earned so far, or null. */
export function explorerTitle(visited: number): string | null {
  return [...EXPLORER_STEPS].reverse().find(([n]) => visited >= n)?.[1] ?? null;
}

/** Zones you have been to. */
export const zonesVisited = (s: GameState) => new Set(s.visited.map((c) => STATE[c]?.zone).filter(Boolean));

/** Mutates s: mark a state as visited, with a notice for a milestone. */
export function markVisited(s: GameState, stateCode: string) {
  if (!STATE[stateCode] || s.visited.includes(stateCode)) return;
  const zonesBefore = zonesVisited(s).size;
  s.visited = [...s.visited, stateCode];
  const n = s.visited.length;
  const step = EXPLORER_STEPS.find(([k]) => k === n);
  if (step) {
    note(s, `${step[1]}: ${n} states`, n === STATES.length ? "Every state in Nigeria, all thirty-six and the FCT. Nobody can tell you anything about this country." : `You have now been to ${n} of ${STATES.length} states. ${nextStep(n) ? `${nextStep(n)![0]} makes you a ${nextStep(n)![1].toLowerCase()}.` : ""}`);
    s.toasts.push(`Explorer: ${step[1]}`);
  }
  if (zonesBefore < ZONES.size && zonesVisited(s).size === ZONES.size) {
    note(s, "All six zones", "North-West, North-East, North-Central, South-West, South-East and South-South: you have stood in every corner of Nigeria.");
    s.toasts.push("Explorer: all six zones");
  }
}
