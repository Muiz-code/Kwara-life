// Side hustles from the phone's Hustle app: the gigs Nigerians run alongside (or instead of) a job.
// Each takes time and energy and pays on the spot. Some need a smartphone, some need schooling.
import type { Action } from "./action";
import type { Education } from "./careers";
import type { PhoneKind } from "./phones";

export interface Hustle extends Action {
  /** Phones that can do it (online gigs need a smartphone). */
  phones?: PhoneKind[];
  minEducation?: Education;
  /** One line on the gig card. */
  blurb: string;
}

export const HUSTLES: Hustle[] = [
  { id: "h-delivery", label: "Run food deliveries", blurb: "Pick up from bukas and restaurants, deliver across town on a bike.", dur: 180, earn: 6500, fx: { energy: -25, hygiene: -12 }, phones: ["android", "island"], bubble: "Delivering", done: "Twelve orders delivered. One customer did not pick up for 20 minutes." },
  { id: "h-data", label: "Sell data and airtime", blurb: "Neighbours and coursemates buy data from you at a small profit.", dur: 60, earn: 2500, fx: { social: 6 }, bubble: "Selling", done: "Sold data bundles to the whole compound." },
  { id: "h-pos", label: "Run a POS stand for the evening", blurb: "Withdrawals and transfers by the junction. Watch out for fake alerts.", dur: 180, earn: 4500, fx: { energy: -12, social: 8 }, bubble: "Withdrawals", done: "Busy evening at the POS. Charges added up nicely." },
  { id: "h-tutor", label: "Tutor a JSS student", blurb: "Maths and English lessons at the student's house.", dur: 120, earn: 6000, fx: { energy: -10, social: 6 }, minEducation: "secondary", bubble: "Teaching", done: "Your student finally understood fractions. Mummy paid and added bread." },
  { id: "h-braid", label: "Make hair", blurb: "Braids and cornrows for customers at home.", dur: 240, earn: 8000, fx: { energy: -15, social: 10 }, bubble: "Braiding", done: "Knotless braids done. The customer took twenty selfies." },
  { id: "h-puff", label: "Sell puff-puff by the roadside", blurb: "Fry in the morning, sell by the bus stop. Ingredients cost ₦1,500.", dur: 180, cost: 1500, earn: 5500, fx: { energy: -12, hygiene: -8 }, bubble: "Frying", done: "Sold out before noon. People were queueing." },
  { id: "h-design", label: "Design a logo for a client", blurb: "Freelance design job from Instagram. Needs a smartphone and some skill.", dur: 240, earn: 18000, fx: { energy: -15, fun: 5 }, phones: ["android", "island"], minEducation: "secondary", bubble: "Designing", done: "The client loved the third draft. Payment received." },
  { id: "h-skit", label: "Shoot a skit for social media", blurb: "Post a funny skit. Brands pay small for views.", dur: 120, earn: 3500, fx: { fun: 15, social: 8 }, phones: ["android", "island"], bubble: "Recording", done: "The skit went small viral. A brand sent something." },
];

export const HUSTLE: Record<string, Hustle> = Object.fromEntries(HUSTLES.map((h) => [h.id, h]));
