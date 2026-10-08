/**
 * A frozen id-to-item table with no prototype. A plain object answers "constructor" or "__proto__"
 * with something truthy, which would let a doctored request vote for party "constructor".
 */
export function lookup<T>(items: readonly T[], key: (item: T) => string): Readonly<Record<string, T>> {
  const table: Record<string, T> = Object.create(null);
  for (const item of items) table[key(item)] = item;
  return Object.freeze(table);
}
