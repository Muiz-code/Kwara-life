// Places that serve you one at a time: you take a number, wait (a real 30 to 90 seconds you can skip), get
// called to the counter and go through the steps there, tapping or holding for each, before the action runs.
// Anything you pay for goes through steps too: order, look at the receipt, pay (transfer, POS or cash: all from
// your in-game money, the choice is only how it plays), collect. Money only moves when the action runs at the end,
// so walking out before paying costs nothing.
import type { Action } from "./action";
import type { Room } from "./rooms";
import { COUNTER_ROLES } from "./counters";

export interface ServiceStep {
  label: string;
  /**
   * tap: one tap; hold: press and hold; auto: plays out on its own; receipt: shows the receipt, tap to accept;
   * pay: pick transfer, POS or cash, then it plays out.
   */
  do: "tap" | "hold" | "auto" | "receipt" | "pay";
  /** What the button says (tap and hold), or what is happening (auto). */
  prompt: string;
}

export interface Service {
  /** Real seconds in the queue, shortest and longest; null to go straight to the counter (roadside, market). */
  queue: [number, number] | null;
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

const RECEIPT: ServiceStep = { label: "Check your receipt", do: "receipt", prompt: "Looks correct" };
const PAY: ServiceStep = { label: "Pay", do: "pay", prompt: "How will you pay?" };

const BUKA: Service = {
  queue: [30, 45],
  prefix: "",
  caller: "Mama",
  steps: [
    { label: "Tell Mama what you want", do: "tap", prompt: "Point at the pot you want" },
    PAY,
    { label: "Mama dishes it out", do: "auto", prompt: "Extra meat? Mama is smiling…" },
  ],
};

const TAKEAWAY: Service = {
  queue: [30, 60],
  prefix: "#",
  caller: "the server",
  steps: [
    { label: "Place your order", do: "tap", prompt: "Order at the counter" },
    RECEIPT,
    { ...PAY, label: "Pay at the till" },
    { label: "Collect your pack", do: "tap", prompt: "Take your nylon bag" },
  ],
};

const CAFE: Service = {
  queue: [30, 40],
  prefix: "#",
  caller: "the server",
  steps: [{ label: "Choose", do: "tap", prompt: "Pick what you want" }, RECEIPT, PAY],
};

const CHECKOUT: Service = {
  queue: [30, 50],
  prefix: "C",
  caller: "the cashier",
  steps: [
    { label: "Put your items on the counter", do: "tap", prompt: "Unload your basket" },
    RECEIPT,
    PAY,
    { label: "Bag your things", do: "auto", prompt: "The cashier is packing your bags…" },
  ],
};

/** Rooms with a proper counter and a queue; anywhere else (markets, roadside, kiosks) you just walk up. */
const QUEUED: Partial<Record<Room, [number, number]>> = {
  showroom: [30, 60],
  boutique: [20, 40],
  techhub: [20, 40],
  hotel: [20, 40],
  airport: [30, 60],
  station: [20, 40],
  stadium: [20, 40],
  bank: [30, 60],
};

/** What you collect after paying, by what you bought. */
function collectStep(a: Action): ServiceStep | null {
  if (a.car) return { label: "Collect your keys", do: "tap", prompt: "Take the keys and the papers" };
  if (a.house) return { label: "Collect the keys", do: "tap", prompt: "Take the keys and sign the papers" };
  if (a.phone || a.goal === "phone") return { label: "Collect your phone", do: "tap", prompt: "Take the box. Check the seal" };
  if (a.outfit) return { label: "Collect your outfit", do: "tap", prompt: "Take your bag" };
  if (a.furnish) return { label: "Book the delivery", do: "auto", prompt: "They're writing down your address…" };
  if (a.buy) return { label: "Collect it", do: "tap", prompt: "Take the carton" };
  if (a.website) return { label: "Raavon gets to work", do: "auto", prompt: "Taking down what you want…" };
  if (a.groc) return { label: "Collect your foodstuff", do: "tap", prompt: "Take your nylon bags" };
  if (a.days || a.day !== undefined) return { label: "Collect your ticket", do: "tap", prompt: "Take your ticket" };
  return null;
}

/** Things you take away with you (as opposed to food you eat there, or a ticket, or a haircut). */
const isGoods = (a: Action) => !!(a.car || a.house || a.phone || a.goal === "phone" || a.outfit || a.furnish || a.buy || a.website || a.groc);

/** Small roadside buys (suya, corn, zobo): no receipt, two quick taps. */
export const ROADSIDE_MAX = 1000;

/** The steps for anything else you pay for, built from what it is. Null when there is nothing to pay. */
function purchase(a: Action, room: Room): Service | null {
  // Rent, car hire and journeys have their own screens; at home there is nobody to pay.
  if (!a.cost || a.rent || a.carHire || a.journey || a.shift || room === "home") return null;
  const caller = COUNTER_ROLES[room]?.who ?? "the seller";
  const queue = QUEUED[room] ?? (a.cost >= 20_000 ? ([20, 40] as [number, number]) : null);
  const collect = collectStep(a);
  if (isGoods(a)) {
    const order: ServiceStep = { label: "Place your order", do: "tap", prompt: "Tell them what you want" };
    return { queue, prefix: "#", caller, steps: [order, RECEIPT, PAY, ...(collect ? [collect] : [])] };
  }
  if (a.cost <= ROADSIDE_MAX) {
    const ask: ServiceStep = { label: "Tell them what you want", do: "tap", prompt: "Point at what you want" };
    return { queue: null, prefix: "", caller, steps: [ask, PAY] };
  }
  if ((a.fx.food ?? 0) > 0) {
    const order: ServiceStep = { label: "Order", do: "tap", prompt: "Call the waiter and order" };
    return { queue, prefix: "#", caller, steps: [order, RECEIPT, PAY] };
  }
  // A ticket, a session, a service: pay, then it happens.
  return { queue, prefix: "#", caller, steps: [RECEIPT, PAY, ...(collect ? [collect] : [])] };
}

/** The line on the receipt for an action: "Buy a new phone" reads "New phone". */
export function receiptItem(label: string): string {
  const s = label.replace(/^(buy|get|order)\s+(a |an |some |the )?/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The service an action goes through at a room, or null if you just do it. room: see world3d/interior roomFor. */
export function serviceFor(a: Action, room: Room): Service | null {
  if (a.pvcAct === "register") return REGISTER;
  if (a.pvcAct === "collect") return COLLECT;
  if (room === "bank" && a.id === "officer") return BANK;
  if (!a.cost) return null;
  if (room === "takeaway" && a.takeaway) return TAKEAWAY;
  if (room === "cafe" && (a.fx.food ?? 0) > 0) return CAFE;
  if (room === "buka" && (a.fx.food ?? 0) > 0) return BUKA;
  if (room === "supermarket" && (a.groc || (a.fx.food ?? 0) > 0)) return CHECKOUT;
  return purchase(a, room);
}
