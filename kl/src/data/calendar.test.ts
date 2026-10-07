import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027 as C, blackoutStart, campaigningAllowed, canCollectPvc, canRegister, civicPhase, pollsAreOpen } from "./calendar";

const at = (iso: string) => Date.parse(iso);

describe("election calendar", () => {
  it("walks through the phases in order", () => {
    expect(civicPhase(C, at("2026-10-07T12:00:00+01:00"))).toBe("registration");
    expect(civicPhase(C, at("2026-10-30T23:59:59.500+01:00"))).toBe("waiting-for-pvc");
    expect(civicPhase(C, at("2026-11-01T12:00:00+01:00"))).toBe("pvc-collection");
    expect(civicPhase(C, at("2026-11-04T08:00:00+01:00"))).toBe("blackout");
    expect(civicPhase(C, at("2026-11-05T08:00:00+01:00"))).toBe("polls-open");
    expect(civicPhase(C, at("2026-11-05T16:00:00+01:00"))).toBe("results");
  });

  it("opens registration 2 minutes after the citizen is made, until 30 October", () => {
    const made = at("2026-10-07T12:00:00+01:00");
    expect(canRegister(C, made, made + 60_000)).toBe(false);
    expect(canRegister(C, made, made + 120_000)).toBe(true);
    expect(canRegister(C, made, at("2026-10-31T00:00:00+01:00"))).toBe(false);
  });

  it("gates PVC collection, campaigning and the polls", () => {
    expect(canCollectPvc(C, at("2026-10-30T12:00:00+01:00"))).toBe(false);
    expect(canCollectPvc(C, at("2026-10-31T00:00:00+01:00"))).toBe(true);
    expect(canCollectPvc(C, at("2026-11-05T07:50:00+01:00"))).toBe(true);
    expect(canCollectPvc(C, at("2026-11-05T07:50:01+01:00"))).toBe(false);
    expect(campaigningAllowed(C, blackoutStart(C) - 1)).toBe(true);
    expect(campaigningAllowed(C, blackoutStart(C))).toBe(false);
    expect(pollsAreOpen(C, at("2026-11-05T07:59:59+01:00"))).toBe(false);
    expect(pollsAreOpen(C, at("2026-11-05T15:59:59+01:00"))).toBe(true);
  });

  it("moves the blackout with a postponed election", () => {
    const later = { ...C, pvcCollectionClose: "2026-11-12T07:50:00+01:00", pollsOpen: "2026-11-12T08:00:00+01:00", pollsClose: "2026-11-12T16:00:00+01:00" };
    expect(blackoutStart(later) - blackoutStart(C)).toBe(7 * 24 * 3600 * 1000);
    expect(civicPhase(later, at("2026-11-05T10:00:00+01:00"))).toBe("pvc-collection");
  });
});
