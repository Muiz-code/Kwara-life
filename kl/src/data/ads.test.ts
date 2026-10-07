import { describe, expect, it } from "vitest";
import { adPrice } from "./ads";

describe("ad prices", () => {
  it("charges per showing with a bulk rate per thousand", () => {
    expect(adPrice(1)).toBe(5000);
    expect(adPrice(1000)).toBe(4_500_000);
    expect(adPrice(2500)).toBe(9_000_000 + 500 * 5000);
  });
});
