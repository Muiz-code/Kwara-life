// Places that serve you one at a time: you take a number, wait (a real 30 to 90 seconds you can skip), get
// called to the counter and go through the steps there, tapping or holding for each, before the action runs.
import type { Action } from "./action";

export interface ServiceStep {
  label: string;
  /** tap: one tap; hold: press and hold; auto: plays out on its own. */
  do: "tap" | "hold" | "auto";
  /** What the button says (tap and hold), or what is happening (auto). */
  prompt: string;
}

export interface Service {
  /** Real seconds in the queue, shortest and longest. */
  queue: [number, number];
  /** Letter on the ticket. */
  prefix: string;
  /** Who calls you, "the VINEC officer". */
  caller: string;
  steps: ServiceStep[];
}

const REGISTER: Service = {
  queue: [45, 90],
  prefix: "V",
  caller: "the VINEC officer",
  steps: [
    { label: "Fill the registration form", do: "tap", prompt: "Write your name, address and date of birth" },
    { label: "Thumbprints on the BVAS", do: "hold", prompt: "Hold your thumb on the scanner" },
    { label: "Photo", do: "tap", prompt: "Look at the camera. Don't blink" },
    { label: "Collect your voter's slip", do: "tap", prompt: "Take your slip" },
  ],
};

const COLLECT: Service = {
  queue: [45, 90],
  prefix: "V",
  caller: "the VINEC officer",
  steps: [
    { label: "Show your voter's slip", do: "tap", prompt: "Hand over your slip" },
    { label: "The officer finds your PVC", do: "auto", prompt: "Searching the boxes for your card…" },
    { label: "Thumbprint to confirm it's you", do: "hold", prompt: "Hold your thumb on the scanner" },
    { label: "Sign the collection register", do: "tap", prompt: "Sign beside your name" },
  ],
};

const BANK: Service = {
  queue: [30, 60],
  prefix: "K",
  caller: "the account officer",
  steps: [
    { label: "Fill the form", do: "tap", prompt: "Write your details on the form" },
    { label: "Show your ID", do: "tap", prompt: "Hand over your ID card" },
    { label: "The officer sets you up", do: "auto", prompt: "Typing, stamping, typing again…" },
  ],
};

const BUKA: Service = {
  queue: [30, 45],
  prefix: "",
  caller: "Mama",
  steps: [
    { label: "Tell Mama what you want", do: "tap", prompt: "Point at the pot you want" },
    { label: "Pay", do: "tap", prompt: "Pay Mama" },
    { label: "Mama dishes it out", do: "auto", prompt: "Extra meat? Mama is smiling…" },
  ],
};

const TAKEAWAY: Service = {
  queue: [30, 60],
  prefix: "#",
  caller: "the server",
  steps: [
    { label: "Place your order", do: "tap", prompt: "Order at the counter" },
    { label: "Pay at the till", do: "tap", prompt: "Pay by transfer" },
    { label: "Collect your pack", do: "tap", prompt: "Take your nylon bag" },
  ],
};

const CAFE: Service = {
  queue: [30, 40],
  prefix: "#",
  caller: "the server",
  steps: [
    { label: "Choose", do: "tap", prompt: "Pick what you want" },
    { label: "Pay", do: "tap", prompt: "Pay at the counter" },
  ],
};

const CHECKOUT: Service = {
  queue: [30, 50],
  prefix: "C",
  caller: "the cashier",
  steps: [
    { label: "Put your items on the counter", do: "tap", prompt: "Unload your basket" },
    { label: "Pay", do: "tap", prompt: "Pay by card" },
    { label: "Bag your things", do: "auto", prompt: "The cashier is packing your bags…" },
  ],
};

/** The service an action goes through at a room, or null if you just do it. room: see world3d/interior roomFor. */
export function serviceFor(a: Action, room: string): Service | null {
  if (a.pvcAct === "register") return REGISTER;
  if (a.pvcAct === "collect") return COLLECT;
  if (room === "bank" && a.id === "officer") return BANK;
  if (!a.cost) return null;
  if (room === "takeaway" && a.takeaway) return TAKEAWAY;
  if (room === "cafe" && (a.fx.food ?? 0) > 0) return CAFE;
  if (room === "buka" && (a.fx.food ?? 0) > 0) return BUKA;
  if (room === "supermarket" && (a.groc || (a.fx.food ?? 0) > 0)) return CHECKOUT;
  return null;
}
