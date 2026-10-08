// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
export type ClassId = "poor" | "middle" | "rich";

export const CLASS_LABEL: Record<ClassId, string> = { poor: "Poor", middle: "Middle class", rich: "Rich" };

export const JOBS: Record<ClassId, string[]> = {"poor":["Carpenter","Tailor","Bricklayer","Okada rider","Keke driver","Vulcaniser","Welder","Farmer","Market trader","Hawker","Barber","Cleaner","Mechanic apprentice","Plumber","Generator repairer"],"middle":["Software developer","Accountant","Secondary school teacher","Nurse","Banker","Civil servant","Lecturer","Pharmacist","Lawyer","Civil engineer","Journalist","Product designer"],"rich":["Unicorn startup founder","Oil and gas executive","Bank MD","Real estate developer","Telecom investor","Manufacturing magnate","Shipping and logistics owner"]};

/** Pay per shift as [min, max] naira, and shift length in game minutes. */
export const PAY: Record<ClassId, { min: number; max: number; shiftMinutes: number }> = {
  poor: { min: 3000, max: 6500, shiftMinutes: 300 },
  middle: { min: 22000, max: 45000, shiftMinutes: 480 },
  rich: { min: 900000, max: 4000000, shiftMinutes: 240 },
};

/** Starting money as [min, max] naira. */
export const START_MONEY: Record<ClassId, [number, number]> = {"poor":[2000,15000],"middle":[80000,400000],"rich":[20000000,300000000]};

export const HOMES: Record<ClassId, string[]> = {"poor":["Rented room in a face-me-I-face-you","Family compound","Shop space you sleep in"],"middle":["Two-bedroom flat","Mini flat","Self-contain in a quiet estate"],"rich":["Duplex in a gated estate","Penthouse","Family mansion"]};

export const WORK_STEPS: Record<ClassId, string[]> = {"poor":["Leaving home early","Looking for customers","Working with your hands","Customer pays small small","Counting the day's money"],"middle":["Commute","Morning meeting","Focused work","NEPA took light, generator on","Closing for the day"],"rich":["Driver at the gate","Board meeting","Investor call","Signing deals","Back home"]};

/** Where you work, by class. */
export const WORKPLACE: Record<ClassId, { name: string; kind: string }> = {
  poor: { name: "Workshop", kind: "workshop" },
  middle: { name: "Office", kind: "office" },
  rich: { name: "Company HQ", kind: "tower" },
};
