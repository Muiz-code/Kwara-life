import { describe, expect, it } from "vitest";
import { lgaPlaces } from "../data/lga";
import { STATES } from "../data/states";
import { townFor as loadMap } from "./load";

const kano = STATES.find((s) => s.code === "kano")!;
const citizen = { cls: "poor" as const, job: "Tailor", home: "a rented room" };

describe("picking a map for a citizen", () => {
  it("gives the three Ilorin LGAs Ilorin, as a grid town", () => {
    const kwara = STATES.find((s) => s.code === "kwara")!;
    const map = loadMap({ lgaCode: "kwara/ilorin-west", state: kwara, lgaName: "Ilorin West", ...citizen });
    expect(map.id).toBe("kwara/ilorin");
    expect(map.places.length).toBe(27);
    expect(map.grid).toBeDefined();
  });

  it("builds every other LGA its own town with exactly the LGA's places", () => {
    const map = loadMap({ lgaCode: "kano/fagge", state: kano, lgaName: "Fagge", ...citizen });
    const want = lgaPlaces({ state: kano, lgaName: "Fagge", ...citizen, underFlyover: false }).map((p) => p.id).sort();
    expect(map.places.map((p) => p.id).sort()).toEqual(want);
  });

  it("leaves out home, work and shelter for a visitor", () => {
    const map = loadMap({ lgaCode: "kano/fagge", state: kano, lgaName: "Fagge", ...citizen, visiting: true });
    const ids = map.places.map((p) => p.id);
    expect(ids).not.toContain("home");
    expect(ids).not.toContain("work");
    expect(ids).toContain("hotel");
  });
});
