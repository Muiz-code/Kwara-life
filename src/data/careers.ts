// Careers: what a citizen does for money (docs/DECISIONS.md "Work and Nigerian life").
// Pay is monthly where it is a salary; a game month is 22 working days. Floors: N70,000 minimum wage,
// N77,000 NYSC allawee. Risky careers (yahoo, laundering) build "heat" that brings EFCC.
import type { ClassId } from "./jobs";

export type CareerId =
  | "student" | "corper" | "worker" | "artisan" | "trader" | "creator" | "developer" | "herbalist"
  | "politician" | "yahoo" | "launderer" | "executive" | "founder";

export type Education = "none" | "secondary" | "ond" | "degree" | "masters";

export const EDUCATION_RANK: Record<Education, number> = { none: 0, secondary: 1, ond: 2, degree: 3, masters: 4 };
export const EDUCATION_LABEL: Record<Education, string> = {
  none: "No formal school", secondary: "SSCE", ond: "OND", degree: "BSc", masters: "MSc",
};

export const MINIMUM_WAGE = 70000;
export const NYSC_ALLAWEE = 77000;
export const WORKDAYS_PER_MONTH = 22;

export type PayKind =
  /** Fixed monthly pay, earned a day's share per shift. */
  | "salary"
  /** Earned per day of work, varies a lot. */
  | "daily"
  /** Mostly nothing, sometimes a big hit. */
  | "hits";

export interface Career {
  label: string;
  /** Job titles to pick from. */
  titles: string[];
  pay: PayKind;
  /** Monthly range for salaries, per working day for daily, per hit for hits. */
  min: number;
  max: number;
  /** Chance a shift pays out, for "hits" careers. */
  hitChance?: number;
  /** Game minutes a work session takes. */
  shiftMinutes: number;
  /** What the work action is called. */
  workLabel: string;
  /** Where the work happens: the citizen's workplace, or anywhere (laptop and phone work). */
  where: "work" | "anywhere";
  /** Needs light or a generator to work (laptops). */
  needsLight?: boolean;
  /** EFCC heat added each work session (0 to 100 scale). */
  heat?: number;
  /** Police stop you more often (young, phone and laptop). */
  profiled?: boolean;
  /** Connections: police let you go, EFCC sends an invitation instead of a raid. */
  connected?: boolean;
  minEducation?: Education;
}

export const CAREERS: Record<CareerId, Career> = {
  student: {
    label: "Student", titles: ["Undergraduate", "Polytechnic student"], pay: "salary", min: 20000, max: 60000,
    shiftMinutes: 240, workLabel: "Attend lectures", where: "work", profiled: true,
  },
  corper: {
    label: "Corps member (NYSC)", titles: ["Corps member"], pay: "salary", min: NYSC_ALLAWEE, max: NYSC_ALLAWEE,
    shiftMinutes: 360, workLabel: "Work at your PPA", where: "work", minEducation: "ond",
  },
  worker: {
    label: "9 to 5", titles: ["Civil servant", "Secondary school teacher", "Nurse", "Banker", "Accountant", "Pharmacist", "Lawyer", "Journalist", "Security guard", "Office cleaner"],
    pay: "salary", min: MINIMUM_WAGE, max: 450000, shiftMinutes: 480, workLabel: "Go to work", where: "work",
  },
  artisan: {
    label: "Artisan", titles: ["Carpenter", "Tailor", "Bricklayer", "Vulcaniser", "Welder", "Barber", "Plumber", "Mechanic", "Generator repairer", "Okada rider", "Keke driver"],
    pay: "daily", min: 2500, max: 9000, shiftMinutes: 360, workLabel: "Work your trade", where: "work",
  },
  trader: {
    label: "Trader", titles: ["Market trader", "Hawker", "Provision shop owner", "Phone accessories seller"],
    pay: "daily", min: 2000, max: 12000, shiftMinutes: 360, workLabel: "Sell at the market", where: "work",
  },
  creator: {
    label: "Content creator", titles: ["Skit maker", "TikToker", "Instagram vendor", "Podcaster"],
    pay: "hits", min: 50000, max: 2000000, hitChance: 0.08, shiftMinutes: 180, workLabel: "Shoot content", where: "anywhere", profiled: true,
  },
  developer: {
    label: "Software developer", titles: ["Frontend developer", "Backend developer", "Mobile developer", "Product designer"],
    pay: "salary", min: 400000, max: 1500000, shiftMinutes: 420, workLabel: "Write code", where: "anywhere", needsLight: true, profiled: true, minEducation: "secondary",
  },
  herbalist: {
    label: "Herbalist", titles: ["Agbo seller", "Traditional medicine seller", "Herbal clinic owner"],
    pay: "daily", min: 2000, max: 8000, shiftMinutes: 300, workLabel: "Sell herbal remedies", where: "work",
  },
  politician: {
    label: "Politician", titles: ["Councillor", "Special assistant", "Party chieftain", "Ward leader"],
    pay: "salary", min: 500000, max: 5000000, shiftMinutes: 240, workLabel: "Attend to constituents", where: "work", connected: true, heat: 2,
  },
  yahoo: {
    label: "Yahoo", titles: ["Yahoo boy", "Yahoo girl"],
    pay: "hits", min: 300000, max: 5000000, hitChance: 0.15, shiftMinutes: 240, workLabel: "Work on the laptop", where: "anywhere", needsLight: true, heat: 12, profiled: true,
  },
  launderer: {
    label: "Businessman (questionable money)", titles: ["Businessman", "Bureau de change operator", "Contractor"],
    pay: "hits", min: 1000000, max: 20000000, hitChance: 0.25, shiftMinutes: 180, workLabel: "Move money", where: "anywhere", heat: 10,
  },
  executive: {
    label: "Executive", titles: ["Oil and gas executive", "Bank MD", "Real estate developer", "Telecom investor", "Manufacturing magnate", "Shipping and logistics owner"],
    pay: "salary", min: 3000000, max: 20000000, shiftMinutes: 300, workLabel: "Board meetings", where: "work", connected: true, minEducation: "degree",
  },
  founder: {
    label: "Startup founder", titles: ["Fintech founder", "Logistics startup founder", "Agritech founder"],
    pay: "hits", min: 2000000, max: 30000000, hitChance: 0.2, shiftMinutes: 420, workLabel: "Build the startup", where: "anywhere", needsLight: true, minEducation: "secondary",
  },
};

/** Career odds at the start, by class. Each list sums to 1. */
export const CAREER_ODDS: Record<ClassId, [CareerId, number][]> = {
  poor: [["artisan", 0.32], ["trader", 0.22], ["student", 0.14], ["herbalist", 0.07], ["creator", 0.08], ["yahoo", 0.07], ["worker", 0.06], ["corper", 0.04]],
  middle: [["worker", 0.38], ["developer", 0.12], ["creator", 0.09], ["corper", 0.1], ["student", 0.1], ["politician", 0.05], ["yahoo", 0.08], ["trader", 0.08]],
  rich: [["executive", 0.4], ["founder", 0.15], ["politician", 0.2], ["yahoo", 0.1], ["launderer", 0.15]],
};

/** Highest education at the start, by class (cumulative odds). */
export const EDUCATION_ODDS: Record<ClassId, [Education, number][]> = {
  poor: [["none", 0.15], ["secondary", 0.55], ["ond", 0.18], ["degree", 0.12]],
  middle: [["secondary", 0.1], ["ond", 0.2], ["degree", 0.55], ["masters", 0.15]],
  rich: [["secondary", 0.1], ["degree", 0.5], ["masters", 0.4]],
};

/** Students and corpers need the right education. */
export const careerFits = (c: CareerId, e: Education) => EDUCATION_RANK[e] >= EDUCATION_RANK[CAREERS[c].minEducation ?? "none"];
