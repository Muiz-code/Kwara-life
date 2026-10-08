// Nightlife: real clubs in the LGAs they are in (from web research, October 2026; clubs open and close,
// so check the list before launch), a local club elsewhere, and in the twelve states that apply Sharia
// law, where alcohol is banned, a relaxation spot with suya, zobo and football instead of a club.

export interface Club {
  name: string;
  /** Where it is, as people say it. */
  area: string;
}

/** Real clubs by state and LGA name (as in src/data/states.ts). */
export const REAL_CLUBS: Record<string, Record<string, Club>> = {
  lagos: { "Eti-Osa": { name: "Quilox", area: "Ozumba Mbadiwe Avenue, Victoria Island" } },
  fct: { "Abuja Municipal": { name: "Moscow Underground", area: "Adetokunbo Ademola Crescent, Wuse" } },
  rivers: {
    "Port Harcourt": { name: "Cubana", area: "Abacha Road, GRA" },
    "Obio/Akpor": { name: "PACHa Lounge and Nightclub", area: "Woji" },
  },
  oyo: { "Ibadan North": { name: "Plat'num Lounge", area: "Awolowo Avenue, Old Bodija" } },
  enugu: { "Enugu North": { name: "Illusion Nightclub", area: "Rangers Avenue, Independence Layout" } },
  edo: { Oredo: { name: "Krossfaya Lounge and Club", area: "Benin City" } },
  "cross-river": { "Calabar Municipal": { name: "Mirage Club", area: "Calabar" } },
  imo: { "Owerri Municipal": { name: "Cubana", area: "Owerri" } },
  kwara: { "Ilorin South": { name: "Klub Rush", area: "Tanke Road" } },
};

/** States that apply Sharia law: no nightclubs, a relaxation spot instead. */
export const SHARIA_STATES = new Set(["zamfara", "kano", "sokoto", "katsina", "bauchi", "borno", "jigawa", "kebbi", "yobe", "kaduna", "niger", "gombe"]);

export type NightSpot = Club & { kind: "club" | "lounge"; real: boolean };

/** The night spot in an LGA. */
export function nightSpot(stateCode: string, lgaName: string): NightSpot {
  const town = lgaName.split(/[ /-]/)[0];
  if (SHARIA_STATES.has(stateCode)) return { kind: "lounge", real: false, name: `${town} Relaxation Spot`, area: town };
  const real = REAL_CLUBS[stateCode]?.[lgaName];
  if (real) return { kind: "club", real: true, ...real };
  return { kind: "club", real: false, name: `${town} Lounge and Club`, area: town };
}
