// STUB so the town generator compiles. The parent session owns this file and is
// filling it from research; replace this whole file with theirs.
export interface DistrictNames {
  rich: string[];
  mixed: string[];
  poor: string[];
  sources: string[];
}

/** Keyed by LGA code from src/data/geography.ts, e.g. "kwara/offa". Missing LGAs or empty lists fall back to generic names. */
export const LGA_DISTRICTS: Record<string, DistrictNames> = {};

export const GENERIC_DISTRICTS: { rich: string[]; mixed: string[]; poor: string[] } = {
  rich: ["GRA"],
  mixed: ["Old Town", "New Layout"],
  poor: ["Low-cost", "Railway Line"],
};
