export type NeedKey = "food" | "energy" | "fun" | "social" | "hygiene";

export const NEEDS: { key: NeedKey; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "energy", label: "Energy" },
  { key: "fun", label: "Fun" },
  { key: "social", label: "Social" },
  { key: "hygiene", label: "Hygiene" },
];

export const NEED_KEYS = NEEDS.map((n) => n.key);

/** Points lost per game minute. */
export const DECAY: Record<NeedKey, number> = {
  food: 0.1,
  energy: 0.07,
  fun: 0.05,
  social: 0.04,
  hygiene: 0.05,
};

/**
 * How fast needs drain compared with the prototype's DECAY. At 0.5 a full belly lasts twice as long
 * (about 16 real minutes instead of 8), so a life is less of a rush from one meal to the next.
 */
export const NEED_PACE = 0.5;

/** While asleep energy does not decay and everything else decays at this fraction. */
export const SLEEP_DECAY_FACTOR = 0.4;

export const LOW_NEED = 25;
