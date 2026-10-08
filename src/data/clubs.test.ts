import { describe, expect, it } from "vitest";
import { isOpen } from "../sim/time";
import { nightSpot } from "./clubs";
import { nightActions } from "./lga";

describe("night spots", () => {
  it("puts real clubs in the LGAs they are in, and a local club elsewhere", () => {
    expect(nightSpot("lagos", "Eti-Osa")).toMatchObject({ kind: "club", real: true, name: "Quilox" });
    expect(nightSpot("lagos", "Alimosho")).toMatchObject({ kind: "club", real: false, name: "Alimosho Lounge and Club" });
  });

  it("gives Sharia states a relaxation spot with no alcohol instead of a club", () => {
    expect(nightSpot("kano", "Fagge")).toMatchObject({ kind: "lounge", name: "Fagge Relaxation Spot" });
    const acts = nightActions("kano", "rich");
    expect(acts.map((a) => a.id)).not.toContain("bar");
    expect(acts.map((a) => a.id)).not.toContain("table");
  });

  it("keeps tables for people who can pay", () => {
    expect(nightActions("lagos", "poor").map((a) => a.id)).not.toContain("table");
    expect(nightActions("lagos", "rich").find((a) => a.id === "table")?.cost).toBe(150000);
  });

  it("opens a club from 9pm to 4am, across midnight", () => {
    const club = { open: [21, 4] as [number, number] };
    expect(isOpen(club, 23)).toBe(true);
    expect(isOpen(club, 2)).toBe(true);
    expect(isOpen(club, 12)).toBe(false);
    expect(isOpen({ open: [8, 17] }, 12)).toBe(true);
  });
});

describe("airports", () => {
  it("has a real name for every state with flights, and none for states without", async () => {
    const { AIRPORT_NAMES, CAPITALS } = await import("./capitals");
    for (const [code, c] of Object.entries(CAPITALS)) expect(!!AIRPORT_NAMES[code], code).toBe(c.airport);
    expect(AIRPORT_NAMES.lagos).toBe("Murtala Muhammed International Airport");
  });
});

describe("places of worship", () => {
  it("gives the north more mosques, the east more churches, and Lagos one of each", async () => {
    const { lgaPlaces } = await import("./lga");
    const { STATE } = await import("./states");
    const count = (state: string, kind: string) =>
      lgaPlaces({ state: STATE[state], lgaName: "Town", cls: "middle", job: "Teacher", home: "a flat", underFlyover: false }).filter((p) => p.kind === kind).length;
    expect(count("kano", "mosque")).toBe(2);
    expect(count("kano", "church")).toBe(1);
    expect(count("enugu", "church")).toBe(2);
    expect(count("lagos", "mosque")).toBe(1);
    expect(count("lagos", "church")).toBe(1);
  });
});
