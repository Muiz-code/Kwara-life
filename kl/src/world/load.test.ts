import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { STATES } from "../data/states";
import { loadMap, mapUrl } from "./load";
import { osmToWorldMap, type OverpassResponse } from "./osm";
import { router } from "./routing";

const kwara = STATES.find((s) => s.code === "kwara")!;
const kano = STATES.find((s) => s.code === "kano")!;
const citizen = { pu: 0, cls: "poor" as const, job: "Tailor", home: "a rented room" };

const fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, "__fixtures__/overpass-testville.json"), "utf8"),
) as OverpassResponse;

const notFound: typeof fetch = async () => new Response("", { status: 404 });

describe("picking a map for a citizen", () => {
  it("gives the three Ilorin LGAs the hand-built map", async () => {
    const map = await loadMap({ lgaCode: "kwara/ilorin-west", state: kwara, lgaName: "Ilorin West", ...citizen }, notFound);
    expect(map.id).toBe("kwara/ilorin");
    expect(map.places.length).toBe(27);
  });

  it("falls back to the generator for an LGA with no map fetched yet", async () => {
    const map = await loadMap({ lgaCode: "kano/kano-municipal", state: kano, lgaName: "Kano Municipal", ...citizen }, notFound);
    expect(map.source).toBe("generated");
    expect(map.places.map((p) => p.id)).toContain("home");
    expect(map.places.map((p) => p.id)).toContain("pu");
  });

  it("uses the fetched OpenStreetMap map and adds the player's own places", async () => {
    const osm = osmToWorldMap(fixture, { id: "kano/kano-municipal", name: "Kano Municipal", biome: "sahel" }).map;
    const served: typeof fetch = async (url) => {
      expect(String(url)).toBe(mapUrl("kano/kano-municipal"));
      return new Response(JSON.stringify(osm), { status: 200 });
    };
    const map = await loadMap({ lgaCode: "kano/kano-municipal", state: kano, lgaName: "Kano Municipal", ...citizen }, served);
    expect(map.source).toBe("osm");
    expect(map.attribution).toContain("OpenStreetMap");
    const ids = map.places.map((p) => p.id);
    for (const id of ["home", "work", "board", "inec", "pu", "market", "mosque", "church"]) expect(ids).toContain(id);
    // Home and work are the player's own, so they carry no OpenStreetMap id.
    expect(map.places.find((p) => p.id === "home")!.osm).toBeUndefined();
    // Everything stays reachable once the player's places are added.
    const r = router(map);
    for (const p of map.places) expect(r.route("home", p.id === "home" ? "pu" : p.id).length).toBeGreaterThan(0);
  });
});
