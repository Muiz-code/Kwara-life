// Furniture for your home. Everyone moves in with a mattress on the floor, a bucket, a cooler and some
// cartons; everything else is bought at the market and appears in the room. Prices are in naira.
import type { Action } from "./action";

export const FURNITURE = [
  { id: "bed", label: "bed frame", price: 85000 },
  { id: "wardrobe", label: "wardrobe", price: 65000 },
  { id: "table", label: "table and two chairs", price: 70000 },
  { id: "sofa", label: "sofa", price: 120000 },
  { id: "rug", label: "rug", price: 15000 },
  { id: "fan", label: "standing fan", price: 28000 },
  { id: "cabinet", label: "kitchen cabinet", price: 90000 },
  { id: "cooker", label: "gas cooker", price: 75000 },
  { id: "fridge", label: "fridge", price: 180000 },
  { id: "curtains", label: "pair of curtains", price: 12000 },
] as const;

export type FurnitureId = (typeof FURNITURE)[number]["id"];

export const FURNITURE_IDS = new Set<string>(FURNITURE.map((f) => f.id));

/** The market's furniture section: one action per item. */
export const FURNITURE_ACTIONS: Action[] = FURNITURE.map((f) => ({
  id: `buy-${f.id}`,
  label: `Buy a ${f.label}`,
  dur: 30,
  cost: f.price,
  furnish: f.id,
  fx: { fun: 6 },
  bubble: "Buying",
  done: `You bought a ${f.label}. The delivery boys carried it home.`,
}));
