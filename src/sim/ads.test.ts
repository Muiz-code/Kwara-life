import { describe, expect, it } from "vitest";
import { PARTIES } from "../data/parties";
import { adTextProblem, bookingPrice, simulatePayment, cleanAdLink, linkHost } from "./ads";

describe("billboard ads", () => {
  it("takes a business ad", () => {
    expect(adTextProblem("Mama Ronke Jollof", "Party rice for every occasion")).toBeNull();
    expect(adTextProblem("A1 Phones", "A phone for everyone")).toBeNull();
  });

  it("refuses political ads: parties by code or name, and campaign words", () => {
    for (const p of PARTIES) {
      expect(adTextProblem(`Support ${p.name}`), p.name).not.toBeNull();
      if (p.code.length > 1) expect(adTextProblem(`${p.code} for 2027`), p.code).not.toBeNull();
    }
    expect(adTextProblem("Vote Tunde for governor")).not.toBeNull();
  });

  it("refuses links and hostile words", () => {
    expect(adTextProblem("ZoomData", "visit www.example.com")).toBe("No links on the board");
    expect(adTextProblem("Hate store")).toBe("Keep the ad positive");
  });

  it("prices showings at the ad rates and pays in test mode", async () => {
    expect(bookingPrice(100)).toBe(500_000);
    const r = await simulatePayment(500_000, 0);
    expect(r.ok && r.ref.startsWith("NV-TEST-")).toBe(true);
  });
});

describe("ad links", () => {
  it("takes a business website, made secure and tidy", () => {
    expect(cleanAdLink("mamaronke.com")).toEqual({ url: "https://mamaronke.com/" });
    expect(cleanAdLink(" https://www.shop.ng/menu#top ")).toEqual({ url: "https://www.shop.ng/menu" });
    expect(linkHost("https://www.shop.ng/menu")).toBe("shop.ng");
    expect(cleanAdLink("https://shop.ng/menu?item=jollof")).toEqual({ url: "https://shop.ng/menu?item=jollof" });
  });

  it("finds campaign words hidden in the query string too", () => {
    for (const bad of ["https://shop.ng/?vote=yes", "https://shop.ng/page?ref=election%202027", "https://shop.ng/?q=president+now"])
      expect(cleanAdLink(bad), bad).toHaveProperty("error");
  });

  it("refuses links that could hurt or mislead a player", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "http://mamaronke.com", "https://user:pass@shop.ng", "https://bit.ly/abc", "https://localhost", "not a link", ""])
      expect(cleanAdLink(bad), bad).toHaveProperty("error");
  });

  it("refuses campaign websites", () => {
    expect(cleanAdLink("https://vote-for-me.ng")).toHaveProperty("error");
    expect(cleanAdLink("https://shop.ng/election")).toHaveProperty("error");
  });
});
