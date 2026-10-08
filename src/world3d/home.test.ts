import { describe, expect, it } from "vitest";
import { defaultStyle, homeClass, isHomeStyle, styleColours, WALLS } from "../data/homestyle";
import { freshState, sanitizeGame } from "../sim";
import { FloorPlan } from "./floorplan";
import { furnish } from "./interior";
import { Kit } from "./kit";

const CLASSES = ["poor", "middle", "rich"] as const;

describe("the home", () => {
  for (const cls of CLASSES)
    for (const furniture of [[], ["bed", "sofa", "cooker", "fridge", "cabinet", "wardrobe", "rug", "table"]])
      it(`a ${cls} home with ${furniture.length ? "everything bought" : "nothing bought"} has every thing in reach`, () => {
        const kit = new Kit();
        const { spots } = furnish(kit, "home", { furniture, tv: true, radio: true, cls, style: null });
        expect(spots.map((s) => s.actions[0]).sort()).toEqual(["bath", "cook", "radio", "sleep", "tv"]);
        const plan = new FloorPlan(12, 10, 0.2);
        plan.markGeometry(kit.merge()!);
        plan.grow(1);
        const start = plan.nearestFree(0.5, 3.6)!;
        for (const s of spots) {
          const to = plan.nearestFree(s.stand[0], s.stand[1])!;
          // Where you stand to use a thing is open floor (or right beside it), and you can walk there.
          expect(Math.hypot(to.x - s.stand[0], to.z - s.stand[1]), s.label).toBeLessThan(0.6);
          const path = plan.path(start, to);
          expect(path.length, s.label).toBeGreaterThan(0);
          expect(path[path.length - 1]).toEqual(to);
        }
      });
});

describe("styling the home", () => {
  it("starts in its class's look", () => {
    for (const cls of CLASSES) expect(isHomeStyle(defaultStyle(cls))).toBe(true);
    expect(styleColours(defaultStyle("rich")).wall).toBe(WALLS.find((w) => w.id === "cream")!.colour);
  });

  it("furnishes a bought house by how grand it is", () => {
    const as = (cls: "poor" | "middle" | "rich", house: string | null) => homeClass({ citizen: { cls }, house });
    expect(as("poor", null)).toBe("poor");
    expect(as("poor", "bungalow")).toBe("middle");
    expect(as("middle", "duplex")).toBe("rich");
    expect(as("rich", "bungalow")).toBe("rich");
    expect(as("middle", "no-such-house")).toBe("middle");
  });

  it("only takes the colours on offer", () => {
    expect(isHomeStyle({ wall: "mint", floor: "wood", sofa: "emerald", accent: "teal" })).toBe(true);
    expect(isHomeStyle({ wall: "#FF0000", floor: "wood", sofa: "emerald", accent: "teal" })).toBe(false);
    expect(isHomeStyle({ wall: "mint", floor: "wood", sofa: "emerald" })).toBe(false);
    expect(isHomeStyle(null)).toBe(false);
  });

  it("saves a style and refuses a save with a made-up one", () => {
    const style = { wall: "lilac", floor: "terracotta", sofa: "mustard", accent: "green" };
    expect(sanitizeGame({ ...freshState(), homeStyle: style })?.homeStyle).toEqual(style);
    expect(sanitizeGame({ ...freshState(), homeStyle: null })?.homeStyle).toBeNull();
    expect(sanitizeGame({ ...freshState(), homeStyle: { ...style, wall: "gold-leaf" } })).toBeNull();
  });
});
