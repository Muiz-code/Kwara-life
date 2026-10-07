/** Random source in [0, 1). Pass one in so the sim stays testable. */
export type Rng = () => number;

/** Park-Miller generator, same as the prototype uses for map scenery. */
export function seeded(seed: number): Rng {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Returns the values in order, then repeats the last one. Handy in tests. */
export function sequence(...values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
