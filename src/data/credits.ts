// The closing credits at the end of the season (docs/DECISIONS.md, "Closing remarks and credits").
// The people who built the game are listed here. The top brands and top players are not: they come from the
// season snapshot the server publishes when polls close (src/net/credits.ts), so nobody can edit them in.

export interface Builder {
  /** The name they go by in the credits. Never a real name. */
  name: string;
  role?: string;
}

/** Who built Naija Votes, by their nicknames (the owner asked that real names never appear). */
export const BUILDERS: Builder[] = [{ name: "Hizzy", role: "Creator" }, { name: "TR7" }, { name: "Tommy" }];

/** Partners thanked by name. */
export const PARTNERS = ["Raavon", "Klario", "Sync"];

export const TOP_BRANDS = 20;
export const TOP_PLAYERS = 10;

/** The real election this game is a rehearsal for, and how long its choice lasts. */
export const NEXT_REAL_ELECTION = 2027;
export const TERM_YEARS = 4;

/** The owner's closing message, in their words. */
export const CLOSING_MESSAGE = [
  "This game is a simulation. It is not real. Nothing that happens in the real election comes from this game, and Naija Votes has no affiliation with INEC or with any political party. It is only an example of how we think.",
  "Take part in the real election. Your vote has always counted, and it always will.",
  "Let us make Nigeria great again. Let us love and pray for all our leaders.",
  "Thank you.",
];

export const SIGNED = "Hizzy";
