// Phones, by what people can afford. Everyone starts with the phone their class can buy; a better one
// costs money at the phone stalls (the market, or Taiwo Oke in Ilorin). Brand names are the game's own.
import type { Action } from "./action";
import type { ClassId } from "./jobs";

export type PhoneKind = "keypad" | "android" | "island";

export interface PhoneModel {
  id: string;
  name: string;
  kind: PhoneKind;
  price: number;
  /** Case colour. */
  colour: string;
  blurb: string;
}

export const PHONES: PhoneModel[] = [
  { id: "kpakpa", name: "Kpakpa K2", kind: "keypad", price: 18000, colour: "#2B2F36", blurb: "Torchlight, FM radio, battery that lasts a week. Calls, texts and USSD banking." },
  { id: "tekna", name: "Tekna Spark 12", kind: "android", price: 145000, colour: "#2E6F95", blurb: "Big screen, apps, a decent camera. The phone most people in town carry." },
  { id: "orisun", name: "Orisun X5", kind: "android", price: 420000, colour: "#3F6B3A", blurb: "Fast, sharp screen, cameras that shine at owambe." },
  { id: "ife", name: "Ìfẹ́ 15 Pro", kind: "island", price: 1_850_000, colour: "#C9A227", blurb: "The flagship: the island at the top, the best camera, the phone that announces you." },
];

export const PHONE: Record<string, PhoneModel> = Object.fromEntries(PHONES.map((p) => [p.id, p]));

/** The phone each class starts with. */
export const START_PHONE: Record<ClassId, string> = { poor: "kpakpa", middle: "tekna", rich: "ife" };

/** The phone a citizen has: the one they bought, or their class's starting phone. */
export const phoneOf = (owned: string | null | undefined, cls: ClassId | undefined): PhoneModel => PHONE[owned ?? ""] ?? PHONE[START_PHONE[cls ?? "poor"]];

/** The phone stall: one action per model. */
export const PHONE_ACTIONS: Action[] = PHONES.map((p) => ({
  id: `phone-${p.id}`,
  label: `Buy a ${p.name}`,
  dur: 30,
  cost: p.price,
  phone: p.id,
  fx: { fun: 10 },
  bubble: "Buying",
  done: `You bought a ${p.name}. The seller transferred your contacts and a screen guard is on.`,
}));
