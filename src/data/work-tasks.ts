// Things that come up during a work shift, by career: tap each in time for a small bonus at the end.
// The fraud and laundering careers get none: the game never rewards crime with a bonus.
import type { CareerId } from "./careers";

export interface WorkTask {
  /** What just came up. */
  what: string;
  /** The button. */
  act: string;
}

/** Sync roles each have their own work. */
export const SYNC_TASKS: Record<string, WorkTask[]> = {
  "Sync agent": [
    { what: "A couple want to see a two-bedroom flat", act: "Show the flat" },
    { what: "Landlord on the phone about the rent", act: "Negotiate" },
    { what: "New listing just came in", act: "Take the photos" },
  ],
  "Sync customer support": [
    { what: "\"My driver never came!\"", act: "Calm them down" },
    { what: "A refund request", act: "Process it" },
    { what: "Chat waiting for a reply", act: "Reply" },
  ],
  "Sync driver": [
    { what: "Pick-up request two streets away", act: "Accept the trip" },
    { what: "Passenger asks for the AC", act: "Turn it on" },
    { what: "Fuel light is on", act: "Stop for fuel" },
  ],
  "Sync office cleaner": [
    { what: "Someone spilled zobo in the lobby", act: "Mop it" },
    { what: "Bins are full", act: "Empty them" },
    { what: "Toilet needs cleaning", act: "Clean it" },
  ],
  "Sync security guard": [
    { what: "A visitor at the gate", act: "Check their ID" },
    { what: "Car at the barrier", act: "Open up" },
    { what: "Time for the evening round", act: "Patrol" },
  ],
  "Sync engineer": [
    { what: "The ride app is crashing", act: "Fix it" },
    { what: "Pull request waiting", act: "Review" },
    { what: "Payments are slow", act: "Find the bug" },
  ],
  "Sync product designer": [
    { what: "The homes page is confusing", act: "Redesign it" },
    { what: "User interview starting", act: "Listen" },
    { what: "New icons needed", act: "Draw them" },
  ],
};

export const WORK_TASKS: Partial<Record<CareerId, WorkTask[]>> = {
  student: [
    { what: "The lecturer asks you a question", act: "Answer" },
    { what: "Your group needs your notes", act: "Share notes" },
    { what: "Attendance sheet is going round", act: "Sign it" },
  ],
  corper: [
    { what: "The pupils are waiting for you", act: "Teach the class" },
    { what: "The register needs marking", act: "Mark it" },
    { what: "Your CDS group is calling", act: "Join them" },
  ],
  worker: [
    { what: "A file just landed on your desk", act: "Stamp it" },
    { what: "Memo waiting for your signature", act: "Sign" },
    { what: "A visitor is at your desk", act: "Attend to them" },
    { what: "Oga wants the report", act: "Type it" },
  ],
  artisan: [
    { what: "A customer brings a job", act: "Take the job" },
    { what: "Time to measure up", act: "Measure" },
    { what: "The machine jammed", act: "Fix it" },
  ],
  trader: [
    { what: "Customer asking for tomatoes", act: "Serve" },
    { what: "\"Last price?\" A customer wants to price", act: "Haggle" },
    { what: "Customer needs change for ₦1,000", act: "Give change" },
    { what: "Fresh goods just arrived", act: "Arrange them" },
  ],
  creator: [
    { what: "The light is perfect right now", act: "Shoot" },
    { what: "Your last post is trending", act: "Reply to comments" },
    { what: "A brand just slid into your DM", act: "Answer" },
  ],
  developer: [
    { what: "Bug report from a user", act: "Fix it" },
    { what: "A pull request needs review", act: "Review" },
    { what: "Standup is starting", act: "Give your update" },
  ],
  herbalist: [
    { what: "A customer with malaria symptoms", act: "Mix agbo" },
    { what: "Roots waiting to be ground", act: "Grind them" },
    { what: "A buyer wants to know what's inside", act: "Explain" },
  ],
  politician: [
    { what: "A constituent with a complaint", act: "Listen" },
    { what: "Letter waiting for your signature", act: "Sign" },
    { what: "A question at the town hall", act: "Answer" },
  ],
  executive: [
    { what: "Board paper for approval", act: "Approve" },
    { what: "Call from the Lagos office", act: "Take the call" },
    { what: "Budget needs sign-off", act: "Sign off" },
  ],
  founder: [
    { what: "An investor replied to your email", act: "Reply" },
    { what: "A customer found a problem", act: "Ship a fix" },
    { what: "A candidate is here for interview", act: "Interview" },
  ],
};

/** The tasks for a job: Sync roles by title, everything else by career. */
export function tasksFor(career: CareerId, title: string): WorkTask[] | undefined {
  return career === "sync" ? (SYNC_TASKS[title] ?? SYNC_TASKS["Sync agent"]) : WORK_TASKS[career];
}

/** The first task comes this long into a shift, then one every TASK_EVERY, each open for TASK_WINDOW. */
export const TASK_FIRST = 3000;
export const TASK_EVERY = 7000;
export const TASK_WINDOW = 5000;

/** The task open at this point of a shift (ms in), or null between tasks. */
export function taskAt(elapsed: number): number | null {
  if (elapsed < TASK_FIRST) return null;
  const i = Math.floor((elapsed - TASK_FIRST) / TASK_EVERY);
  return elapsed - TASK_FIRST - i * TASK_EVERY < TASK_WINDOW ? i : null;
}

/** Bonus for each task handled: about 4% of a day's pay, in round fifties, between ₦100 and ₦5,000. */
export function taskPay(monthlyPay: number): number {
  const day = monthlyPay / 22;
  return Math.min(5000, Math.max(100, Math.round((day * 0.04) / 50) * 50));
}
