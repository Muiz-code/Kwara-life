// Job interviews. A strong application gets a phone call inviting you to interview; you answer a few
// questions and your answers decide the offer. Questions are picked per opening, so everyone applying to
// the same job faces the same panel.
import type { CareerId } from "../data/careers";
import { hireChance, openingById } from "./jobs";
import type { Rng } from "./rng";
import { seeded } from "./rng";
import { clone, log, naira, note, type GameState, type JobApplication } from "./state";
import { dayNum } from "./time";

export interface Interview {
  /** The opening's id. */
  id: string;
  title: string;
  company: string;
  monthly: number;
  career: CareerId;
  /** Last game day to take the call and sit the interview. */
  until: number;
  /** The call was answered: the interview is ready to sit. */
  accepted: boolean;
}

export interface Question {
  q: string;
  /** Answers with how well each goes down with the panel: 0 badly, 1 fine, 2 well. */
  a: [string, number][];
}

const GENERAL: Question[] = [
  { q: "Tell us about yourself.", a: [["I'm hardworking and I learn fast. In my last role I cut our waiting time by half.", 2], ["My name is in my CV. I was born in a family of six…", 0], ["I am the best candidate you will see today.", 1]] },
  { q: "Why do you want to work with us?", a: [["Honestly, I need a job.", 0], ["I've followed your growth and I want to help you serve more customers.", 2], ["My uncle works here.", 0]] },
  { q: "Where do you see yourself in five years?", a: [["Leading a team here, having grown with the company.", 2], ["In your seat.", 1], ["Abroad, sha.", 0]] },
  { q: "Tell us about a time you solved a problem at work or school.", a: [["Our group project stalled, so I split the work and we submitted early.", 2], ["I don't really have problems.", 0], ["I reported it to my supervisor.", 1]] },
  { q: "What is your salary expectation?", a: [["Whatever you can pay.", 1], ["Within the advertised range, open to discussion.", 2], ["Double the advert, because of inflation.", 0]] },
  { q: "How do you handle pressure?", a: [["I plan, prioritise and ask for help early.", 2], ["I don't feel pressure.", 0], ["I pray and push through.", 1]] },
];

const BY_CAREER: Partial<Record<CareerId, Question[]>> = {
  developer: [
    { q: "A customer reports the app crashed. What do you do first?", a: [["Reproduce it and check the logs.", 2], ["Tell them to reinstall.", 0], ["Rewrite the whole app.", 0]] },
    { q: "How do you keep your skills current?", a: [["I build side projects and read the docs.", 2], ["I watch tutorials sometimes.", 1], ["My degree covered everything.", 0]] },
  ],
  worker: [
    { q: "A customer is shouting at your counter. What do you do?", a: [["Stay calm, listen and solve the problem.", 2], ["Shout back.", 0], ["Call my manager straight away.", 1]] },
    { q: "Are you comfortable with early mornings and targets?", a: [["Yes, and I track my targets daily.", 2], ["It depends.", 1], ["I prefer to resume by 11.", 0]] },
  ],
  politician: [
    { q: "How would you mobilise a ward peacefully?", a: [["Town halls, door to door, listening to people.", 2], ["Share money.", 0], ["Post on social media.", 1]] },
  ],
};

/** The panel's questions for an opening: three, the same for everyone who interviews for it. */
export function questionsFor(id: string, career: CareerId): Question[] {
  const R = seeded([...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261));
  const pool = [...(BY_CAREER[career] ?? []), ...GENERAL];
  const out: Question[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  return out;
}

/** Who is hiring: graduate trainee programmes name their company, other openings a local employer. */
export const companyOf = (title: string) => /^(.+?) (Graduate|Trainee)/.exec(title)?.[1] ?? "The employer";

/** Mutates s: a shortlisted application turns into a phone call inviting you to interview. */
export function inviteToInterview(s: GameState, app: JobApplication, rng: Rng): boolean {
  if (s.interview) return false;
  const graduate = /Graduate/.test(app.title);
  // Graduate programmes interview everyone who qualifies; other jobs shortlist the stronger candidates.
  const shortlist = graduate ? 0.85 : Math.min(0.9, hireChance(s, app) * 1.8);
  if (rng() >= shortlist) return false;
  s.interview = { id: app.id, title: app.title, company: companyOf(app.title), monthly: app.monthly, career: app.career, until: dayNum(s.t) + 2, accepted: false };
  note(s, "Incoming call", `${companyOf(app.title)} is calling about the ${app.title.toLowerCase()} role. Answer your phone to book the interview.`);
  return true;
}

/** Answer (or decline) the recruiter's call. */
export function answerCall(state: GameState, accept: boolean): GameState {
  const s = clone(state);
  if (!s.interview) return s;
  if (!accept) {
    log(s, `You declined the call from ${s.interview.company}.`);
    s.interview = null;
    return s;
  }
  s.interview.accepted = true;
  log(s, `${s.interview.company} invited you to interview for ${s.interview.title.toLowerCase()}. Open the Jobs app when you are ready.`);
  return s;
}

/** Sit the interview: your answers (an index per question) decide the offer. */
export function sitInterview(state: GameState, answers: number[], rng: Rng): { state: GameState; hired: boolean; score: number } | { blocked: string } {
  const iv = state.interview;
  const c = state.citizen;
  if (!iv || !iv.accepted || !c) return { blocked: "No interview booked" };
  if (dayNum(state.t) > iv.until) return { blocked: "The interview date has passed" };
  const opening = openingById(iv.id);
  if (!opening) return { blocked: "That role has closed" };
  const qs = questionsFor(iv.id, iv.career);
  if (answers.length !== qs.length) return { blocked: "Answer every question" };
  const score = qs.reduce((sum, q, i) => sum + (q.a[answers[i]]?.[1] ?? 0), 0);
  const best = qs.length * 2;
  const s = clone(state);
  s.interview = null;
  // A good interview matters most; qualifications and a little long leg still count.
  const chance = Math.min(0.95, Math.max(0.03, 0.1 + 0.75 * (score / best) + (c.cls === "rich" ? 0.05 : 0)));
  const hired = rng() < chance;
  const sc = s.citizen!;
  if (hired) {
    sc.career = opening.career;
    sc.job = opening.title;
    sc.employed = true;
    sc.monthlyPay = opening.monthly;
    s.applications = [];
    note(s, "Offer letter", `${iv.company} is offering you the ${opening.title.toLowerCase()} role at ${naira(opening.monthly)} a month. Congratulations!`);
    log(s, `Hired as ${opening.title.toLowerCase()} after the interview.`);
  } else {
    note(s, "Feedback", score >= best / 2 ? `${iv.company} said it was close, but they went with another candidate. Keep applying.` : `${iv.company} said your answers did not convince the panel. Prepare better next time.`);
    log(s, `Not offered the ${opening.title.toLowerCase()} role.`);
  }
  return { state: s, hired, score };
}

/** Mutates s: an interview whose date has passed lapses. */
export function lapseInterview(s: GameState) {
  if (s.interview && dayNum(s.t) > s.interview.until) {
    log(s, `You missed the interview with ${s.interview.company}.`);
    s.interview = null;
  }
}
