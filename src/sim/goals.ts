import { START_PLACE } from "../data/ilorin/places";
import type { GameState } from "./state";

export interface GoalStatus {
  label: string;
  done: boolean;
}

export function goals(s: GameState): GoalStatus[] {
  return [
    { label: "Get a civil service job", done: !!s.flags.job },
    { label: "Move into an estate", done: s.homeId !== START_PLACE },
    { label: "Buy a new phone", done: !!s.goals.phone },
    { label: "Ride a Durbar horse", done: !!s.flags.rode },
    { label: "Visit KWASU in Malete", done: !!s.flags.kwasu },
    { label: "Fly to Lagos", done: !!s.goals.fly },
  ];
}
