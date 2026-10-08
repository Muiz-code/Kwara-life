// Checks the generated LGA map against reference/naija-votes-2027.html by running
// the prototype's own world builder and comparing places, roads and the river.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STATES } from "../data/states";
import { generateMap, hash, lcg, roadNode, type GenOptions } from "./generate";

const html = readFileSync(path.resolve(__dirname, "../../reference/naija-votes-2027.html"), "utf8");

function slice(from: string, to: string): string {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`Prototype code not found: ${from}`);
  return html.slice(a, b);
}

const states = slice("const STATES=[", "const ZONES=");
const region = slice("/* ---------- region look ---------- */", "/* ---------- world");
const world = slice("const C=S.c||{", "/* ---------- actions");
const helpers = slice("function hash(s)", "let S;try");

interface ProtoWorld {
  LOC: Record<string, { id: string; name: string; kind: string; open: [number, number]; gen: boolean; blurb: string; x: number; y: number }>;
  EDGES: [string, string, string][];
  RIVER: { x: number; y: number }[] | null;
  WW: number;
  WH: number;
  ids: string[];
}

/** Runs the prototype's builder for one citizen. */
function protoWorld(c: { si: number; li: number; pi: number; cls: string; job: string; home?: string; under?: boolean }): ProtoWorld {
  return new Function(
    "C0",
    `${states}${helpers}${region}
     const S={c:Object.assign({home:""},C0)};
     ${world}
     return {LOC,EDGES,RIVER,WW,WH,ids:L0.map(r=>r[0])};`,
  )(c) as ProtoWorld;
}

const CASES: { si: number; li: number; pi: number; cls: "poor" | "middle" | "rich"; job: string; home: string; under?: boolean }[] = [
  { si: 0, li: 0, pi: 0, cls: "poor", job: "Carpenter", home: "a face-me-I-face-you room" },
  { si: 16, li: 2, pi: 1, cls: "middle", job: "Teacher", home: "a two-bedroom flat" },
  { si: 24, li: 4, pi: 2, cls: "rich", job: "Contractor", home: "a duplex" },
  { si: 32, li: 1, pi: 0, cls: "poor", job: "Hawker", home: "", under: true },
  { si: 3, li: 3, pi: 2, cls: "middle", job: "Banker", home: "a flat" },
];

/** The game renamed the prototype's names: INEC is VINEC in the game, and the game is Naija Votes. */
const renamed = (v: string) => v.replace(/INEC/g, "VINEC").replace(/Naija Votes 2027/g, "Naija Votes");

describe("the LGA generator", () => {
  it("matches the prototype's world builder", () => {
    for (const c of CASES) {
      const state = STATES[c.si];
      const o: GenOptions = {
        state,
        lga: state.lgas[c.li],
        pu: c.pi,
        cls: c.cls,
        job: c.job,
        home: c.home,
        ...(c.under ? { under: true } : {}),
      };
      const mine = generateMap(o);
      const proto = protoWorld(c);

      expect(mine.places.map((p) => p.id)).toEqual(proto.ids);
      expect([mine.width, mine.height]).toEqual([proto.WW, proto.WH]);
      for (const p of mine.places) {
        const q = proto.LOC[p.id];
        expect([p.name, p.kind, p.open, p.gen, p.blurb, p.x, p.y]).toEqual([renamed(q.name), q.kind, q.open, q.gen, renamed(q.blurb), q.x, q.y]);
      }
      expect(mine.roads.map((r) => r.name)).toEqual(proto.EDGES.map((e) => e[2]));
      expect(mine.roads.map((r) => r.pts)).toEqual(
        proto.EDGES.map((e) => [roadNode(proto.LOC[e[0]]), roadNode(proto.LOC[e[1]])]),
      );
      expect(mine.river ?? null).toEqual(proto.RIVER);
    }
  });

  it("uses the prototype's hash and random generator", () => {
    expect(hash("Kwara")).toBe(
      new Function("return (function(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0})('Kwara')")(),
    );
    const r = lcg(hash("Lagos"));
    const proto = new Function(
      "return (function(seed){seed=seed||1;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}})(" +
        hash("Lagos") +
        ")",
    )() as () => number;
    for (let i = 0; i < 5; i++) expect(r()).toBe(proto());
  });

  it("gives a river to water and bridge states only", () => {
    const delta = STATES.find((s) => s.code === "delta")!;
    const kano = STATES.find((s) => s.code === "kano")!;
    const base = { pu: 0, cls: "poor" as const, job: "Tailor", home: "a room" };
    expect(generateMap({ ...base, state: delta, lga: delta.lgas[0] }).river).toBeDefined();
    expect(generateMap({ ...base, state: kano, lga: kano.lgas[0] }).river).toBeUndefined();
  });
});
