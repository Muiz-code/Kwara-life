// Job hunting: openings on the notice board, applications, and a random hiring decision weighted by
// qualifications, how informed you are, competition, and a little "long leg" for the rich.
import { CAREERS, EDUCATION_RANK, MINIMUM_WAGE, type CareerId, type Education } from "../data/careers";
import { seeded, type Rng } from "./rng";
import { clone, log, naira, note, type GameState, type JobApplication } from "./state";
import { dayNum } from "./time";
import { book } from "./bank";
import { inviteToInterview } from "./interview";

export interface Opening {
  id: string;
  career: CareerId;
  title: string;
  monthly: number;
  minEducation: Education;
  applicants: number;
  /** Connections needed to apply (the political ladder). */
  minConnections?: number;
}

/** One rung of the political ladder: who you know matters as much as what you know. */
interface Rung {
  title: string;
  minEducation: Education;
  minConnections: number;
  pay: [number, number];
}

/** Ward coordinator, then special assistant, then commissioner's aide. */
export const POLITICAL_LADDER: Rung[] = [
  { title: "Ward coordinator", minEducation: "secondary", minConnections: 15, pay: [150000, 300000] },
  { title: "Special assistant", minEducation: "secondary", minConnections: 35, pay: [300000, 700000] },
  { title: "Commissioner's aide", minEducation: "degree", minConnections: 60, pay: [600000, 1500000] },
];

/** Kinds of openings, each with a realistic monthly pay band (never below minimum wage). */
const HIRING: { career: CareerId; titles: string[]; minEducation: Education; pay: [number, number]; ladder?: Rung[] }[] = [
  { career: "worker", titles: ["Security guard", "Office cleaner", "Sales rep", "Driver"], minEducation: "none", pay: [MINIMUM_WAGE, 110000] },
  { career: "worker", titles: ["Customer care officer", "Admin officer", "Cashier"], minEducation: "ond", pay: [90000, 180000] },
  { career: "worker", titles: ["Secondary school teacher", "Bank teller", "Accountant", "Nurse", "Civil servant"], minEducation: "degree", pay: [150000, 400000] },
  { career: "developer", titles: ["Junior developer", "Product designer"], minEducation: "secondary", pay: [250000, 900000] },
  // The political ladder sits in one slot, so adding rungs doesn't reshuffle every town's board.
  { career: "politician", titles: POLITICAL_LADDER.map((r) => r.title), minEducation: "secondary", pay: [150000, 500000], ladder: POLITICAL_LADDER },
  // Big companies' graduate trainee programmes: well paid, lots of applicants, everyone qualified is interviewed.
  { career: "worker", titles: ["Klario Bank Graduate Trainee", "Zenvest Bank Graduate Trainee", "Okanla Energy Graduate Trainee"], minEducation: "degree", pay: [280000, 450000] },
  { career: "developer", titles: ["Raavon Graduate Programme"], minEducation: "degree", pay: [350000, 600000] },
];

const hashStr = (s: string) => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** This week's openings in an LGA. The same for everyone in the LGA that week. */
export function openings(lgaCode: string, gameDay: number): Opening[] {
  const week = Math.floor((gameDay - 1) / 7);
  const R = seeded(hashStr(`${lgaCode}#${week}`));
  const n = 3 + Math.floor(R() * 3);
  return Array.from({ length: n }, (_, i) => {
    const h = HIRING[Math.floor(R() * HIRING.length)];
    const career = h.career;
    const t = Math.floor(R() * h.titles.length);
    const rung = h.ladder?.[t];
    const pay = rung?.pay ?? h.pay;
    return {
      id: `${lgaCode}#${week}#${i}`,
      career,
      title: h.titles[t],
      monthly: Math.round((pay[0] + Math.pow(R(), 2) * (pay[1] - pay[0])) / 1000) * 1000,
      minEducation: rung?.minEducation ?? h.minEducation,
      applicants: 20 + Math.floor(R() * 480),
      ...(rung ? { minConnections: rung.minConnections } : {}),
    };
  });
}

export const MAX_PENDING = 3;
export const CV_PRINTING = 500;

/** Apply for an opening. The employer decides in 2 to 5 game days. */
export function applyForJob(state: GameState, picked: Pick<Opening, "id">, rng: Rng): GameState | { blocked: string } {
  const c = state.citizen;
  if (!c) return { blocked: "Create your citizen first" };
  // Only the id is trusted. Pay, title and qualifications come from this week's board where the
  // citizen is, so a doctored opening (a ₦1bn salary) is never accepted.
  const o = openings(state.at ?? c.lgaCode, dayNum(state.t)).find((x) => x.id === picked?.id);
  if (!o) return { blocked: "That opening has closed" };
  if (c.employed && c.career === o.career && c.job === o.title) return { blocked: "You already do this job" };
  if (state.applications.some((a) => a.id === o.id)) return { blocked: "You already applied" };
  if (state.applications.length >= MAX_PENDING) return { blocked: "Wait to hear back from your other applications" };
  if (EDUCATION_RANK[c.education] < EDUCATION_RANK[o.minEducation]) return { blocked: "You don't have the qualification for this one" };
  if (o.minConnections && state.connections < o.minConnections)
    return { blocked: `You need more connections for this (${state.connections} of ${o.minConnections}). Gist, go to owambes, church or mosque and town halls, and make friends` };
  if (state.money < CV_PRINTING) return { blocked: "You need ₦500 to print your CV" };
  const s = clone(state);
  book(s, -CV_PRINTING, "CV printing", "bills");
  const app: JobApplication = { ...o, decideDay: dayNum(s.t) + 2 + Math.floor(rng() * 4) };
  s.applications.push(app);
  log(s, `You applied to be a ${o.title.toLowerCase()} along with ${o.applicants} others.`);
  return s;
}

/** Chance of getting an offer. */
export function hireChance(s: GameState, app: Pick<JobApplication, "minEducation" | "applicants">): number {
  const c = s.citizen!;
  const extraEducation = EDUCATION_RANK[c.education] - EDUCATION_RANK[app.minEducation];
  let p = 0.2 + extraEducation * 0.07;
  p += Math.min(0.15, s.informed / 200);
  p -= Math.min(0.12, app.applicants / 4000);
  if (c.cls === "rich") p += 0.1; // long leg
  p += Math.min(0.1, (s.connections ?? 0) / 600); // knowing people helps everywhere
  return Math.max(0.05, Math.min(0.85, p));
}

/** Mutates s: employers whose decision day has come reply. Call once a game day. */
export function decideApplications(s: GameState, rng: Rng) {
  const c = s.citizen;
  if (!c) return;
  const today = dayNum(s.t);
  const due = s.applications.filter((a) => a.decideDay <= today);
  s.applications = s.applications.filter((a) => a.decideDay > today);
  for (const app of due) {
    // A strong application gets a call to interview; the interview decides the offer.
    if (inviteToInterview(s, app, rng)) return;
    if (/Graduate/.test(app.title)) {
      log(s, `${app.title} sent a "regret" email. Their programme is very competitive.`);
      continue;
    }
    if (rng() < hireChance(s, app) * 0.4) {
      c.career = app.career;
      c.job = app.title;
      c.employed = true;
      c.monthlyPay = app.monthly;
      s.applications = [];
      note(s, "You got the job", `You start as a ${app.title.toLowerCase()} on ${naira(app.monthly)} a month. Resume at the office on your next working day.`);
      log(s, `Hired as a ${app.title.toLowerCase()}.`);
      return;
    }
    if (rng() < 0.5) log(s, `The ${app.title.toLowerCase()} people said they will call you back. They did not.`);
    else log(s, `No reply about the ${app.title.toLowerCase()} job. Na so e be.`);
  }
}

/** Highest monthly pay a career can have, rolled at the start or offered on a board. */
export function maxMonthly(career: CareerId): number {
  return Math.max(CAREERS[career]?.max ?? 0, ...HIRING.filter((h) => h.career === career).flatMap((h) => [h.pay[1], ...(h.ladder ?? []).map((r) => r.pay[1])]));
}

/** The opening an application was made to, rebuilt from its id ("lga#week#i"), or undefined. */
export function openingById(id: string): Opening | undefined {
  const m = /^(.+)#(\d+)#\d+$/.exec(id);
  if (!m) return undefined;
  return openings(m[1], Number(m[2]) * 7 + 1).find((o) => o.id === id);
}
