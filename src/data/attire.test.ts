import { describe, expect, it } from "vitest";
import { attireFor } from "./attire";
import { STATES } from "./states";

describe("attire by state", () => {
  it("dresses people for where they are from", () => {
    expect(attireFor("lagos", "m").body).toBe("agbada");
    expect(attireFor("lagos", "f").head).toBe("gele");
    expect(attireFor("kwara", "m").head).toBe("fila");
    expect(attireFor("kano", "m").body).toBe("babbanriga");
    expect(attireFor("kano", "f").head).toBe("mayafi");
    expect(attireFor("enugu", "m").pattern).toBe("lion");
    expect(attireFor("benue", "m").pattern).toBe("anger");
    expect(attireFor("edo", "m").beads).toBe(true);
  });

  it("has a look for every state, and keeps a hijab wherever it is chosen", () => {
    for (const s of STATES) {
      for (const g of ["m", "f", "h"] as const) expect(attireFor(s.code, g).label, s.code).toBeTruthy();
      expect(attireFor(s.code, "h").head).toBe("hijab");
    }
  });
});
