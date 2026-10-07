// Stable codes for LGAs and polling units. Codes are used in the database, so never change one once live.
import { STATES, type State } from "./states";

export interface Lga {
  /** e.g. "kwara/ilorin-west" */
  code: string;
  stateCode: string;
  name: string;
}

export interface PollingUnit {
  /** e.g. "kwara/ilorin-west/1" */
  code: string;
  lgaCode: string;
  /** Real INEC polling unit name. Placeholder until the INEC list is imported. */
  name: string;
}

export const POLLING_UNITS_PER_LGA = 3;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const lgaCode = (state: State, lga: string) => `${state.code}/${slug(lga)}`;

export const LGAS: Lga[] = STATES.flatMap((s) => s.lgas.map((name) => ({ code: lgaCode(s, name), stateCode: s.code, name })));

export const LGA: Record<string, Lga> = Object.fromEntries(LGAS.map((l) => [l.code, l]));

export const POLLING_UNITS: PollingUnit[] = LGAS.flatMap((l) =>
  Array.from({ length: POLLING_UNITS_PER_LGA }, (_, i) => ({ code: `${l.code}/${i + 1}`, lgaCode: l.code, name: `Polling Unit ${i + 1}` })),
);

/** LGAs that use the hand-built Ilorin map instead of a generated one. */
export const ILORIN_LGAS = ["kwara/ilorin-west", "kwara/ilorin-east", "kwara/ilorin-south"];
