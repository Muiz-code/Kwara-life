// Job hunting: openings on the notice board, applications, and a random hiring decision weighted by
// qualifications, how informed you are, competition, and a little "long leg" for the rich.
import { CAREERS, EDUCATION_RANK, type CareerId, type Education } from "../data/careers";
import { rollSalary } from "./roll";
import { seeded, type Rng } from "./rng";
import { clone, log, naira, note, type GameState, type JobApplication } from "./state";
import { dayNum } from "./time";

export interface Opening {
  id: string;
  career: CareerId;
  title: string;
  monthly: number;
  minEducation: Education;
  applicants: number;
}

const HIRING: { career: CareerId; titles: string[]; minEducation: Education }[] = [
  { career: "worker", titles: ["Security guard", "Office cleaner", "Sales rep"], minEducation: "none" },
  { career: "worker", titles: ["Secondary school teacher", "Bank teller", "Accountant", "Nurse", "Civil servant"], minEducation: "degree" },
  { career: "worker", titles: ["Customer care officer", "Admin officer"], minEducation: "ond" },
  { career: "developer", titles: ["Junior developer", "Product designer"], minEducation: "secondary" },
  { career: "politician", titles: ["Special assistant", "Ward coordinator"], minEducation: "secondary" },
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
    return {
      id: `${lgaCode}#${week}#${i}`,
      career,
      title: h.titles[Math.floor(R() * h.titles.length)],
      monthly: Math.max(CAREERS[career].min, rollSalary(career, R)),
      minEducation: h.minEducation,
      applicants: 20 + Math.floor(R() * 480),
    };
  });
}

export const MAX_PENDING = 3;
export const CV_PRINTING = 500;

/** Apply for an opening. The employer decides in 2 to 5 game days. */
export function applyForJob(state: GameState, o: Opening, rng: Rng): GameState | { blocked: string } {
  const c = state.citizen;
  if (!c) return { blocked: "Create your citizen first" };
  if (c.employed && c.career === o.career && c.job === o.title) return { blocked: "You already do this job" };
  if (state.applications.some((a) => a.id === o.id)) return { blocked: "You already applied" };
  if (state.applications.length >= MAX_PENDING) return { blocked: "Wait to hear back from your other applications" };
  if (EDUCATION_RANK[c.education] < EDUCATION_RANK[o.minEducation]) return { blocked: "You don't have the qualification for this one" };
  if (state.money < CV_PRINTING) return { blocked: "You need ₦500 to print your CV" };
  const s = clone(state);
  s.money -= CV_PRINTING;
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
    if (rng() < hireChance(s, app)) {
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
