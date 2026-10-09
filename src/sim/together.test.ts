import { describe, expect, it } from "vitest";
import { INVITE_LIMITS, TOGETHER } from "../data/together";
import { activitiesAt, inviteExpired, inviteProblem, togetherAction, type InviteCheck, type Player } from "./together";

const them: Player = {
  id: "p2", nickname: "Ada", look: { g: "f", skin: "#6B3E26", cloth: "#8C2F5A" }, lgaCode: "kwara/ilorin-west",
  placeId: "buka", openInvites: true, openDates: true, busy: false,
};
const base: InviteCheck = {
  me: { id: "p1", openDates: true }, them, activity: "buka", placeId: "buka", placeKind: "buka", hour: 13,
  blocked: new Set(), sentLastHour: 0, declinesToday: 0, pending: false,
};
const check = (o: Partial<InviteCheck>) => inviteProblem({ ...base, ...o });

describe("playing together", () => {
  it("allows a friendly invite at the right place and hour", () => {
    expect(check({})).toBeNull();
  });

  it("needs both players at the same place, and a place that fits", () => {
    expect(check({ placeId: "market" })).toMatch(/not here/);
    expect(check({ placeKind: "market" })).toMatch(/can't do that here/);
  });

  it("respects opening hours", () => {
    expect(check({ hour: 7 })).toMatch(/Not at this hour/);
  });

  it("only invites players who are open to it, and dates need both switches", () => {
    expect(check({ them: { ...them, openInvites: false } })).toMatch(/not taking invites/);
    expect(check({ activity: "date", placeKind: "lounge" })).toBeNull();
    expect(check({ activity: "date", placeKind: "lounge", me: { id: "p1", openDates: false } })).toMatch(/Open to dates/);
    expect(check({ activity: "date", placeKind: "lounge", them: { ...them, openDates: false } })).toMatch(/not open to dates/);
  });

  it("blocks work, and nobody gets pestered", () => {
    expect(check({ blocked: new Set(["p2"]) })).toMatch(/can't invite/);
    expect(check({ pending: true })).toMatch(/already invited/);
    expect(check({ declinesToday: INVITE_LIMITS.declinesPerDay })).toMatch(/can't today/);
    expect(check({ sentLastHour: INVITE_LIMITS.perHour })).toMatch(/plenty of invites/);
    expect(check({ them: { ...them, busy: true } })).toMatch(/busy/);
  });

  it("lists what a place offers", () => {
    expect(activitiesAt("buka").map((t) => t.id)).toEqual(["date", "buka"]);
    expect(activitiesAt("mosque").map((t) => t.id)).toEqual(["service"]);
  });

  it("the host pays for both, the guest pays nothing", () => {
    expect(togetherAction("date", "host", "Ada").cost).toBe(6_000);
    expect(togetherAction("date", "guest", "Tunde").cost).toBe(0);
    expect(togetherAction("buka", "guest", "Ada").done).toMatch(/with Ada/);
  });

  it("invites lapse when nobody answers", () => {
    const inv = { id: "i", from: { id: "p1", nickname: "Hizzy" }, to: "p2", activity: "buka" as const, placeId: "buka", sentAt: 0 };
    expect(inviteExpired(inv, INVITE_LIMITS.expireS * 1000)).toBe(false);
    expect(inviteExpired(inv, INVITE_LIMITS.expireS * 1000 + 1)).toBe(true);
  });

  it("never mentions a party", () => {
    for (const t of TOGETHER) expect(`${t.label} ${t.invite} ${t.done}`).not.toMatch(/\b(APC|PDP|LP|ADC|NDC|party politics)\b/);
  });
});
