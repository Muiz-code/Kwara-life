// Checks src/data against reference/naija-votes-2027.html by running the prototype's own data code.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATES } from "./states";
import { PARTIES } from "./parties";
import { JOBS, PAY, START_MONEY, HOMES } from "./jobs";
import { BIOMES, ZONE_BIOME, LOCAL_FOOD } from "./biomes";
import { ISSUES, PROMO, DAILY_PROMO_CAP } from "./campaign";
import { LGAS, POLLING_UNITS } from "./geography";
import { NAIJA_MODES, MODES_BY_CLASS } from "./transport";
import { LANGS, t } from "./i18n";

const html = readFileSync(path.resolve(__dirname, "../../reference/naija-votes-2027.html"), "utf8");
const a = html.indexOf("const PARTIES=");
const b = html.indexOf("(function(){", a);
const iife = html.slice(b);
const grab = (from: string, to: string) => iife.slice(iife.indexOf(from), iife.indexOf(to, iife.indexOf(from)));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P: any = new Function(
  `${html.slice(a, b)}${grab("const BIOME=", "/* ---------- world")}${grab("const PAYD=", "const ACT=")}${grab("const MSPEC=", "const modeList=")}
   return {PARTIES,PCOL,STATES,JOBS,START,HOMES,ISSUES,PROMO,DAILY_CAP,BIOME,BIO,FOOD,LMK,PAYD,MSPEC,MODES,T};`,
)();

/** The game renamed the prototype's names: INEC is VINEC in the game, and the game is Naija Votes. */
const renamed = (v: string) => v.replace(/INEC/g, "VINEC").replace(/Naija Votes 2027/g, "Naija Votes");

describe("Naija data matches the prototype", () => {
  it("has 36 states plus FCT, 5 LGAs each, 3 polling units per LGA", () => {
    expect(STATES).toHaveLength(37);
    expect(LGAS).toHaveLength(185);
    expect(POLLING_UNITS).toHaveLength(555);
    expect(new Set(LGAS.map((l) => l.code)).size).toBe(185);
    expect(STATES.map((s) => [s.name, s.zone, s.slogan, s.lang, s.lgas, s.grid])).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      P.STATES.map((r: any[]) => [r[0], r[1], r[2], r[3], r[4], [r[5], r[6]]]),
    );
    for (const s of STATES) expect([s.landmark.name, s.landmark.kind]).toEqual(P.LMK[s.name]);
  });

  it("lists the 21 parties alphabetically", () => {
    expect(PARTIES.map((p) => [p.code, p.name])).toEqual(P.PARTIES);
    expect(PARTIES.map((p) => p.colour)).toEqual(P.PCOL);
    const codes = PARTIES.map((p) => p.code);
    expect(codes).toEqual([...codes].sort());
  });

  it("has the same jobs, pay, money, homes, biomes and campaign prices", () => {
    expect(JOBS).toEqual(P.JOBS);
    expect(START_MONEY).toEqual(P.START);
    expect(HOMES).toEqual(P.HOMES);
    for (const k of ["poor", "middle", "rich"] as const) expect([PAY[k].min, PAY[k].max, PAY[k].shiftMinutes]).toEqual(P.PAYD[k]);
    expect(ZONE_BIOME).toEqual(P.BIOME);
    // The five zone looks are the prototype's; the regional looks on top are new.
    expect(Object.fromEntries(Object.keys(P.BIO).map((k) => [k, BIOMES[k as keyof typeof BIOMES]]))).toEqual(P.BIO);
    for (const [z, f] of Object.entries(LOCAL_FOOD)) expect([f.place, f.dish, f.price]).toEqual(P.FOOD[z]);
    expect([...ISSUES]).toEqual(P.ISSUES);
    expect(PROMO.flyer.map((o) => [o.label, o.price])).toEqual(P.PROMO.flyer);
    expect(PROMO.news.map((o) => [o.label, o.price])).toEqual(P.PROMO.news);
    expect(DAILY_PROMO_CAP).toBe(P.DAILY_CAP);
  });

  it("has the same transport by class, times and fares", () => {
    for (const [cls, modes] of Object.entries(MODES_BY_CLASS)) {
      expect(modes).toEqual(["walk", ...P.MODES[cls].map((m: string[]) => m[0]).filter((k: string) => k !== "walk")]);
    }
    for (const [id, m] of Object.entries(NAIJA_MODES)) {
      for (const d of [0, 150, 333, 900, 2400]) {
        expect(m.minutes(d)).toBe(P.MSPEC[id].min(d));
        expect(m.fare(d)).toBe(P.MSPEC[id].fare(d));
      }
    }
  });

  it("has every UI string in every language", () => {
    for (const { code } of LANGS) for (const key of Object.keys(P.T.en)) expect(t(code, key as never)).toBe(renamed(P.T[code][key]));
  });
});
