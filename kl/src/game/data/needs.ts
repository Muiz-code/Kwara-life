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

/** While asleep energy does not decay and everything else decays at this fraction. */
export const SLEEP_DECAY_FACTOR = 0.4;

export const LOW_NEED = 25;
