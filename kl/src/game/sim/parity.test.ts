// Checks the port against reference/kwara-life.html by running the prototype's own
// data and layout code and comparing results.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES, WAYPOINTS } from "../data/locations";
import { ROADS } from "../data/roads";
import { ACTIONS } from "../data/actions";
import { FRIENDS } from "../data/friends";
import { DECAY } from "../data/needs";
import { WORLD_H, WORLD_W, placePos, route } from "./world";
import { MODES, MODE_IDS } from "./travel";

const html = readFileSync(path.resolve(__dirname, "../../../reference/kwara-life.html"), "utf8");

function slice(from: string, to: string): string {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`Prototype code not found: ${from}`);
  return html.slice(a, b);
}

// World data, projection and layout, then actions, needs and friends.
const world = slice("const L0=", "/* ================= ACTIONS");
const acts = slice("const HOME=", "const SHORT=");
const decay = slice("const DECAY=", "const FRIENDS=");
const friends = slice("const FRIENDS=", "const DAYS=");
const travel = slice("const MODES=", "function tripInfo");
const graph = slice("function shortest(", "const MODES=");
const np = slice("function np(", "function segDist");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P: any = new Function(
  `${world}${np}const ADJ={};EDGES.forEach(([a,b])=>{(ADJ[a]=ADJ[a]||[]).push(b);(ADJ[b]=ADJ[b]||[]).push(a)});
   ${graph}${acts}${decay}${friends}${travel}
   const protoRoute=(a,b)=>{const ids=shortest(a,b);const pts=[standPos(a),...ids.map(np),standPos(b)];return{ids,len:routeLen(pts)}};
   return {L0,WAYS,EDGES,LOC,WAY,WW,WH,ACT,DECAY,FRIENDS,MODES,protoRoute,HW};`,
)();

describe("parity with the prototype", () => {
  it("has the same places", () => {
    expect(PLACES.map((p) => [p.id, p.name, p.area, p.lat, p.lng, p.kind, p.blurb, p.open, p.gen, p.variant])).toEqual(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      P.L0.map((r: any[]) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]]),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(WAYPOINTS.map((w) => [w.id, w.lat, w.lng])).toEqual(P.WAYS.map((r: any[]) => [r[0], r[1], r[2]]));
  });

  it("has the same roads", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(ROADS.map((r) => [r.a, r.b, r.name, !!r.highway])).toEqual(P.EDGES.map((e: any[]) => [e[0], e[1], e[2], !!e[3]]));
  });

  it("lays the map out identically", () => {
    expect([WORLD_W, WORLD_H]).toEqual([P.WW, P.WH]);
    for (const p of PLACES) expect(placePos(p.id)).toEqual({ x: P.LOC[p.id].x, y: P.LOC[p.id].y });
    for (const w of WAYPOINTS) expect(placePos(w.id)).toEqual({ x: P.WAY[w.id].x, y: P.WAY[w.id].y });
  });

  it("has the same actions, needs and friends", () => {
    const strip = (o: object) => JSON.parse(JSON.stringify(o));
    expect(strip(ACTIONS)).toEqual(strip(P.ACT));
    expect(DECAY).toEqual(P.DECAY);
    for (const [id, f] of Object.entries(FRIENDS)) {
      expect({ name: f.name, role: f.role, lines: f.lines, unlock: f.unlock }).toEqual({ ...P.FRIENDS[id], unlock: P.FRIENDS[id].unlock });
    }
  });

  it("finds the same routes, times and fares", () => {
    const ids = PLACES.map((p) => p.id);
    for (const from of ids) {
      for (const to of ids) {
        if (from === to) continue;
        const mine = route(from, to);
        const proto = P.protoRoute(from, to);
        expect(mine.ids).toEqual(proto.ids);
        expect(mine.length).toBeCloseTo(proto.len, 6);
        const hw = proto.ids.some((id: string, i: number) => i > 0 && P.HW[proto.ids[i - 1] + "|" + id]);
        expect(mine.highway).toBe(hw);
      }
    }
    // Compare a sample of real trips with the prototype's mode formulas.
    for (const [from, to] of [["home", "unilorin"], ["po", "kwasu"], ["home", "airport"], ["palace", "sawmill"]]) {
      const r = route(from, to);
      for (const m of MODE_IDS) {
        expect(MODES[m].minutes(r.length)).toBe(P.MODES[m].min(r.length));
        expect(MODES[m].fare(r.length)).toBe(P.MODES[m].fare(r.length));
      }
    }
  });
});
